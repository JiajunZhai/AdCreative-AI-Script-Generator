import json
import os
import re
from typing import Any, NamedTuple
from dotenv import load_dotenv
from openai import OpenAI

from usage_tokens import total_tokens_from_completion

load_dotenv()
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://192.168.0.48:11434/v1")

# Synchronous client for easier integration with FastAPI sync endpoints
local_client = OpenAI(
    base_url=OLLAMA_BASE_URL,
    api_key="ollama", # Required by the library but ignored by ollama
)


class LocalLLMResult(NamedTuple):
    """Local inference result + optional provider-reported token total (Ollama OpenAI API)."""
    output: str | dict
    total_tokens: int | None = None


def _truncate_excerpt(raw_text: str, max_chars: int = 500) -> str:
    return raw_text[:max_chars] if len(raw_text) <= max_chars else f"{raw_text[:max_chars]}...[truncated]"

def _build_local_error(error_code: str, error_message: str, raw_text: str = "") -> dict[str, Any]:
    return {
        "success": False,
        "error_code": error_code,
        "error_message": error_message,
        "raw_excerpt": _truncate_excerpt(raw_text)
    }

def repair_json(raw_text: str) -> dict[str, Any]:
    """
    Try strict JSON parsing first, then recover from mixed text output.
    Returns a structured error object instead of fake script content.
    """
    if not raw_text or not raw_text.strip():
        return _build_local_error("LOCAL_EMPTY_OUTPUT", "Local model returned empty output.")

    try:
        return json.loads(raw_text)
    except json.JSONDecodeError:
        pass

    decoder = json.JSONDecoder()
    for match in re.finditer(r"\{", raw_text):
        try:
            parsed, _ = decoder.raw_decode(raw_text[match.start():])
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            continue

    return _build_local_error(
        "LOCAL_JSON_PARSE_FAILED",
        "Local model output is not valid JSON.",
        raw_text
    )

def generate_with_local_llm(system_prompt: str, user_input: str, model: str = "qwen3.5:9b", expected_json: bool = True) -> LocalLLMResult:
    """
    Calls the local Ollama via OpenAI SDK.
    - User instruction for structural enforcement is injected implicitly if JSON expected.
    """
    try:
        print(f"[Ollama] Local request, model={model}")
        
        # Local model strict formatting reinforcement
        if expected_json:
            system_prompt += "\n\nCRITICAL MANDATORY INSTRUCTION: You MUST start your response exactly with '{' and end your response exactly with '}'. Output pure JSON."

        response = local_client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_input}
            ],
            temperature=0.7,
            # We don't force json_mode response_format here because ollama OpenAI shim sometimes fails it if model lacks structure. Relying on Regex instead.
        )
        
        raw_text = response.choices[0].message.content
        print(f"[Ollama] Response length: {len(raw_text)}")
        tok = total_tokens_from_completion(response)
        
        if expected_json:
            return LocalLLMResult(repair_json(raw_text), tok)
        return LocalLLMResult(raw_text or "", tok)
    
    except Exception as e:
        print(f"[Ollama ERROR] Inference failed: {e}")
        if expected_json:
            return LocalLLMResult(
                _build_local_error(
                    "LOCAL_REQUEST_FAILED",
                    f"Local Ollama request failed: {e}"
                ),
                None,
            )
        return LocalLLMResult("Extraction failed via Ollama.", None)
