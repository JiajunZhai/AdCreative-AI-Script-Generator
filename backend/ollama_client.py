import json
import re
from openai import OpenAI

OLLAMA_BASE_URL = "http://192.168.0.48:11434/v1"

# Synchronous client for easier integration with FastAPI sync endpoints
local_client = OpenAI(
    base_url=OLLAMA_BASE_URL,
    api_key="ollama", # Required by the library but ignored by ollama
)

def repair_json(raw_text: str) -> dict:
    """
    Scans the raw string output from the LLM, attempts to extract everything
    between the first { and the last }, and decodes it as JSON.
    """
    try:
        match = re.search(r'(\{.*\})', raw_text, re.DOTALL)
        if match:
            return json.loads(match.group(1))
        return json.loads(raw_text)
    except Exception as e:
        print(f"JSON Repair Failed: {e}")
        # Default mock structure if total failure
        return {
            "hook_score": 0,
            "hook_reasoning": "Ollama parsing failure",
            "clarity_score": 0,
            "clarity_reasoning": "Ollama parsing failure",
            "conversion_score": 0,
            "conversion_reasoning": "Ollama parsing failure",
            "bgm_direction": "Error",
            "editing_rhythm": "Error",
            "script": [
                {
                    "time": "0s", 
                    "visual": "Error Local LLM Output", 
                    "audio_content": "Error", 
                    "audio_meaning": "Error", 
                    "text_content": "Error", 
                    "text_meaning": "Error"
                }
            ],
            "psychology_insight": "Error",
            "cultural_notes": ["Error"],
            "competitor_trend": "Error"
        }

def generate_with_local_llm(system_prompt: str, user_input: str, model: str = "qwen3.5:9b", expected_json: bool = True) -> str | dict:
    """
    Calls the local Ollama via OpenAI SDK.
    - User instruction for structural enforcement is injected implicitly if JSON expected.
    """
    try:
        print(f"🌐 Triggering LOCAL Ollama request on Model: {model}...")
        
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
        print(f"🌐 LOCAL Model returned string length: {len(raw_text)}")
        
        if expected_json:
            return repair_json(raw_text)
        return raw_text
    
    except Exception as e:
        print(f"❌ Local Ollama Inference Failed: {e}")
        if expected_json:
            return repair_json("") # return fallback mock
        return "Extraction failed via Ollama."
