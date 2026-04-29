from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import os
import re
import sys
import json
from pathlib import Path
from typing import Any, List, Optional
from dotenv import load_dotenv
from openai import OpenAI
import uuid
from datetime import datetime

load_dotenv()
cloud_client = OpenAI(
    api_key=os.getenv("DEEPSEEK_API_KEY"),
    base_url=os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
) if os.getenv("DEEPSEEK_API_KEY") else None

# Phase 25 / D2 — per-call LLM routing helpers.
# Resolves (client, provider_id, model) for a given request-supplied pair.
# Falls back to the legacy `cloud_client` (DeepSeek) when:
#   - the requested provider has no API key configured, or
#   - no override was supplied at all (legacy behaviour).
from providers import (
    default_provider_id as _default_provider_id,
    get_client as _get_provider_client,
    resolve_model as _resolve_provider_model,
)


def _load_fallback_providers() -> list[str]:
    """Load the ordered fallback provider list from data/app_settings.json."""
    import json
    settings_file = os.path.join(os.path.dirname(__file__), "data", "app_settings.json")
    try:
        if os.path.exists(settings_file):
            with open(settings_file, "r", encoding="utf-8") as f:
                return json.load(f).get("fallback_providers", [])
    except Exception:
        pass
    return []


def resolve_llm_client(
    provider: str | None = None,
    model: str | None = None,
    *,
    default_env_model: str | None = None,
) -> tuple[Any, str, str, bool, str]:
    """Return ``(client, provider_id, model, did_failover, failover_to)``.

    - If ``provider`` + an API key are present in env → new provider client.
    - Else if the legacy ``cloud_client`` (DeepSeek) is configured → it, with
      provider_id=``deepseek``.
    - Else ``(None, provider or 'deepseek', resolved_model, False, '')`` so callers can
      surface a graceful "skipped" status.
    """
    if provider:
        pid = str(provider).strip().lower()
        picked = _get_provider_client(pid)
        if picked is not None:
            return picked, pid, _resolve_provider_model(pid, model), False, ""
    if cloud_client is not None:
        mdl = (
            (model or "").strip()
            or os.getenv(default_env_model or "DEEPSEEK_MODEL", "deepseek-chat")
        )
        return cloud_client, "deepseek", mdl, False, ""
    fallback_provider = (provider or _default_provider_id()).strip().lower() or "deepseek"
    return None, fallback_provider, _resolve_provider_model(fallback_provider, model), False, ""


def call_llm_with_failover(
    primary_client: Any,
    primary_provider: str,
    primary_model: str,
    **kwargs: Any,
) -> tuple[Any, str, str, bool, str]:
    """Attempt LLM call; on 429/503, auto-retry with fallback providers.

    Returns ``(response, provider_id, model_id, did_failover, failover_to)``.
    """
    from openai import RateLimitError
    import httpx

    def _is_retriable(exc: Exception) -> bool:
        if isinstance(exc, RateLimitError):
            return True
        s = str(exc)
        return "503" in s or "429" in s or "overloaded" in s.lower() or "too many" in s.lower()

    # Try primary
    try:
        resp = primary_client.chat.completions.create(**kwargs)
        return resp, primary_provider, primary_model, False, ""
    except Exception as exc:
        if not _is_retriable(exc) or primary_client is None:
            raise

    # Try fallback providers in order
    fallback_list = _load_fallback_providers()
    for fb_id in fallback_list:
        if fb_id == primary_provider:
            continue
        fb_client = _get_provider_client(fb_id)
        if fb_client is None:
            continue
        fb_model = _resolve_provider_model(fb_id, None)
        try:
            fb_kwargs = dict(kwargs)
            fb_kwargs["model"] = fb_model
            resp = fb_client.chat.completions.create(**fb_kwargs)
            return resp, fb_id, fb_model, True, fb_id
        except Exception:
            continue

    # All failed — re-raise from primary
    raise RuntimeError(f"All providers exhausted for request (primary={primary_provider})")

app = FastAPI(
    title="AdCreative AI Script Generator API",
    description="Backend API for generating structured video ad scripts using AI with Culture Intelligence.",
    version="1.1.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from projects_api import router as projects_router
app.include_router(projects_router)

from queue_api import router as queue_router, background_queue_worker
app.include_router(queue_router)

_background_tasks = set()

@app.on_event("startup")
async def startup_event():
    import asyncio
    task = asyncio.create_task(background_queue_worker())
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)

class GenerateRefineRequest(BaseModel):
    script_id: str
    instruction: str
    current_script: list[dict]

class GenerateScriptRequest(BaseModel):
    project_id: str
    region_id: str
    platform_id: str
    angle_id: str
    engine: str = Field(
        default="cloud",
        description="Engine identifier. Only 'cloud' (DeepSeek) is supported; legacy field kept for backward compat.",
    )
    # Phase 25 / D2 — per-call LLM routing (optional; default = server fallback).
    engine_provider: Optional[str] = Field(
        default=None,
        description="Provider id (deepseek | siliconflow | bailian | openrouter | zen).",
    )
    engine_model: Optional[str] = Field(
        default=None,
        description="Override provider's default model id.",
    )
    output_mode: str = Field(default="cn", description="Markdown output mode: cn or en")
    mode: str = Field(default="auto", description="Generation mode: draft | director | auto")
    compliance_suggest: bool = Field(
        default=False,
        description="When true and cloud engine is available, generate rewrite suggestions for compliance hits.",
    )
    intel_constraint: Optional[str] = Field(
        default=None,
        description="Optional forced creative constraint overridden from Oracle intel pipeline or user prompt.",
    )
    video_duration: Optional[str] = Field(
        default="15s-30s",
        description="Desired video duration (e.g. 15s, 30s, 60s)",
    )
    scene_count: Optional[str] = Field(
        default="auto",
        description="Desired number of scenes (e.g. 3-5, 5-8, auto)",
    )
    selected_draft_payload: Optional[dict] = Field(
        default=None,
        description="User-selected draft payload to bypass the draft generation phase.",
    )

class AdCopyMatrix(BaseModel):
    primary_texts: list[str] = Field(default_factory=list, description="Long-form ad primary texts (>=5)")
    headlines: list[str] = Field(default_factory=list, description="Short high-CTR headlines with emoji (>=10)")
    hashtags: list[str] = Field(default_factory=list, description="Global high-frequency hashtags (>=20)")
    visual_stickers: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Per-shot sticker allocation items: {shot_index, sticker_text, sticker_meaning_cn}",
    )

class GenerateScriptResponse(BaseModel):
    script_id: str
    hook_score: int
    hook_reasoning: str
    clarity_score: int
    clarity_reasoning: str
    conversion_score: int
    conversion_reasoning: str
    bgm_direction: str
    editing_rhythm: str
    script: list[dict]
    psychology_insight: str
    cultural_notes: list[str]
    competitor_trend: str
    citations: list[str] = []
    markdown_path: Optional[str] = None
    drafts: Optional[list[dict]] = None
    review: Optional[dict] = None
    generation_metrics: Optional[dict] = None
    ad_copy_matrix: Optional[AdCopyMatrix] = None
    ad_copy_tiles: Optional[list[dict[str, Any]]] = None
    compliance: Optional[dict[str, Any]] = None

@app.get("/")
def read_root():
    return {"status": "ok", "message": "AdCreative AI Engine Sandbox is running"}


from scraper import fetch_playstore_data, extract_usp_via_llm_with_usage
from exporter import generate_pdf_report
from refinery import retrieve_context, retrieve_context_with_evidence, distill_and_store
from md_export import export_markdown_after_generate
from knowledge_paths import FACTORS_DIR, ensure_knowledge_layout
from usage_tokens import total_tokens_from_completion
from usage_tracker import (
    get_summary as usage_get_summary,
    record_extract_url_success,
    record_generate_success,
    record_oracle_ingest_success,
)
from sanitize import sanitize_game_info, sanitize_list, sanitize_user_text

# Phase 26 / E — SQLite backbone. Run migrations + seed the read-only
# factor/compliance corpora and migrate any legacy JSON workspaces into the DB.
from db import run_migrations as _run_migrations
from factors_store import read_insight as read_insight_factor, seed_from_filesystem as _seed_factors
from compliance_store import seed_from_filesystem as _seed_compliance



def _bootstrap_storage() -> None:
    """Idempotent: create tables, seed git-tracked JSON into DB, import workspaces."""
    _run_migrations()
    try:
        _seed_factors()
    except Exception as exc:
        print(f"[E] factor seed failed: {exc}")
    try:
        _seed_compliance()
    except Exception as exc:
        print(f"[E] compliance seed failed: {exc}")

    # Knowledge corpus is seeded inside refinery when the module-level store is
    # built; rerun against a potentially-reset DB so tests / CLI scripts that
    # swap DB_PATH see the seed corpus too.
    try:
        from refinery import ensure_seeded as _ensure_knowledge_seeded

        _ensure_knowledge_seeded()
    except Exception as exc:
        print(f"[E] knowledge seed failed: {exc}")


_bootstrap_storage()

class GeneratePdfRequest(BaseModel):
    data: dict


class OutPathRequest(BaseModel):
    path: str

class QuickCopyRequest(BaseModel):
    project_id: str
    region_id: str
    region_ids: list[str] = Field(default_factory=list, description="Optional multi-region IDs (checkbox multi-select)")
    platform_id: str
    angle_id: str
    engine: str = Field(
        default="cloud",
        description="Engine identifier. Only 'cloud' (DeepSeek) is supported; legacy field kept for backward compat.",
    )
    engine_provider: Optional[str] = Field(default=None)
    engine_model: Optional[str] = Field(default=None)
    output_mode: str = Field(default="cn", description="Markdown output mode: cn or en")
    quantity: int = Field(default=20, description="Legacy field, use specific counts instead")
    primary_text_count: int = Field(default=5, description="Number of primary texts")
    headline_count: int = Field(default=10, description="Number of headlines")
    hashtag_count: int = Field(default=20, description="Number of hashtags")
    tones: list[str] = Field(default_factory=list, description="Tone preferences: humor, pro, clickbait, benefit, FOMO, etc.")
    locales: list[str] = Field(default_factory=list, description="Locales to generate copies for (e.g., en, ja, ar)")
    compliance_suggest: bool = Field(default=False, description="Generate compliance rewrite suggestions (cloud only).")
    intel_constraint: Optional[str] = Field(default=None, description="Optional forced creative constraint overridden from Oracle intel pipeline.")

class RefreshCopyRequest(BaseModel):
    project_id: str
    base_script_id: str
    engine: str = Field(
        default="cloud",
        description="Engine identifier. Only 'cloud' (DeepSeek) is supported; legacy field kept for backward compat.",
    )
    engine_provider: Optional[str] = Field(default=None)
    engine_model: Optional[str] = Field(default=None)
    output_mode: str = Field(default="cn", description="Markdown output mode: cn or en")
    quantity: int = Field(default=20, description="Number of headlines per locale")
    tones: list[str] = Field(default_factory=list)
    locales: list[str] = Field(default_factory=list)
    compliance_suggest: bool = Field(default=False, description="Generate compliance rewrite suggestions (cloud only).")
    intel_constraint: Optional[str] = Field(default=None, description="Optional forced creative constraint overridden from Oracle intel pipeline.")

class QuickCopyResponse(BaseModel):
    script_id: str
    project_id: str
    ad_copy_matrix: dict[str, Any]
    markdown_path: Optional[str] = None
    generation_metrics: Optional[dict] = None
    ad_copy_tiles: Optional[list[dict[str, Any]]] = None
    compliance: Optional[dict[str, Any]] = None
    # Phase 23 / B4 — True when any region within a multi-region quick_copy
    # ended with status != "ok". UI surfaces a warning + retry per region.
    partial_failure: bool = False

REQUIRED_SCRIPT_FIELDS = {
    "hook_score",
    "hook_reasoning",
    "clarity_score",
    "clarity_reasoning",
    "conversion_score",
    "conversion_reasoning",
    "bgm_direction",
    "editing_rhythm",
    "script",
    "psychology_insight",
    "cultural_notes",
    "competitor_trend"
}

REQUIRED_SCRIPT_LINE_FIELDS = {
    "time",
    "visual",
    "visual_meaning",
    "audio_content",
    "audio_meaning",
    "text_content",
    "text_meaning",
    "direction_note",
    "sfx_transition_note",
}


def _resolve_out_path(rel: str) -> tuple[str, str]:
    """
    Resolve an @OUT-relative path safely.

    Returns (abs_file_path, abs_out_dir) as strings.
    Raises HTTPException(400) on invalid input / traversal.
    """
    from md_export import repo_root

    raw = str(rel or "").strip()
    if not raw.startswith("@OUT/"):
        raise HTTPException(status_code=400, detail="path must start with @OUT/")
    # normalize to OS path segments
    rel_tail = raw[len("@OUT/") :]
    # basic traversal guards (still verify via resolved path)
    if ".." in rel_tail.replace("\\", "/").split("/"):
        raise HTTPException(status_code=400, detail="path traversal is not allowed")

    out_dir = (repo_root() / "@OUT").resolve()
    abs_path = (out_dir / rel_tail).resolve()
    try:
        common = os.path.commonpath([str(out_dir), str(abs_path)])
    except Exception:
        raise HTTPException(status_code=400, detail="invalid @OUT path")
    if str(Path(common).resolve()).lower() != str(out_dir).lower():
        raise HTTPException(status_code=400, detail="invalid @OUT path")
    return str(abs_path), str(out_dir)


def _is_localhost_request(request: Request) -> bool:
    host = (request.client.host if request.client else "") or ""
    return host in {"127.0.0.1", "localhost", "::1"}


@app.get("/api/out/markdown")
def out_markdown(path: str):
    abs_path, _abs_out = _resolve_out_path(path)
    if not abs_path.lower().endswith(".md"):
        raise HTTPException(status_code=400, detail="only .md is supported")
    if not os.path.exists(abs_path):
        raise HTTPException(status_code=404, detail="markdown file not found")
    try:
        with open(abs_path, "r", encoding="utf-8") as f:
            body = f.read()
        return {"success": True, "markdown": body}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"failed to read markdown: {e}")


@app.post("/api/out/open-folder")
def out_open_folder(request: Request, payload: OutPathRequest):
    # Safety: never allow remote-triggered folder opening.
    if not _is_localhost_request(request) and os.getenv("ALLOW_OUT_OPEN_FOLDER", "").strip() != "1":
        raise HTTPException(status_code=403, detail="open-folder is allowed only from localhost")
    abs_path, abs_out = _resolve_out_path(payload.path)
    folder = os.path.dirname(abs_path)
    if not folder:
        folder = abs_out
    folder = str(Path(folder).resolve())
    if not folder.lower().startswith(str(Path(abs_out).resolve()).lower()):
        raise HTTPException(status_code=400, detail="invalid folder")
    try:
        if not os.path.exists(folder):
            raise HTTPException(status_code=404, detail="folder not found")
        os.startfile(folder)  # type: ignore[attr-defined]  # Windows only
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"failed to open folder: {e}")

# ---------------------------------------------------------------------------
# Phase 22: History schema v2 + Compliance negative list + Decision feedback
# ---------------------------------------------------------------------------

_VALID_DECISIONS = {"pending", "winner", "loser", "neutral"}


def _record_history(
    project_data,
    req,
    resp_dict,
    engine,
    *,
    recipe_override: dict[str, str] | None = None,
    parent_script_id: str | None = None,
    factor_version: str | None = None,
    rag_rule_ids: list[str] | None = None,
    draft_status: str | None = None,
    provider: str | None = None,
    model: str | None = None,
):
    """Module-level history writer (Phase 22 / Phase 25).

    Extracted out of `generate_script` so that quick_copy / refresh_copy can
    reliably persist history entries. Entries follow schema v3: they carry
    parent_script_id, factor_version, rag_rule_ids, draft_status, lang, an
    initial decision=pending slot for the Winner/Loser learning loop, and
    (Phase 25/D2) the resolved LLM provider + model for cost attribution.
    """
    try:
        if not project_data.get('id') or project_data.get('id') == "Unknown":
            return
        from projects_api import append_history_entry
        if 'history_log' not in project_data:
            project_data['history_log'] = []
        recipe = recipe_override or {
            "region": getattr(req, "region_id", None) or "",
            "platform": getattr(req, "platform_id", None) or "",
            "angle": getattr(req, "angle_id", None) or "",
        }
        output_mode_value = str(getattr(req, "output_mode", None) or "cn")
        entry = {
            "id": resp_dict.get('script_id') or str(uuid.uuid4()),
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "engine": engine,
            "recipe": recipe,
            "output_kind": "copy" if str(resp_dict.get("script_id", "")).startswith("COPY-") else "sop",
            "output_mode": output_mode_value,
            "markdown_path": resp_dict.get("markdown_path"),
            "generation_metrics": resp_dict.get("generation_metrics"),
            "compliance": resp_dict.get("compliance"),
            "ad_copy_matrix": resp_dict.get("ad_copy_matrix"),
            "ad_copy_tiles": resp_dict.get("ad_copy_tiles"),
            "script": resp_dict.get('script', []),
            # Phase 22 schema v2 fields (nullable; kept optional so old readers still work)
            # Phase 25/D2 bumps to schema_version=3 by introducing provider/model.
            "schema_version": 3,
            "lang": output_mode_value,
            "parent_script_id": parent_script_id,
            "factor_version": factor_version,
            "rag_rule_ids": rag_rule_ids or [],
            "draft_status": draft_status,
            "decision": "pending",
            "decision_at": None,
            "provider": provider,
            "model": model,
        }
        project_data['history_log'].append(entry)
        # Phase 26/E — write straight into the history_log table; the in-memory
        # project_data dict still mirrors the entry so downstream callers that
        # re-read the list during the same request keep working.
        append_history_entry(project_data['id'], entry)
    except Exception as e:
        print(f"Failed to record history: {e}")


class HistoryDecisionRequest(BaseModel):
    project_id: str
    script_id: str
    decision: str = Field(default="pending", description="pending | winner | loser | neutral")

class MarkWinnerRequest(BaseModel):
    performance_stats: dict[str, Any] | None = None

@app.post("/api/history/{script_id}/mark-winner")
def set_history_winner(script_id: str, payload: MarkWinnerRequest):
    """Mark a script as a winner with optional performance stats."""
    from projects_api import mark_history_winner
    if not mark_history_winner(script_id, payload.performance_stats):
        raise HTTPException(status_code=404, detail="history entry not found")
    return {"success": True, "script_id": script_id, "is_winner": True}

def _compute_factor_version(*factor_jsons: Any) -> str:
    """Stable short fingerprint over the factor JSON payloads used in a generation.

    Stored alongside history entries so future A/B comparisons can detect when
    the underlying region/platform/angle knowledge has shifted underneath.
    """
    import hashlib
    parts: list[str] = []
    for obj in factor_jsons:
        try:
            parts.append(json.dumps(obj, ensure_ascii=False, sort_keys=True))
        except Exception:
            parts.append("")
    digest = hashlib.sha1("|".join(parts).encode("utf-8", errors="replace")).hexdigest()
    return digest[:12]


def _extract_rag_rule_ids(evidence: list[dict] | None, citations: list[str] | None = None) -> list[str]:
    """Pick stable identifiers out of RAG evidence so Compare can do a set diff."""
    ids: list[str] = []
    seen: set[str] = set()
    if isinstance(evidence, list):
        for ev in evidence:
            if not isinstance(ev, dict):
                continue
            for key in ("id", "rule_id", "source", "citation"):
                val = ev.get(key)
                if isinstance(val, str) and val.strip():
                    k = val.strip()
                    if k not in seen:
                        seen.add(k)
                        ids.append(k)
                    break
    if not ids and isinstance(citations, list):
        for c in citations:
            if isinstance(c, str) and c.strip() and c not in seen:
                seen.add(c)
                ids.append(c)
    return ids[:20]


def _collect_avoid_terms(project_data: dict[str, Any], *, limit_records: int = 5, limit_terms: int = 12) -> list[str]:
    """Aggregate recent compliance.hits[].term from this project's history.

    These are fed back into the director/copy prompts as a negative list so the
    same risky phrasing does not recur on every generation.
    """
    if not isinstance(project_data, dict):
        return []
    log = project_data.get("history_log")
    if not isinstance(log, list) or not log:
        return []
    try:
        ordered = sorted(log, key=lambda x: str(x.get("timestamp") or ""), reverse=True)
    except Exception:
        ordered = list(reversed(log))
    terms: list[str] = []
    seen: set[str] = set()
    for entry in ordered[:limit_records]:
        if not isinstance(entry, dict):
            continue
        compliance = entry.get("compliance")
        if not isinstance(compliance, dict):
            continue
        hits = compliance.get("hits")
        if not isinstance(hits, list):
            continue
        for hit in hits:
            if not isinstance(hit, dict):
                continue
            term = hit.get("term")
            if not isinstance(term, str):
                continue
            t = term.strip()
            if not t:
                continue
            key = t.lower()
            if key in seen:
                continue
            seen.add(key)
            terms.append(t)
            if len(terms) >= limit_terms:
                return terms
    return terms


@app.post("/api/history/decision")
def set_history_decision(payload: HistoryDecisionRequest):
    """Mark a generation record as winner/loser/neutral (Phase 22 learning loop).

    Phase 26/E — rewritten against the SQLite ``history_log`` table.
    """
    from projects_api import load_project as _load_project, update_history_decision

    decision = (payload.decision or "").strip().lower()
    if decision not in _VALID_DECISIONS:
        raise HTTPException(status_code=400, detail=f"decision must be one of {sorted(_VALID_DECISIONS)}")
    if not payload.project_id or not payload.script_id:
        raise HTTPException(status_code=400, detail="project_id and script_id are required")

    project_data = _load_project(payload.project_id)
    if project_data is None:
        raise HTTPException(status_code=404, detail="project not found")
    ts = datetime.utcnow().isoformat() + "Z"
    if not update_history_decision(payload.project_id, payload.script_id, decision, ts):
        raise HTTPException(status_code=404, detail="history entry not found")
    return {"success": True, "script_id": payload.script_id, "decision": decision, "decision_at": ts}


def _print_console_safe(text: str) -> None:
    """Avoid UnicodeEncodeError on Windows consoles (e.g. cp936) when prompt/context has rare symbols."""
    try:
        print(text)
    except UnicodeEncodeError:
        sys.stdout.buffer.write(text.encode("utf-8", errors="replace"))
        sys.stdout.buffer.write(b"\n")


def _is_valid_script_payload(payload: dict[str, Any]) -> bool:
    if not isinstance(payload, dict):
        return False
    if not REQUIRED_SCRIPT_FIELDS.issubset(payload.keys()):
        return False
    if not isinstance(payload.get("script"), list) or not payload["script"]:
        return False
    if not isinstance(payload.get("cultural_notes"), list):
        return False
    for line in payload["script"]:
        if not isinstance(line, dict):
            return False
        if not REQUIRED_SCRIPT_LINE_FIELDS.issubset(line.keys()):
            return False
    return True


def _normalize_script_lines(payload: dict[str, Any]) -> dict[str, Any]:
    """Backfill new director-facing fields for backward compatibility."""
    script = payload.get("script")
    if not isinstance(script, list):
        return payload
    for line in script:
        if not isinstance(line, dict):
            continue
        visual = str(line.get("visual", "")).strip()
        audio_meaning = str(line.get("audio_meaning", "")).strip()
        line.setdefault("visual_meaning", visual)
        line.setdefault("direction_note", "")
        line.setdefault("sfx_transition_note", "")
        # Unify sticker fields: legacy export reads text_content/text_meaning
        sticker_text = str(line.get("sticker_text", "") or "").strip()
        sticker_meaning = str(line.get("sticker_meaning", "") or "").strip()
        if not str(line.get("text_content", "") or "").strip() and sticker_text:
            line["text_content"] = sticker_text
        if not str(line.get("text_meaning", "") or "").strip() and sticker_meaning:
            line["text_meaning"] = sticker_meaning
        if not sticker_text and str(line.get("text_content", "") or "").strip():
            line["sticker_text"] = str(line.get("text_content", "")).strip()
        if not sticker_meaning and str(line.get("text_meaning", "") or "").strip():
            line["sticker_meaning"] = str(line.get("text_meaning", "")).strip()
        if audio_meaning and "语气" not in audio_meaning and "节奏" not in audio_meaning:
            line["audio_meaning"] = f"{audio_meaning}（语气：自然口语；节奏：短句有力）"
    return payload


def _extract_headline_keywords(headlines: list[str]) -> list[str]:
    if not headlines:
        return []
    first = str(headlines[0] or "")
    # Keep it simple and robust: ASCII-ish tokens only
    tokens = []
    for raw in first.replace("#", " ").replace("|", " ").replace("-", " ").split():
        w = "".join(ch for ch in raw if ch.isalnum())
        if len(w) >= 3:
            tokens.append(w.lower())
    # de-dup while preserving order
    out: list[str] = []
    for t in tokens:
        if t not in out:
            out.append(t)
    return out[:6]


def _ensure_ad_copy_matrix(
    payload: dict[str, Any],
    *,
    angle_name: str,
    platform_name: str,
    region_name: str,
) -> dict[str, Any]:
    """Best-effort backfill to satisfy Ad Copy Matrix minimum counts."""
    acm = payload.get("ad_copy_matrix")
    if not isinstance(acm, dict):
        acm = {}
    primary_texts = acm.get("primary_texts")
    headlines = acm.get("headlines")
    hashtags = acm.get("hashtags")
    visual_stickers = acm.get("visual_stickers")

    if not isinstance(primary_texts, list):
        primary_texts = []
    if not isinstance(headlines, list):
        headlines = []
    if not isinstance(hashtags, list):
        hashtags = []
    if not isinstance(visual_stickers, list):
        visual_stickers = []

    # Primary texts (5 styles)
    style_templates = [
        ("拯救", f"他/她只差一步就被毁掉…你能在 3 秒内救回来吗？立刻进 {platform_name} 爆款玩法：点一下，逆转结局。"),
        ("智商", f"你以为这是随机？其实是策略题。{region_name} 热门解法：看穿陷阱 → 一步翻盘 → 爽感爆表。"),
        ("ASMR", "听这一声“咔哒”就上瘾。慢一点、爽一点：刮开、解压、连击反馈，每一帧都舒服。"),
        ("福利", "新手福利拉满：开局送资源，连抽不断，轻松追上老玩家。今天就把奖励拿走。"),
        ("简洁", "3 秒看懂，1 分钟上头。真实玩法，不演。"),
    ]
    for name, t in style_templates:
        if len(primary_texts) >= 5:
            break
        primary_texts.append(f"[{name}] {t}")
    primary_texts = [str(x) for x in primary_texts if str(x).strip()][: max(5, len(primary_texts))]

    # Headlines (>=10, include emoji)
    headline_pool = [
        "Level 1 vs Level 99 😱",
        "Huge Win in 3s 🏆",
        "Scared? Watch this 😳",
        "One Tap Comeback 🔥",
        "Stop Doing This ❌",
        "Only 1% Can Solve 🧠",
        "So Satisfying... 😌",
        "Free Rewards Today 🎁",
        "Fail? Try Again ✅",
        "Real Gameplay, No Cap 🎮",
        f"{angle_name} Hook Works 😈",
        f"{platform_name} Trend Alert 🚀",
    ]
    for h in headline_pool:
        if len(headlines) >= 10:
            break
        headlines.append(h)
    headlines = [str(x) for x in headlines if str(x).strip()]

    # Hashtags (>=20)
    tag_pool = [
        "#mobilegame", "#gaming", "#ad", "#ua", "#fyp", "#viral", "#tiktokads", "#reels", "#shorts",
        "#gameplay", "#strategy", "#puzzle", "#satisfying", "#asmr", "#reward", "#free", "#levelup",
        "#challenge", "#comedy", "#fail", "#win", "#trend", "#newgame", "#casualgame", "#hypercasual",
    ]
    for tag in tag_pool:
        if len(hashtags) >= 20:
            break
        hashtags.append(tag)
    hashtags = [str(x) for x in hashtags if str(x).strip()]

    # Visual stickers: per shot >=1 + CN meaning, align first 3s with headline keywords
    script = payload.get("script")
    if isinstance(script, list) and script:
        existing_by_idx: dict[int, dict[str, Any]] = {}
        for it in visual_stickers:
            if isinstance(it, dict) and isinstance(it.get("shot_index"), int):
                existing_by_idx[it["shot_index"]] = it

        keywords = _extract_headline_keywords(headlines)
        default_pairs = [
            ("LEVEL 1 vs LEVEL 99", "1 级 vs 99 级（强对比）"),
            ("HUGE WIN", "巨大胜利（强爽点）"),
            ("DON'T DO THIS", "千万别这样做（反差警告）"),
            ("FREE REWARDS", "免费奖励（福利暗示）"),
            ("SO SATISFYING", "太解压了（ASMR/解压向）"),
        ]

        for i, line in enumerate(script):
            if not isinstance(line, dict):
                continue
            if i in existing_by_idx:
                continue
            sticker_text = str(line.get("sticker_text") or line.get("text_content") or "").strip()
            sticker_meaning_cn = str(line.get("sticker_meaning") or line.get("text_meaning") or "").strip()
            if not sticker_text:
                pair = default_pairs[i % len(default_pairs)]
                sticker_text = pair[0]
                sticker_meaning_cn = sticker_meaning_cn or pair[1]
            # Ensure first ~3s (first 2 shots is typical) mention headline keyword when available
            if i <= 1 and keywords and not any(k in sticker_text.lower() for k in keywords):
                sticker_text = f"{keywords[0].upper()} | {sticker_text}"
                sticker_meaning_cn = sticker_meaning_cn or "与标题关键词对齐（前3秒）"
            visual_stickers.append(
                {
                    "shot_index": i,
                    "sticker_text": sticker_text,
                    "sticker_meaning_cn": sticker_meaning_cn or "画面贴纸强化冲击与信息密度",
                }
            )
            # Keep shot-level fields in sync for export/UI
            line.setdefault("sticker_text", sticker_text)
            line.setdefault("sticker_meaning", sticker_meaning_cn or "画面贴纸强化冲击与信息密度")
            if not str(line.get("text_content", "") or "").strip():
                line["text_content"] = sticker_text
            if not str(line.get("text_meaning", "") or "").strip():
                line["text_meaning"] = line.get("sticker_meaning", "")

    payload["ad_copy_matrix"] = {
        "primary_texts": primary_texts[: max(5, len(primary_texts))],
        "headlines": headlines[: max(10, len(headlines))],
        "hashtags": hashtags[: max(20, len(hashtags))],
        "visual_stickers": visual_stickers,
    }
    return payload


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except Exception:
        return default


def _pick_top_draft(drafts_payload: dict[str, Any]) -> tuple[list[dict], dict | None]:
    drafts = drafts_payload.get("drafts") if isinstance(drafts_payload, dict) else None
    if not isinstance(drafts, list):
        return [], None
    cleaned = [d for d in drafts if isinstance(d, dict)]
    if not cleaned:
        return [], None
    recommend = str(drafts_payload.get("pick_recommendation", "")).strip()
    for d in cleaned:
        if str(d.get("id", "")).strip() == recommend:
            return cleaned, d
    top = max(
        cleaned,
        key=lambda x: (_safe_int(x.get("estimated_quality")), _safe_int(x.get("estimated_ctr"))),
    )
    return cleaned, top


def _build_script_review(
    script_payload: dict[str, Any],
    *,
    core_gameplay: str,
    angle_name: str,
) -> dict[str, Any]:
    script_lines = script_payload.get("script", [])
    issues: list[dict[str, str]] = []
    warnings: list[dict[str, str]] = []

    joined_visual = " ".join(str((ln or {}).get("visual", "")) for ln in script_lines if isinstance(ln, dict)).lower()
    if any(k in joined_visual for k in ("low battery", "phone call", "system warning", "os alert", "native ui")):
        issues.append(
            {
                "code": "policy_fake_system_ui",
                "message": "脚本含疑似系统原生UI伪装元素，存在拒审风险。",
            }
        )

    first_two = " ".join(
        str((ln or {}).get("visual", ""))
        for ln in script_lines[:2]
        if isinstance(ln, dict)
    ).lower()
    gameplay_keywords = [w.lower() for w in str(core_gameplay or "").split() if len(w) >= 4][:8]
    if gameplay_keywords and not any(k in first_two for k in gameplay_keywords):
        warnings.append(
            {
                "code": "hook_gameplay_gap",
                "message": "前2镜未明显体现核心玩法关键词，可能出现高CTR低留存。",
            }
        )

    if len(script_lines) < 5:
        warnings.append(
            {
                "code": "low_story_density",
                "message": "分镜数量偏少，建议至少5镜以保证完整叙事闭环。",
            }
        )

    if "asmr" in str(angle_name).lower():
        rhythm = str(script_payload.get("editing_rhythm", "")).lower()
        if any(k in rhythm for k in ("0.8", "1.0", "hyper-fast", "extreme fast")):
            warnings.append(
                {
                    "code": "asmr_pacing_too_fast",
                    "message": "ASMR方向节奏过快，建议在展示段延长单镜头时长。",
                }
            )

    score = max(0, 100 - 20 * len(issues) - 8 * len(warnings))
    return {
        "issues": issues,
        "warnings": warnings,
        "score_breakdown": {
            "overall": score,
            "issue_penalty": 20 * len(issues),
            "warning_penalty": 8 * len(warnings),
        },
    }

def _looks_like_error_placeholder(data: dict[str, Any]) -> bool:
    haystacks = [
        str(data.get("hook_reasoning", "")),
        str(data.get("clarity_reasoning", "")),
        str(data.get("conversion_reasoning", "")),
        str(data.get("bgm_direction", "")),
        str(data.get("editing_rhythm", ""))
    ]
    for line in data.get("script", []):
        if isinstance(line, dict):
            haystacks.append(str(line.get("visual", "")))

    flags = (
        "CLOUD_SYNTHESIS_FAILED",
        "CLOUD_UNAVAILABLE",
        "DRAFT_UNAVAILABLE",
    )
    return any(flag in text for text in haystacks for flag in flags)


def _normalize_ad_copy_matrix(acm: Any, *, quantity: int) -> dict[str, Any]:
    """Best-effort normalize quick-copy output structure + enforce minimums."""
    q = max(5, min(int(quantity or 20), 200))
    if not isinstance(acm, dict):
        acm = {}
    default_locale = str(acm.get("default_locale") or "en").strip() or "en"
    locales = acm.get("locales")
    if not isinstance(locales, list) or not locales:
        locales = [default_locale]
    locales = [str(x).strip() for x in locales if str(x).strip()]
    if default_locale not in locales:
        locales.insert(0, default_locale)
    variants = acm.get("variants")
    if not isinstance(variants, dict):
        variants = {}

    def ensure_variant(loc: str, v: Any) -> dict[str, Any]:
        if not isinstance(v, dict):
            v = {}
        pt = v.get("primary_texts")
        hl = v.get("headlines")
        ht = v.get("hashtags")
        if not isinstance(pt, list):
            pt = []
        if not isinstance(hl, list):
            hl = []
        if not isinstance(ht, list):
            ht = []

        # backfill minimums (keep content simple; prompt should do heavy lifting)
        while len(pt) < 5:
            pt.append(f"[Minimal] Clean hook + clear benefit ({loc})")
        while len(hl) < q:
            hl.append(f"Level 1 vs Level 99 😱 ({loc})")
        hl = [str(x) for x in hl if str(x).strip()][:q]

        tag_pool = [
            "#mobilegame", "#gaming", "#fyp", "#viral", "#shorts",
            "#gameplay", "#strategy", "#puzzle", "#satisfying", "#asmr",
            "#reward", "#free", "#levelup", "#challenge", "#win",
            "#trend", "#newgame", "#casualgame", "#hypercasual", "#tiktokads",
        ]
        for tag in tag_pool:
            if len(ht) >= 20:
                break
            ht.append(tag)
        ht = [str(x) for x in ht if str(x).strip()]
        # ensure hash prefix
        ht = [x if x.startswith("#") else f"#{x.lstrip()}" for x in ht]

        return {"primary_texts": pt, "headlines": hl, "hashtags": ht[: max(20, len(ht))]}

    for loc in locales:
        variants[loc] = ensure_variant(loc, variants.get(loc))

    return {"default_locale": default_locale, "locales": locales, "variants": variants}


def _script_to_context(script_lines: Any) -> str:
    if not isinstance(script_lines, list) or not script_lines:
        return ""
    chunks: list[str] = []
    for i, ln in enumerate(script_lines[:20], start=1):
        if not isinstance(ln, dict):
            continue
        t = str(ln.get("time", "")).strip()
        v = str(ln.get("visual", "")).strip()
        vo = str(ln.get("audio_content", "")).strip()
        st = str(ln.get("text_content", "")).strip()
        if v or vo or st:
            chunks.append(f"[Shot {i} {t}] visual={v} | vo={vo} | sticker={st}")
    return "\n".join(chunks)


@app.post("/api/quick-copy", response_model=QuickCopyResponse)
def quick_copy(request: QuickCopyRequest):
    import os, json, time
    from prompts import render_copy_prompt

    t0 = time.perf_counter()
    if not request.project_id:
        raise HTTPException(status_code=400, detail="project_id is required")

    ensure_knowledge_layout()
    read_insight = read_insight_factor

    # workspace (Phase 26/E: read from DB; fallback to legacy JSON if present)
    from projects_api import load_project as _load_project
    project_json = _load_project(request.project_id) or {"name": "Unknown", "game_info": {"core_loop": "Generic Game"}}
    workspace_file = os.path.join(os.path.dirname(__file__), 'data', 'workspaces', f"{request.project_id}.json")
    if project_json.get("name") == "Unknown" and os.path.exists(workspace_file):
        with open(workspace_file, 'r', encoding='utf-8') as f:
            project_json = json.load(f)

    platform_json = read_insight(request.platform_id)
    angle_json = read_insight(request.angle_id)
    # Phase 23/B1 — sanitize user-origin fields that flow into the copy prompt.
    gi = sanitize_game_info(project_json.get('game_info', {}))
    safe_name = sanitize_user_text(project_json.get('name'), max_len=200, allow_newlines=False)
    safe_tones = sanitize_list(request.tones, max_len=80, max_items=20)
    safe_locales = sanitize_list(request.locales, max_len=40, max_items=24)
    usp_dict = gi.get('usp', {})
    usp_str = "\\n".join([f"- {k}: {v}" for k, v in usp_dict.items()]) if isinstance(usp_dict, dict) else str(usp_dict)
    comp_set = ", ".join(gi.get('competitive_set', []))
    game_context = (
        f"Title: {safe_name}\\n"
        f"Core Loop: {gi.get('core_loop', '')}\\n"
        f"USP:\\n{usp_str}\\n"
        f"Persona: {gi.get('persona', '')}\\n"
        f"Visual DNA: {gi.get('visual_dna', '')}\\n"
        f"Competitive Set: {comp_set}"
    )

    script_id = "COPY-" + uuid.uuid4().hex[:6].upper()
    regions_to_run = [str(x) for x in (request.region_ids or []) if str(x).strip()] or [request.region_id]
    avoid_terms = _collect_avoid_terms(project_json)
    region_acm: dict[str, dict[str, Any]] = {}
    region_factor_objs: list[Any] = []
    region_rag_ids: list[str] = []
    # Phase 23/B4 — per-region status so a single failure doesn't black-box the whole batch.
    region_statuses: dict[str, str] = {}
    region_errors: dict[str, str] = {}
    region_factor_objs.extend([platform_json, angle_json])
    # Phase 25/D2 — resolve provider/model once for this whole request.
    active_client, provider_id, model_id, *_ = resolve_llm_client(
        request.engine_provider, request.engine_model
    )
    import concurrent.futures

    def _process_region(rid: str) -> dict:
        region_json = read_insight(rid)
        # Optional: lightweight RAG context only (no heavy stitching)
        rag_context, rag_cits_r, rag_ev_r = retrieve_context_with_evidence(
            f"{rid} {request.platform_id} {request.angle_id}",
            top_k=4,
            supplement=f"{rid}\n{request.platform_id}\n{request.angle_id}\n{game_context}",
            region_boost_tokens=[str(region_json.get("name"))] if isinstance(region_json, dict) and region_json.get("name") else None,
            region_id=rid,
            target_platform=request.platform_id,
        )
        rag_ids = _extract_rag_rule_ids(rag_ev_r, rag_cits_r)
        
        prompt = render_copy_prompt(
            game_context=game_context,
            culture_context=region_json if isinstance(region_json, dict) else {},
            platform_rules=platform_json if isinstance(platform_json, dict) else {},
            creative_logic=angle_json if isinstance(angle_json, dict) else {},
            quantity=request.quantity,
            primary_text_count=getattr(request, 'primary_text_count', 5),
            headline_count=getattr(request, 'headline_count', 10),
            hashtag_count=getattr(request, 'hashtag_count', 20),
            tones=safe_tones,
            locales=safe_locales,
            avoid_terms=avoid_terms,
        )
        user_input = f"Market context (optional):\n{rag_context}\n\nReturn copy matrix JSON only."

        result_obj: dict[str, Any] = {}
        status = "skipped"
        err_str = ""
        if active_client:
            try:
                resp = active_client.chat.completions.create(
                    model=model_id,
                    response_format={"type": "json_object"},
                    messages=[
                        {"role": "system", "content": prompt},
                        {"role": "user", "content": user_input},
                    ],
                    timeout=float(os.getenv("DEEPSEEK_TIMEOUT_SECONDS", "90")),
                )
                result_obj = json.loads(resp.choices[0].message.content or "{}")
                status = "ok"
            except Exception as e:
                print(f"Quick copy failed ({rid}): {e}")
                result_obj = {}
                status = "failed"
                err_str = str(e)[:300]
                
        acm_raw = result_obj.get("ad_copy_matrix") if isinstance(result_obj, dict) else None
        normalized = _normalize_ad_copy_matrix(acm_raw, quantity=request.quantity)
        if status == "ok" and not normalized.get("variants"):
            status = "fallback"
            
        return {
            "rid": rid,
            "region_json": region_json,
            "rag_ids": rag_ids,
            "status": status,
            "err_str": err_str,
            "normalized": normalized
        }

    with concurrent.futures.ThreadPoolExecutor(max_workers=min(10, len(regions_to_run))) as executor:
        futures = {executor.submit(_process_region, rid): rid for rid in regions_to_run}
        for future in concurrent.futures.as_completed(futures):
            res = future.result()
            rid = res["rid"]
            region_factor_objs.append(res["region_json"])
            region_rag_ids.extend(res["rag_ids"])
            region_statuses[rid] = res["status"]
            if res["err_str"]:
                region_errors[rid] = res["err_str"]
            region_acm[rid] = res["normalized"]

    # Merge multi-region into one stable {locales, variants} shape by namespacing locale keys: "{region}:{locale}"
    combined_locales: list[str] = []
    combined_variants: dict[str, Any] = {}
    for rid, acm in region_acm.items():
        locales = acm.get("locales") if isinstance(acm.get("locales"), list) else [acm.get("default_locale") or "en"]
        variants = acm.get("variants") if isinstance(acm.get("variants"), dict) else {}
        for loc in [str(x) for x in locales if str(x).strip()]:
            key = f"{rid}:{loc}"
            combined_locales.append(key)
            combined_variants[key] = variants.get(loc) if isinstance(variants, dict) else {}
    default_locale = combined_locales[0] if combined_locales else f"{regions_to_run[0]}:en"
    # Partial failure means at least one LLM attempt was made AND at least one
    # region did not return usable data. If every region is "skipped" (no LLM
    # configured) we treat it as the legacy no-op path rather than a failure.
    attempted = any(s != "skipped" for s in region_statuses.values())
    partial_failure = attempted and any(s != "ok" for s in region_statuses.values())
    acm = {
        "default_locale": default_locale,
        "locales": combined_locales,
        "variants": combined_variants,
        "regions": regions_to_run,
        "regions_status": region_statuses,
        "regions_error": region_errors,
    }
    payload = {
        "script_id": script_id,
        "project_id": request.project_id,
        "ad_copy_matrix": acm,
        "partial_failure": partial_failure,
        "generation_metrics": {
            "mode": "copy_only",
            "elapsed_ms": int((time.perf_counter() - t0) * 1000),
            "quantity": int(request.quantity),
            "locales": acm.get("locales", []),
            "regions": regions_to_run,
            "regions_status": region_statuses,
        },
    }
    # Tiles + compliance scan (best-effort)
    try:
        from compliance import build_ad_copy_tiles, maybe_generate_rewrite_suggestions, scan_ad_copy

        tiles: list[dict[str, Any]] = []
        compliance_by_region: dict[str, Any] = {}
        for rid, one in region_acm.items():
            t = build_ad_copy_tiles(one, region_id=rid)
            tiles.extend(t)
            compliance_by_region[rid] = scan_ad_copy(t, platform_id=request.platform_id, region_id=rid)
        payload["ad_copy_tiles"] = tiles
        # overall compliance: worst risk_level + merged hits
        risk_order = {"ok": 0, "warn": 1, "block": 2, "unknown": 3}
        overall_risk = "ok"
        overall_hits: list[dict[str, Any]] = []
        for rid, c in compliance_by_region.items():
            rl = str((c or {}).get("risk_level") or "ok")
            if risk_order.get(rl, 0) > risk_order.get(overall_risk, 0):
                overall_risk = rl
            hits = (c or {}).get("hits")
            if isinstance(hits, list):
                overall_hits.extend(hits)
        compliance_obj: dict[str, Any] = {"risk_level": overall_risk, "hits": overall_hits[:200], "by_region": compliance_by_region}
        if request.compliance_suggest and active_client:
            tiles_by_id = {str(t.get("id")): t for t in tiles if isinstance(t, dict) and t.get("id")}
            suggestions = maybe_generate_rewrite_suggestions(
                cloud_client=active_client,
                hits=list(compliance_obj.get("hits") or []),
                tiles_by_id=tiles_by_id,
                output_mode=request.output_mode,
                model=model_id,
            )
            if suggestions:
                compliance_obj["suggestions"] = suggestions
        payload["compliance"] = compliance_obj
    except Exception:
        pass
    md_rel = export_markdown_after_generate(
        request.project_id,
        str(project_json.get("name") or "Unknown"),
        {
            "region": ",".join(regions_to_run),
            "platform": request.platform_id,
            "angle": request.angle_id,
            "region_name": ",".join(regions_to_run),
            "platform_name": str(platform_json.get("name") or request.platform_id) if isinstance(platform_json, dict) else request.platform_id,
            "angle_name": str(angle_json.get("name") or request.angle_id) if isinstance(angle_json, dict) else request.angle_id,
            "region_short": "",
            "platform_short": str(platform_json.get("short_name") or "") if isinstance(platform_json, dict) else "",
            "angle_short": str(angle_json.get("short_name") or "") if isinstance(angle_json, dict) else "",
            "visual_keywords": ", ".join(platform_json.get("visual_keywords", [])) if isinstance(platform_json, dict) and platform_json.get("visual_keywords") else "",
        },
        "cloud",
        payload,
        request.output_mode,
    )
    payload["markdown_path"] = md_rel
    record_generate_success(engine="cloud", measured_tokens=0, provider=provider_id)
    # Dedupe rag rule ids while preserving order, cap length
    seen_rid: set[str] = set()
    deduped_rag_ids: list[str] = []
    for rid in region_rag_ids:
        if rid in seen_rid:
            continue
        seen_rid.add(rid)
        deduped_rag_ids.append(rid)
        if len(deduped_rag_ids) >= 20:
            break
    _record_history(
        project_json,
        request,
        payload,
        "cloud",
        recipe_override={"region": ",".join(regions_to_run), "platform": request.platform_id, "angle": request.angle_id},
        factor_version=_compute_factor_version(*region_factor_objs),
        rag_rule_ids=deduped_rag_ids,
        draft_status="fallback" if partial_failure else "skipped",
        provider=provider_id,
        model=model_id,
    )
    return QuickCopyResponse(**payload)


@app.post("/api/quick-copy/refresh", response_model=QuickCopyResponse)
def refresh_copy(request: RefreshCopyRequest):
    import os, json, time
    from prompts import render_copy_prompt

    t0 = time.perf_counter()
    from projects_api import load_project as _load_project
    project_json = _load_project(request.project_id)
    if project_json is None:
        workspace_file = os.path.join(os.path.dirname(__file__), 'data', 'workspaces', f"{request.project_id}.json")
        if not os.path.exists(workspace_file):
            raise HTTPException(status_code=404, detail="Project not found")
        with open(workspace_file, 'r', encoding='utf-8') as f:
            project_json = json.load(f)

    history = project_json.get("history_log", [])
    if not isinstance(history, list) or not history:
        raise HTTPException(status_code=400, detail="No history_log found for refresh")
    found = None
    for item in reversed(history):
        if isinstance(item, dict) and str(item.get("id") or "") == str(request.base_script_id):
            found = item
            break
    if not found:
        raise HTTPException(status_code=404, detail="base_script_id not found in project history")

    recipe = (found.get("recipe") or {}) if isinstance(found, dict) else {}
    region_id = str(recipe.get("region") or "").strip()
    platform_id = str(recipe.get("platform") or "").strip()
    angle_id = str(recipe.get("angle") or "").strip()
    if not (region_id and platform_id and angle_id):
        raise HTTPException(status_code=400, detail="History entry missing recipe (region/platform/angle)")

    ensure_knowledge_layout()
    read_insight = read_insight_factor

    region_json = read_insight(region_id)
    platform_json = read_insight(platform_id)
    angle_json = read_insight(angle_id)
    # Phase 23/B1 — sanitize before prompt assembly.
    gi = sanitize_game_info((project_json.get("game_info") or {}) if isinstance(project_json, dict) else {})
    safe_name = sanitize_user_text(project_json.get('name'), max_len=200, allow_newlines=False)
    safe_tones = sanitize_list(request.tones, max_len=80, max_items=20)
    safe_locales = sanitize_list(request.locales, max_len=40, max_items=24)
    usp_dict = gi.get('usp', {})
    usp_str = "\\n".join([f"- {k}: {v}" for k, v in usp_dict.items()]) if isinstance(usp_dict, dict) else str(usp_dict)
    comp_set = ", ".join(gi.get('competitive_set', []))
    game_context = (
        f"Title: {safe_name}\\n"
        f"Core Loop: {gi.get('core_loop', '')}\\n"
        f"USP:\\n{usp_str}\\n"
        f"Persona: {gi.get('persona', '')}\\n"
        f"Visual DNA: {gi.get('visual_dna', '')}\\n"
        f"Competitive Set: {comp_set}"
    )
    base_script_context = sanitize_user_text(
        _script_to_context(found.get("script")), max_len=6000, allow_newlines=True
    )
    avoid_terms = _collect_avoid_terms(project_json)

    rag_context, rag_cits_r, rag_ev_r = retrieve_context_with_evidence(
        f"{region_id} {platform_id} {angle_id}",
        top_k=4,
        supplement=f"{region_id}\n{platform_id}\n{angle_id}\n{game_context}",
        region_boost_tokens=[str(region_json.get("name"))] if isinstance(region_json, dict) and region_json.get("name") else None,
        region_id=region_id,
        target_platform=platform_id,
    )
    refresh_rag_ids = _extract_rag_rule_ids(rag_ev_r, rag_cits_r)

    prompt = render_copy_prompt(
        game_context=game_context,
        culture_context=region_json if isinstance(region_json, dict) else {},
        platform_rules=platform_json if isinstance(platform_json, dict) else {},
        creative_logic=angle_json if isinstance(angle_json, dict) else {},
        quantity=request.quantity,
        primary_text_count=getattr(request, 'primary_text_count', 5),
        headline_count=getattr(request, 'headline_count', 10),
        hashtag_count=getattr(request, 'hashtag_count', 20),
        tones=safe_tones if 'safe_tones' in locals() else [],
        locales=safe_locales,
        base_script_context=base_script_context,
        avoid_terms=avoid_terms,
    )
    user_input = f"Market context (optional):\n{rag_context}\n\nReturn refreshed copy matrix JSON only."

    script_id = "COPY-" + uuid.uuid4().hex[:6].upper()
    # Phase 25/D2 — per-call routing for refresh.
    active_client, provider_id, model_id, *_ = resolve_llm_client(
        request.engine_provider, request.engine_model
    )
    result_obj: dict[str, Any] = {}
    if active_client:
        try:
            resp = active_client.chat.completions.create(
                model=model_id,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": user_input},
                ],
                timeout=float(os.getenv("DEEPSEEK_TIMEOUT_SECONDS", "90")),
            )
            result_obj = json.loads(resp.choices[0].message.content or "{}")
        except Exception as e:
            print(f"Refresh copy failed: {e}")
            result_obj = {}

    acm_raw = result_obj.get("ad_copy_matrix") if isinstance(result_obj, dict) else None
    acm = _normalize_ad_copy_matrix(acm_raw, quantity=request.quantity)
    payload = {
        "script_id": script_id,
        "project_id": request.project_id,
        "ad_copy_matrix": acm,
        "generation_metrics": {
            "mode": "copy_refresh",
            "elapsed_ms": int((time.perf_counter() - t0) * 1000),
            "quantity": int(request.quantity),
            "base_script_id": request.base_script_id,
            "locales": acm.get("locales", []),
        },
    }
    # Tiles + compliance scan (best-effort)
    try:
        from compliance import build_ad_copy_tiles, maybe_generate_rewrite_suggestions, scan_ad_copy

        tiles = build_ad_copy_tiles(acm, region_id=region_id)
        payload["ad_copy_tiles"] = tiles
        compliance_obj = scan_ad_copy(tiles, platform_id=platform_id, region_id=region_id)
        if request.compliance_suggest and active_client:
            tiles_by_id = {str(t.get("id")): t for t in tiles if isinstance(t, dict) and t.get("id")}
            suggestions = maybe_generate_rewrite_suggestions(
                cloud_client=active_client,
                hits=list(compliance_obj.get("hits") or []),
                tiles_by_id=tiles_by_id,
                output_mode=request.output_mode,
                model=model_id,
            )
            if suggestions:
                compliance_obj["suggestions"] = suggestions
        payload["compliance"] = compliance_obj
    except Exception:
        pass
    md_rel = export_markdown_after_generate(
        request.project_id,
        str(project_json.get("name") or "Unknown"),
        {
            "region": region_id,
            "platform": platform_id,
            "angle": angle_id,
            "region_name": str(region_json.get("name") or region_id) if isinstance(region_json, dict) else region_id,
            "platform_name": str(platform_json.get("name") or platform_id) if isinstance(platform_json, dict) else platform_id,
            "angle_name": str(angle_json.get("name") or angle_id) if isinstance(angle_json, dict) else angle_id,
            "region_short": str(region_json.get("short_name") or "") if isinstance(region_json, dict) else "",
            "platform_short": str(platform_json.get("short_name") or "") if isinstance(platform_json, dict) else "",
            "angle_short": str(angle_json.get("short_name") or "") if isinstance(angle_json, dict) else "",
            "visual_keywords": ", ".join(platform_json.get("visual_keywords", [])) if isinstance(platform_json, dict) and platform_json.get("visual_keywords") else "",
        },
        "cloud",
        payload,
        request.output_mode,
    )
    payload["markdown_path"] = md_rel
    record_generate_success(engine="cloud", measured_tokens=0, provider=provider_id)
    _record_history(
        project_json,
        request,
        payload,
        "cloud",
        recipe_override={"region": region_id, "platform": platform_id, "angle": angle_id},
        parent_script_id=str(request.base_script_id),
        factor_version=_compute_factor_version(region_json, platform_json, angle_json),
        rag_rule_ids=refresh_rag_ids,
        draft_status="skipped",
        provider=provider_id,
        model=model_id,
    )
    return QuickCopyResponse(**payload)


class RetryRegionRequest(BaseModel):
    project_id: str
    script_id: str
    region_id: str
    engine: str = "cloud"
    engine_provider: Optional[str] = None
    engine_model: Optional[str] = None


@app.post("/api/quick-copy/retry-region", response_model=QuickCopyResponse)
def retry_region(request: RetryRegionRequest):
    """Phase 23 / B4 — Re-run a single failed region for an existing copy script.

    Looks up the original history entry by ``script_id``, replays the copy
    generation for just ``region_id`` using the original recipe, and merges
    the new variants + ``regions_status`` back into both the response and
    the persisted history entry.
    """
    import os, json, time

    from prompts import render_copy_prompt

    t0 = time.perf_counter()
    from projects_api import load_project as _load_project
    project_json = _load_project(request.project_id)
    if project_json is None:
        workspace_file = os.path.join(os.path.dirname(__file__), 'data', 'workspaces', f"{request.project_id}.json")
        if not os.path.exists(workspace_file):
            raise HTTPException(status_code=404, detail="Project not found")
        with open(workspace_file, 'r', encoding='utf-8') as f:
            project_json = json.load(f)

    history = project_json.get("history_log") or []
    if not isinstance(history, list) or not history:
        raise HTTPException(status_code=400, detail="No history_log found for retry")
    found_idx = -1
    for idx, item in enumerate(history):
        if isinstance(item, dict) and str(item.get("id") or "") == str(request.script_id):
            found_idx = idx
            break
    if found_idx < 0:
        raise HTTPException(status_code=404, detail="script_id not found in project history")
    original = history[found_idx]
    if str(original.get("output_kind") or "") != "copy":
        raise HTTPException(status_code=400, detail="Retry-region is only valid for copy history entries")

    recipe = original.get("recipe") or {}
    platform_id = str(recipe.get("platform") or "").strip()
    angle_id = str(recipe.get("angle") or "").strip()
    if not platform_id or not angle_id:
        raise HTTPException(status_code=400, detail="History entry missing platform/angle recipe")

    # Pull quantity / tones / locales from the prior generation_metrics if present.
    metrics = original.get("generation_metrics") or {}
    quantity = int(metrics.get("quantity") or 20)
    prior_locales = list(metrics.get("locales") or [])
    # Convert "rid:xx" style keys back to base locales to avoid re-nesting.
    derived_locales = []
    seen = set()
    for lk in prior_locales:
        s = str(lk)
        base = s.split(":", 1)[1] if ":" in s else s
        if base and base not in seen:
            seen.add(base)
            derived_locales.append(base)
    if not derived_locales:
        derived_locales = ["en"]

    ensure_knowledge_layout()
    read_insight = read_insight_factor

    region_json = read_insight(request.region_id)
    platform_json = read_insight(platform_id)
    angle_json = read_insight(angle_id)
    gi = sanitize_game_info((project_json.get("game_info") or {}))
    safe_name = sanitize_user_text(project_json.get('name'), max_len=200, allow_newlines=False)
    safe_locales = sanitize_list(derived_locales, max_len=40, max_items=24)
    usp_dict = gi.get('usp', {})
    usp_str = "\\n".join([f"- {k}: {v}" for k, v in usp_dict.items()]) if isinstance(usp_dict, dict) else str(usp_dict)
    comp_set = ", ".join(gi.get('competitive_set', []))
    game_context = (
        f"Title: {safe_name}\\n"
        f"Core Loop: {gi.get('core_loop', '')}\\n"
        f"USP:\\n{usp_str}\\n"
        f"Persona: {gi.get('persona', '')}\\n"
        f"Visual DNA: {gi.get('visual_dna', '')}\\n"
        f"Competitive Set: {comp_set}"
    )
    avoid_terms = _collect_avoid_terms(project_json)

    rag_context, rag_cits_r, rag_ev_r = retrieve_context_with_evidence(
        f"{request.region_id} {platform_id} {angle_id}",
        top_k=4,
        supplement=f"{request.region_id}\n{platform_id}\n{angle_id}\n{game_context}",
        region_boost_tokens=[str(region_json.get("name"))] if isinstance(region_json, dict) and region_json.get("name") else None,
        region_id=request.region_id,
        target_platform=platform_id,
    )
    prompt = render_copy_prompt(
        game_context=game_context,
        culture_context=region_json if isinstance(region_json, dict) else {},
        platform_rules=platform_json if isinstance(platform_json, dict) else {},
        creative_logic=angle_json if isinstance(angle_json, dict) else {},
        quantity=quantity,
        primary_text_count=getattr(request, 'primary_text_count', 5) if 'request' in locals() else 5,
        headline_count=getattr(request, 'headline_count', 10) if 'request' in locals() else 10,
        hashtag_count=getattr(request, 'hashtag_count', 20) if 'request' in locals() else 20,
        tones=[],
        locales=safe_locales,
        avoid_terms=avoid_terms,
    )
    user_input = f"Market context (optional):\n{rag_context}\n\nReturn copy matrix JSON only."

    status = "skipped"
    result_obj: dict[str, Any] = {}
    err: str | None = None
    # Phase 25/D2 — per-call routing for retry-region.
    active_client, provider_id, model_id, *_ = resolve_llm_client(
        request.engine_provider, request.engine_model
    )
    if active_client:
        try:
            resp = active_client.chat.completions.create(
                model=model_id,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": user_input},
                ],
                timeout=float(os.getenv("DEEPSEEK_TIMEOUT_SECONDS", "90")),
            )
            result_obj = json.loads(resp.choices[0].message.content or "{}")
            status = "ok"
        except Exception as e:
            err = str(e)[:300]
            status = "failed"
    else:
        status = "failed"
        err = "cloud engine not configured"

    acm_raw = result_obj.get("ad_copy_matrix") if isinstance(result_obj, dict) else None
    new_one = _normalize_ad_copy_matrix(acm_raw, quantity=quantity)
    if status == "ok" and not new_one.get("variants"):
        status = "fallback"

    # Merge back into the history entry's ad_copy_matrix.
    hist_acm = original.get("ad_copy_matrix") if isinstance(original, dict) else None
    if not isinstance(hist_acm, dict):
        hist_acm = {"locales": [], "variants": {}, "regions": [], "regions_status": {}, "regions_error": {}}
    variants = hist_acm.setdefault("variants", {})
    locales_out = list(hist_acm.get("locales") or [])
    # Update each locale under this region.
    for loc in (new_one.get("locales") or []):
        key = f"{request.region_id}:{loc}"
        variants[key] = (new_one.get("variants") or {}).get(loc) or {}
        if key not in locales_out:
            locales_out.append(key)
    hist_acm["locales"] = locales_out
    regions = list(hist_acm.get("regions") or [])
    if request.region_id not in regions:
        regions.append(request.region_id)
    hist_acm["regions"] = regions
    statuses = dict(hist_acm.get("regions_status") or {})
    errors = dict(hist_acm.get("regions_error") or {})
    statuses[request.region_id] = status
    if err:
        errors[request.region_id] = err
    elif request.region_id in errors:
        errors.pop(request.region_id, None)
    hist_acm["regions_status"] = statuses
    hist_acm["regions_error"] = errors

    original["ad_copy_matrix"] = hist_acm
    attempted = any(s != "skipped" for s in statuses.values())
    partial_failure = attempted and any(s != "ok" for s in statuses.values())
    original["partial_failure"] = partial_failure
    gm = original.get("generation_metrics") or {}
    gm["regions_status"] = statuses
    gm["elapsed_ms_retry"] = int((time.perf_counter() - t0) * 1000)
    original["generation_metrics"] = gm
    try:
        from projects_api import save_project
        save_project(project_json)
    except Exception as e:
        print(f"retry-region save failed: {e}")

    payload = {
        "script_id": original.get("id") or request.script_id,
        "project_id": request.project_id,
        "ad_copy_matrix": hist_acm,
        "markdown_path": original.get("markdown_path"),
        "generation_metrics": gm,
        "ad_copy_tiles": original.get("ad_copy_tiles"),
        "compliance": original.get("compliance"),
        "partial_failure": partial_failure,
    }
    return QuickCopyResponse(**payload)


@app.post("/api/export/pdf")
def export_pdf(request: GeneratePdfRequest):
    if not _is_valid_script_payload(request.data):
        raise HTTPException(status_code=400, detail="Invalid script payload for PDF export.")
    if _looks_like_error_placeholder(request.data):
        raise HTTPException(status_code=400, detail="Refusing to export error placeholder content.")
    try:
        pdf_b64 = generate_pdf_report(request.data)
        return {"success": True, "pdf_base64": pdf_b64}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class DeliveryPackRequest(BaseModel):
    data: dict[str, Any] = Field(default_factory=dict)
    markdown_path: Optional[str] = None
    project_name: Optional[str] = None


def _csv_escape(value: Any) -> str:
    s = "" if value is None else str(value)
    if any(ch in s for ch in [",", '"', "\n", "\r"]):
        return '"' + s.replace('"', '""') + '"'
    return s


def _build_ad_copy_csv(acm: dict[str, Any]) -> str:
    if not isinstance(acm, dict):
        return ""
    locales_raw = acm.get("locales")
    locales = [str(x) for x in locales_raw] if isinstance(locales_raw, list) else [str(acm.get("default_locale") or "en")]
    variants = acm.get("variants") if isinstance(acm.get("variants"), dict) else {}
    rows: list[list[str]] = [["locale", "slot", "headline", "primary_text", "hashtags"]]
    for loc in locales:
        v = variants.get(loc) if isinstance(variants, dict) else {}
        heads = v.get("headlines") if isinstance(v, dict) else []
        prims = v.get("primary_texts") if isinstance(v, dict) else []
        tags = v.get("hashtags") if isinstance(v, dict) else []
        heads = heads if isinstance(heads, list) else []
        prims = prims if isinstance(prims, list) else []
        tags = tags if isinstance(tags, list) else []
        n = max(len(heads), len(prims), 1)
        tag_line = " ".join(str(x) for x in tags[:20])
        for i in range(n):
            rows.append(
                [
                    loc,
                    str(i + 1),
                    str(heads[i]) if i < len(heads) else "",
                    str(prims[i % max(len(prims), 1)]) if prims else "",
                    tag_line if i == 0 else "",
                ]
            )
    return "\n".join(",".join(_csv_escape(c) for c in r) for r in rows) + "\n"


@app.post("/api/export/delivery-pack")
def export_delivery_pack(request: DeliveryPackRequest):
    """Phase 24/C4 — Bundle a generation's artifacts (markdown + structured
    JSON + CSV matrix + README index) into a single zip ready for handoff."""
    import base64
    import io
    import zipfile
    from datetime import datetime

    data = request.data or {}
    if not isinstance(data, dict):
        raise HTTPException(status_code=400, detail="data must be an object")

    script_id = str(data.get("script_id") or "output")
    safe_script_id = re.sub(r"[^A-Za-z0-9._-]", "_", script_id)
    project_name = str(request.project_name or data.get("project_id") or "").strip()
    safe_project = re.sub(r"[^A-Za-z0-9._-]", "_", project_name) if project_name else ""

    markdown_body = ""
    md_path = request.markdown_path or data.get("markdown_path")
    if md_path:
        try:
            abs_path, _ = _resolve_out_path(md_path)
            markdown_body = Path(abs_path).read_text(encoding="utf-8", errors="replace")
        except HTTPException:
            markdown_body = ""
        except Exception:
            markdown_body = ""

    acm = data.get("ad_copy_matrix") if isinstance(data.get("ad_copy_matrix"), dict) else {}
    csv_body = _build_ad_copy_csv(acm) if acm else ""

    now_iso = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    readme_lines = [
        f"# Delivery Pack — {script_id}",
        "",
        f"Generated at: {now_iso}",
        f"Project: {project_name or '(unspecified)'}",
        "",
        "## Contents",
        "",
        "- `README.md` — this index",
        "- `script.md` — human-readable markdown (storyboard / SOP body)" if markdown_body else "- `script.md` — not available (no markdown_path resolved)",
        "- `ad_copy.csv` — locale × slot matrix" if csv_body else "- `ad_copy.csv` — not available (no ad_copy_matrix)",
        "- `payload.json` — full structured response (compliance, metrics, matrix)",
        "",
        "## Integrity",
        "",
        f"- script_id: `{script_id}`",
        f"- locales: `{', '.join([str(x) for x in (acm.get('locales') or [])]) if acm else '(none)'}`",
        f"- partial_failure: `{bool(data.get('partial_failure'))}`",
        "",
        "Generated by AdCreative AI Script Generator · Phase 24 Delivery Pack.",
        "",
    ]
    readme_body = "\n".join(readme_lines)

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("README.md", readme_body)
        if markdown_body:
            zf.writestr("script.md", markdown_body)
        if csv_body:
            zf.writestr("ad_copy.csv", csv_body)
        zf.writestr(
            "payload.json",
            json.dumps(data, ensure_ascii=False, indent=2, default=str),
        )

    zip_bytes = buffer.getvalue()
    zip_b64 = base64.b64encode(zip_bytes).decode("ascii")
    filename_parts = ["delivery", safe_project or safe_script_id, safe_script_id]
    filename = "_".join([p for p in filename_parts if p]) + ".zip"
    return {
        "success": True,
        "filename": filename,
        "size_bytes": len(zip_bytes),
        "zip_base64": zip_b64,
        "entries": [
            "README.md",
            *(["script.md"] if markdown_body else []),
            *(["ad_copy.csv"] if csv_body else []),
            "payload.json",
        ],
    }

class ExtractUrlRequest(BaseModel):
    url: str
    engine: str = Field(
        default="cloud",
        description="Engine identifier. Only 'cloud' (DeepSeek) is supported; legacy field kept for backward compat.",
    )
    engine_provider: Optional[str] = None
    engine_model: Optional[str] = None
    output_lang: str = Field(default="cn", description="Output language: 'cn' or 'en'")

class ExtractTextRequest(BaseModel):
    text: str
    engine: str = "cloud"
    engine_provider: Optional[str] = None
    engine_model: Optional[str] = None
    output_lang: str = Field(default="cn", description="Output language: 'cn' or 'en'")

class TranslateDnaRequest(BaseModel):
    game_info: dict
    target_lang: str = "en"
    engine_provider: Optional[str] = None
    engine_model: Optional[str] = None
    category: Optional[str] = None

class ExtractUrlResponse(BaseModel):
    success: bool
    title: str = ""
    extracted_usp: str = ""
    error: str = ""


@app.get("/api/usage/summary")
def usage_summary():
    """Daily usage snapshot: Oracle ops + LLM tokens (provider usage when available)."""
    return usage_get_summary()


@app.get("/api/compliance/rules")
def compliance_rules():
    """Phase 24/C3 — Read-only snapshot of compliance rules for the admin page.

    Returns the entire risk_terms.json shape (global / platform_overrides /
    region_overrides) plus lightweight counters so the UI can render
    severity-sorted groupings without re-parsing.
    """
    from compliance import load_risk_terms

    data = load_risk_terms()
    global_terms = [t for t in (data.get("global") or []) if isinstance(t, dict) and t.get("term")]
    platform_overrides = {
        str(k): [t for t in (v or []) if isinstance(t, dict) and t.get("term")]
        for k, v in (data.get("platform_overrides") or {}).items()
    }
    region_overrides = {
        str(k): [t for t in (v or []) if isinstance(t, dict) and t.get("term")]
        for k, v in (data.get("region_overrides") or {}).items()
    }
    by_severity: dict[str, int] = {}
    for t in global_terms:
        sev = str(t.get("severity") or "warn").lower()
        by_severity[sev] = by_severity.get(sev, 0) + 1

    return {
        "rules": {
            "global": global_terms,
            "platform_overrides": platform_overrides,
            "region_overrides": region_overrides,
        },
        "summary": {
            "total_global": len(global_terms),
            "total_platform_overrides": sum(len(v) for v in platform_overrides.values()),
            "total_region_overrides": sum(len(v) for v in region_overrides.values()),
            "by_severity": by_severity,
        },
    }


@app.post("/api/compliance/reload")
def reload_compliance_rules():
    """Hot reload risk terms from risk_terms.json or DB without restarting the backend."""
    from compliance import invalidate_cache, load_risk_terms
    invalidate_cache()
    cfg = load_risk_terms()
    return {"success": True, "global_terms": len(cfg.get("global") or [])}


@app.get("/api/compliance/stats")
def compliance_stats(project_id: Optional[str] = None):
    """Phase 24/C3 — Aggregated compliance hits across *all* projects' history.
    
    Optimized: Direct SQL query on history_log avoids O(N) full project parsing.
    """
    from db import fetchall
    import json
    from compliance import load_risk_terms

    term_counts: dict[str, int] = {}
    severity_counts: dict[str, int] = {"warn": 0, "block": 0, "ok": 0}
    recent_hits: list[dict[str, Any]] = []
    total_records = 0
    risky_records = 0

    if project_id:
        rows = fetchall("SELECT payload_json, created_at, project_id, script_id FROM history_log WHERE project_id = ? ORDER BY created_at DESC", (project_id,))
    else:
        rows = fetchall("SELECT payload_json, created_at, project_id, script_id FROM history_log ORDER BY created_at DESC")

    for r in rows:
        try:
            entry = json.loads(r["payload_json"] or "{}")
        except Exception:
            continue
            
        total_records += 1
        comp = entry.get("compliance") or {}
        rl = str(comp.get("risk_level") or "ok").lower()
        severity_counts[rl] = severity_counts.get(rl, 0) + 1
        hits = comp.get("hits") or []
        if hits:
            risky_records += 1
        for h in hits if isinstance(hits, list) else []:
            term = str((h or {}).get("term") or "").strip()
            if not term:
                continue
            term_counts[term] = term_counts.get(term, 0) + 1
            
        # Collect top 40 recent hits globally across valid hits
        if len(recent_hits) < 40 and hits:
            for h in (hits or [])[:3]:
                recent_hits.append(
                    {
                        "project_id": r["project_id"],
                        "script_id": r["script_id"] or entry.get("id"),
                        "term": (h or {}).get("term"),
                        "severity": (h or {}).get("severity"),
                        "timestamp": r["created_at"] or entry.get("timestamp"),
                    }
                )

    top_terms = sorted(
        [{"term": k, "count": v} for k, v in term_counts.items()],
        key=lambda x: (-x["count"], x["term"]),
    )[:50]
    recent_hits = recent_hits[:40]

    # Avoid-terms preview mirrors the aggregation rule used at prompt time
    # (see _collect_avoid_terms) so ops can sanity-check the negative list.
    avoid_preview: list[str] = []
    seen_lower: set[str] = set()
    for item in top_terms:
        term = str(item["term"]).strip()
        if term and term.lower() not in seen_lower:
            avoid_preview.append(term)
            seen_lower.add(term)
        if len(avoid_preview) >= 12:
            break

    from compliance import _risk_terms_path as _rtp  # internal but safe for read-only path display

    return {
        "total_records": total_records,
        "risky_records": risky_records,
        "severity_counts": severity_counts,
        "top_terms": top_terms,
        "recent_hits": recent_hits,
        "avoid_terms_preview": avoid_preview,
        "rules_path": str(_rtp()),
        "rules_summary": {
            "global": len((load_risk_terms().get("global") or [])),
        },
    }


class EstimateRequest(BaseModel):
    kind: str = Field(
        default="generate_full",
        description="One of: generate_full | generate_draft | quick_copy | refresh_copy",
    )
    mode: Optional[str] = None
    quantity: Optional[int] = None
    locales: Optional[list[str]] = None
    region_ids: Optional[list[str]] = None
    compliance_suggest: Optional[bool] = False
    # Phase 25 / D3 — price re-calc per provider.
    engine_provider: Optional[str] = None


@app.post("/api/estimate")
def estimate_cost(request: EstimateRequest):
    """Phase 23/B2 — Pre-flight token + price + budget projection.

    Phase 25/D3 extends the response with provider-aware pricing.
    """
    from cost_estimator import estimate_with_budget

    params: dict[str, Any] = {
        "mode": request.mode,
        "quantity": request.quantity,
        "locales": request.locales,
        "region_ids": request.region_ids,
        "compliance_suggest": request.compliance_suggest,
        "engine_provider": request.engine_provider,
    }
    summary = usage_get_summary()
    return estimate_with_budget(request.kind, params, summary)


@app.get("/api/knowledge/stats")
def knowledge_stats():
    """Phase 26/E — surface retrieval backend health for the Refinery panel."""
    from refinery import get_collection_stats

    return get_collection_stats()


@app.post("/api/knowledge/reindex")
def knowledge_reindex():
    """Phase 26/E — force a vector rebuild (e.g. after switching embed model)."""
    from refinery import rebuild_vectors

    return rebuild_vectors()


@app.get("/api/providers")
def providers_list():
    """Phase 25/D3 — Read-only provider catalog for the Engine Selector UI.

    Phase 27/F extends the response with DB-backed override markers
    (``has_api_key``, ``api_key_source``, ``api_key_mask``, ``extra_models``,
    ``last_test_ok`` …) so the frontend can drive an "edit my provider"
    settings page without exposing secrets.
    """
    from providers import list_providers as _list_providers, default_provider_id, show_experimental_providers

    items = _list_providers()
    return {
        "default_provider_id": default_provider_id(),
        "fallback_providers": _load_fallback_providers(),
        "providers": items,
        "show_experimental": show_experimental_providers(),
    }


# ---------------------------------------------------------------------------
# Phase 27 / F — Provider Settings API (user-editable keys / base url / models)
# ---------------------------------------------------------------------------


class ProviderSettingsUpdate(BaseModel):
    default_model: Optional[str] = None
    extra_models: Optional[List[str]] = None
    enabled: Optional[bool] = None


def _require_known_provider(provider_id: str):
    from providers import PROVIDERS

    if not any(p.id == provider_id for p in PROVIDERS):
        raise HTTPException(status_code=404, detail=f"Unknown provider '{provider_id}'")


@app.put("/api/providers/settings/{provider_id}")
def provider_settings_update(provider_id: str, body: ProviderSettingsUpdate):
    """Phase 27/F — upsert the DB override for a single provider.

    The response is the full merged catalog entry (same shape as one item in
    ``/api/providers``) so the UI can refresh without a second round-trip.
    """
    _require_known_provider(provider_id)
    from providers import invalidate_client_cache, list_providers as _list_providers
    from providers_store import upsert_settings

    # Phase 23/B1 — even settings values get sanitized: zero-width / control
    # characters could smuggle payloads into proxy logs or env-like renderers.
    def _sanitize(val, max_len=4000):
        if val is None:
            return None
        s = sanitize_user_text(val, max_len=max_len, allow_newlines=False)
        return s

    cleaned_extra = None
    if body.extra_models is not None:
        cleaned_extra = [
            _sanitize(m, max_len=200) for m in body.extra_models if m and _sanitize(m, max_len=200)
        ]

    upsert_settings(
        provider_id,
        default_model=_sanitize(body.default_model, max_len=200),
        extra_models=cleaned_extra,
        enabled=body.enabled,
    )
    invalidate_client_cache(provider_id)

    for entry in _list_providers():
        if entry["id"] == provider_id:
            return {"success": True, "provider": entry}
    return {"success": True}


@app.delete("/api/providers/settings/{provider_id}")
def provider_settings_delete(provider_id: str):
    """Wipe the DB override row; provider falls back to env / defaults."""
    _require_known_provider(provider_id)
    from providers import invalidate_client_cache, list_providers as _list_providers
    from providers_store import delete_settings

    delete_settings(provider_id)
    invalidate_client_cache(provider_id)
    for entry in _list_providers():
        if entry["id"] == provider_id:
            return {"success": True, "provider": entry}
    return {"success": True}


class EnvKeyUpdateRequest(BaseModel):
    api_key: str

@app.put("/api/providers/{provider_id}/key")
def update_provider_env_key(provider_id: str, body: EnvKeyUpdateRequest):
    """Write the API key directly to the .env file and process environment."""
    _require_known_provider(provider_id)
    from providers import get_provider_spec, invalidate_client_cache, list_providers as _list_providers
    from env_config import update_env_var
    
    spec = get_provider_spec(provider_id)
    
    # Write to .env and os.environ
    update_env_var(spec.api_key_env, body.api_key.strip())
    
    # Invalidate cache so the new key is picked up
    invalidate_client_cache(provider_id)
    
    for entry in _list_providers():
        if entry["id"] == provider_id:
            return {"success": True, "provider": entry}
    return {"success": True}


class SetDefaultProviderRequest(BaseModel):
    provider_id: str

@app.put("/api/providers/set-default")
def set_default_provider(req: SetDefaultProviderRequest):
    """Set the system-wide global default provider."""
    # Special keyword "auto" to revert to fallback logic
    if req.provider_id != "auto":
        _require_known_provider(req.provider_id)
        target = req.provider_id
    else:
        target = ""
        
    import os, json
    settings_file = os.path.join(os.path.dirname(__file__), "data", "app_settings.json")
    os.makedirs(os.path.dirname(settings_file), exist_ok=True)
    
    data = {}
    if os.path.exists(settings_file):
        try:
            with open(settings_file, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            pass
            
    if target:
        data["default_provider_id"] = target
    else:
        data.pop("default_provider_id", None)
        
    tmp_file = settings_file + ".tmp"
    with open(tmp_file, "w", encoding="utf-8") as f:
        json.dump(data, f)
    os.replace(tmp_file, settings_file)
        
    from providers import list_providers as _list_providers, default_provider_id as _def_id
    return {
        "success": True,
        "default_provider_id": _def_id(),
        "providers": _list_providers()
    }



class SetFallbackOrderRequest(BaseModel):
    provider_ids: list[str]

@app.put("/api/providers/set-fallback-order")
def set_fallback_order(req: SetFallbackOrderRequest):
    """Set the ordered failover provider list for intelligent retry (429/503)."""
    import json as _json
    for pid in req.provider_ids:
        _require_known_provider(pid)
    settings_file = os.path.join(os.path.dirname(__file__), "data", "app_settings.json")
    os.makedirs(os.path.dirname(settings_file), exist_ok=True)
    data = {}
    if os.path.exists(settings_file):
        try:
            with open(settings_file, "r", encoding="utf-8") as f:
                data = _json.load(f)
        except Exception:
            pass
    data["fallback_providers"] = req.provider_ids
    tmp_file = settings_file + ".tmp"
    with open(tmp_file, "w", encoding="utf-8") as f:
        _json.dump(data, f)
    import os
    os.replace(tmp_file, settings_file)
    return {"success": True, "fallback_providers": req.provider_ids}


@app.post("/api/providers/{provider_id}/test")
def provider_test_connection(provider_id: str):
    """Ping the provider with a 'Hello' message to verify chat completions."""
    _require_known_provider(provider_id)
    from providers import get_client, resolve_model
    from providers_store import record_test_result

    client = get_client(provider_id)
    if client is None:
        record_test_result(provider_id, ok=False, note="no api key configured")
        return {"success": False, "ok": False, "error": "no api key configured"}

    try:
        model_id = resolve_model(provider_id, None)
        resp = client.chat.completions.create(
            model=model_id,
            messages=[{"role": "user", "content": f"你好 {model_id}"}],
            max_tokens=100,
            temperature=0.7,
        )
        reply = resp.choices[0].message.content
        record_test_result(provider_id, ok=True, note=f"chat ok via {model_id}")
        return {"success": True, "ok": True, "method": "chat", "model": model_id, "reply": reply}
    except Exception as exc:  # pragma: no cover - network-path
        err = f"{type(exc).__name__}: {str(exc)[:200]}"
        record_test_result(provider_id, ok=False, note=f"chat: {err}")
        return {"success": False, "ok": False, "error": err}


# Phase 27 · F7 — sanitize the raw /v1/models output so the Engine Selector
# stays clean. Providers like Alibaba Bailian return ~300 entries mixing
# chat, image, speech, embedding, rerank, ASR/TTS and versioned snapshots
# of the same model; pasting those straight into the DB made the settings
# page unusable (see user bug report: "模型列表未规范化").
_NON_CHAT_PATTERNS = (
    "embedding", "embed-", "-embed", "rerank", "-asr", "asr-",
    "-tts", "tts-", "-speech", "speech-", "-ocr", "ocr-", "-vl-",
    "-vision", "vision-", "-image", "image-", "-img-", "img-",
    "-audio", "audio-", "moderation", "whisper", "bge-", "-e5-",
    "-w2v", "-sv-", "dall-e", "stable-diffusion", "-video", "video-",
    "cosyvoice", "paraformer",
)

# Drop dated snapshots when the base model id is already present. A trailing
# "-YYYY-MM-DD" or "-YYYYMMDD" is treated as a version suffix.
_DATE_RE = re.compile(r"-(20\d{2})[-_]?(\d{2})[-_]?(\d{2})$")


def _normalize_chat_model_ids(raw_ids: list[str]) -> list[str]:
    kept: list[str] = []
    lowered_seen: set[str] = set()
    for mid in raw_ids:
        lc = mid.lower()
        if any(tok in lc for tok in _NON_CHAT_PATTERNS):
            continue
        key = lc
        if key in lowered_seen:
            continue
        lowered_seen.add(key)
        kept.append(mid)
    # Collapse dated variants: if an *undated* base id is among kept, drop
    # dated siblings. If only dated variants exist (e.g. gpt-4o-2024-08-06
    # with no bare gpt-4o), keep them so the model stays reachable.
    undated_bases = {k.lower() for k in kept if _DATE_RE.sub("", k.lower()) == k.lower()}
    final: list[str] = []
    for mid in kept:
        lc = mid.lower()
        stripped = _DATE_RE.sub("", lc)
        if stripped != lc and stripped in undated_bases:
            continue
        final.append(mid)
    return final


@app.post("/api/providers/{provider_id}/fetch-models")
def provider_fetch_models(provider_id: str):
    """Live-query the provider's OpenAI-compatible ``/v1/models`` endpoint.

    The returned ids are merged into ``provider_settings.extra_models`` so the
    Engine Selector dropdown picks them up. Providers that don't expose a
    public models endpoint (e.g. certain ZEN tiers) surface a clear error and
    leave the saved list intact.
    """
    _require_known_provider(provider_id)
    from providers import get_client, get_model_choices
    from providers_store import upsert_settings

    client = get_client(provider_id)
    if client is None:
        raise HTTPException(
            status_code=400, detail="Provider has no API key configured"
        )
    try:
        resp = client.models.list()
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"models.list failed: {type(exc).__name__}: {str(exc)[:200]}",
        )
    raw_ids: list[str] = []
    for m in getattr(resp, "data", []) or []:
        mid = getattr(m, "id", None) or (m.get("id") if isinstance(m, dict) else None)
        if mid:
            s = str(mid).strip()
            if s and s not in raw_ids:
                raw_ids.append(s)
    if not raw_ids:
        raise HTTPException(status_code=502, detail="Provider returned no models")

    ids = _normalize_chat_model_ids(raw_ids)
    if not ids:
        raise HTTPException(
            status_code=502,
            detail="Provider returned models but none look like chat-completion models",
        )

    # Merge onto existing extras while keeping user-typed entries not in the
    # live roster (proxy accounts sometimes hide admin-only models). Run the
    # existing extras through the same normalizer so that previously-saved
    # junk (embedding/ASR/TTS/image/dated snapshots from an older build of
    # this endpoint) gets cleaned up automatically on re-fetch.
    existing_extras_raw = [
        m for m in get_model_choices(provider_id) if m  # merged choices first
    ]
    existing_extras_clean = _normalize_chat_model_ids(existing_extras_raw)
    merged: list[str] = []
    for s in ids + existing_extras_clean:
        if s and s not in merged:
            merged.append(s)
    # Persist all fetched models. The frontend combobox will de-duplicate.
    extras_to_save = merged
    upsert_settings(provider_id, extra_models=extras_to_save)
    return {
        "success": True,
        "fetched": ids,
        "merged": merged,
        "dropped_count": len(raw_ids) - len(ids),
    }


@app.post("/api/providers/{provider_id}/factor-test")
def provider_factor_test(provider_id: str):
    """Factor Compliance Test — sends a strict JSON-schema stress test to the LLM
    and returns a compliance_score (0–100) measuring how faithfully the model
    produces a structured strategy factor output.
    """
    import json as _json
    _require_known_provider(provider_id)
    from providers import get_client, resolve_model, is_json_mode_supported

    client = get_client(provider_id)
    if client is None:
        return {"ok": False, "score": 0, "error": "No API key configured for this provider."}

    model_id = resolve_model(provider_id, None)
    supports_json = is_json_mode_supported(provider_id)

    # The schema we test against — AngleFactorSchema is the most demanding
    # because it has the most unique dimension-specific fields.
    test_schema = {
        "name": "string — full display name",
        "short_name": "string — abbreviated name (≤6 chars)",
        "description": "string — strategy overview (≥50 chars)",
        "focus": ["string — imperative directive #1", "string — imperative directive #2", "string — imperative directive #3"],
        "rules": ["string — production spec rule #1", "string — production spec rule #2"],
        "constraints": ["string — absolute prohibition #1", "string — absolute prohibition #2"],
        "core_emotion": "string — primary psychological trigger",
        "visual_tempo": "string — pacing pattern (e.g. Slow → Fast → Cut)",
        "logic_steps": [
            "1. Step one of the conversion funnel",
            "2. Step two of the conversion funnel",
            "3. Step three",
            "4. CTA step"
        ],
        "audio_strategy": "string — sound design directive (≥30 chars)"
    }

    system_prompt = f"""You are an Ad Creative Strategy AI. Your ONLY task is to output a single, valid JSON object.
The JSON must conform EXACTLY to this schema (all fields are required, all arrays must have at least 2 items):

{_json.dumps(test_schema, indent=2, ensure_ascii=False)}

Topic: Generate a strategy factor for the "Rage Bait / Satisfying Compilation" video creative angle.
Output ONLY the JSON object. No markdown, no preamble, no explanation."""

    if not supports_json:
        system_prompt += "\nIMPORTANT: Output raw JSON only, no code fences or backticks."

    try:
        kwargs: dict = {
            "model": model_id,
            "messages": [{"role": "user", "content": system_prompt}],
            "max_tokens": 800,
            "temperature": 0.3,
        }
        if supports_json:
            kwargs["response_format"] = {"type": "json_object"}

        resp = client.chat.completions.create(**kwargs)
        raw = resp.choices[0].message.content or ""

        # Parse JSON — strip markdown fences if present
        clean = raw.strip()
        if clean.startswith("```"):
            clean = clean.split("```")[1]
            if clean.startswith("json"):
                clean = clean[4:]
        parsed = _json.loads(clean.strip())

        # Score: award points per required field that is present + non-trivial
        required_fields = [
            ("name", lambda v: isinstance(v, str) and len(v) > 2),
            ("short_name", lambda v: isinstance(v, str) and len(v) > 0),
            ("description", lambda v: isinstance(v, str) and len(v) >= 30),
            ("focus", lambda v: isinstance(v, list) and len(v) >= 2),
            ("rules", lambda v: isinstance(v, list) and len(v) >= 2),
            ("constraints", lambda v: isinstance(v, list) and len(v) >= 2),
            ("core_emotion", lambda v: isinstance(v, str) and len(v) > 5),
            ("visual_tempo", lambda v: isinstance(v, str) and len(v) > 5),
            ("logic_steps", lambda v: isinstance(v, list) and len(v) >= 3),
            ("audio_strategy", lambda v: isinstance(v, str) and len(v) > 10),
        ]
        passed = sum(1 for field, check in required_fields if check(parsed.get(field)))
        score = round((passed / len(required_fields)) * 100)
        detail_lines = [
            f"{'✅' if check(parsed.get(f)) else '❌'} {f}"
            for f, check in required_fields
        ]

        return {
            "ok": score >= 70,
            "score": score,
            "model": model_id,
            "passed_fields": passed,
            "total_fields": len(required_fields),
            "detail": "\n".join(detail_lines),
            "raw_output": raw[:600],
        }

    except _json.JSONDecodeError as e:
        return {"ok": False, "score": 0, "error": f"JSON parse failed: {str(e)[:120]}", "raw_output": raw[:400] if 'raw' in dir() else ""}
    except Exception as exc:
        return {"ok": False, "score": 0, "error": f"{type(exc).__name__}: {str(exc)[:200]}"}
    finally:
        # Persist score regardless of pass/fail (score=0 on exception is recorded)
        try:
            from providers_store import record_compliance_result
            final_score = locals().get("score", 0)
            if isinstance(final_score, int):
                record_compliance_result(provider_id, score=final_score, model_id=model_id)
        except Exception:
            pass


@app.post("/api/extract-url", response_model=ExtractUrlResponse)
def extract_url(request: ExtractUrlRequest):
    # Phase 23/B1 — URL itself is treated as untrusted; the scraper fetches
    # strictly by URL but any text we later inline into the prompt gets
    # sanitize_user_text() to strip zero-width / role markers.
    safe_url = sanitize_user_text(request.url, max_len=2048, allow_newlines=False)
    if not safe_url:
        return {"success": False, "error": "Invalid URL."}
    data = fetch_playstore_data(safe_url)

    if not data["success"]:
        return {"success": False, "error": data.get("error", "Failed to parse.")}

    extracted_usp = ""
    extract_tokens: int | None = None
    extract_used_llm = False
    # Phase 25/D2 — per-call routing for extract.
    active_client, provider_id, model_id, *_ = resolve_llm_client(
        request.engine_provider, request.engine_model
    )

    if active_client:
        from scraper import get_extract_usp_prompt, _serialize_director_archive, _validate_director_archive
        from sanitize import wrap_user_input

        safe_title = sanitize_user_text(data.get("title"), max_len=200, allow_newlines=False)
        safe_genre = sanitize_user_text(data.get("genre") or "Game", max_len=80, allow_newlines=False)
        safe_installs = sanitize_user_text(data.get("installs") or "Unknown", max_len=80, allow_newlines=False)
        safe_desc = sanitize_user_text(data.get("description", "")[:1500], max_len=1500)
        safe_recent = sanitize_user_text(data.get("recentChanges", "")[:300], max_len=300)

        user_prompt_body = (
            f"Game title: {safe_title}\n"
            f"Genre (store): {safe_genre}\n"
            f"Installs (store label): {safe_installs}\n"
            f"Recent changes / What's new:\n{safe_recent}\n\n"
            f"--- Raw store description (may truncate) ---\n{safe_desc}\n"
        )
        user_prompt = wrap_user_input(user_prompt_body, label="store_page_scrape")
        try:
            response = active_client.chat.completions.create(
                model=model_id,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": get_extract_usp_prompt(request.output_lang)},
                    {"role": "user", "content": user_prompt},
                ],
                timeout=float(os.getenv("DEEPSEEK_TIMEOUT_SECONDS", "60")),
            )
            raw_content = response.choices[0].message.content
            parsed = json.loads(raw_content)
            if _validate_director_archive(parsed):
                extracted_usp = _serialize_director_archive(parsed, installs, recent_changes)
                extract_tokens = total_tokens_from_completion(response)
                extract_used_llm = True
            else:
                raise ValueError("JSON validation failed")
        except Exception as e:
            print(f"Cloud extract failed, using rule-based fallback: {e}")

    if not extracted_usp:
        from scraper import extract_usp_via_llm_with_usage
        extracted_usp, extract_tokens, extract_used_llm = extract_usp_via_llm_with_usage(data["title"], data)

    record_extract_url_success(
        "cloud",
        measured_tokens=extract_tokens,
        used_llm=extract_used_llm,
        provider=provider_id if extract_used_llm else None,
    )
    return {
        "success": True,
        "title": data["title"],
        "extracted_usp": extracted_usp,
    }

@app.post("/api/extract-text", response_model=ExtractUrlResponse)
def extract_text(request: ExtractTextRequest):
    safe_text = sanitize_user_text(request.text, max_len=15000, allow_newlines=True)
    if not safe_text:
        return {"success": False, "error": "Empty text provided."}
        
    active_client, provider_id, model_id, *_ = resolve_llm_client(
        request.engine_provider, request.engine_model
    )
    if not active_client:
        return {"success": False, "error": "Cloud engine not configured."}

    system_prompt = """You are an elite Game Analysis AI and Senior UA Creative Director.
Your task is to analyze the provided unstructured game report/breakdown and extract a structured 5-Pillar Project DNA.
CRITICAL RULE: You MUST output profound, rich analysis IN CHINESE. Do NOT overly truncate the insights. Preserve the strategic depth, mechanics descriptions, and psychological triggers from the original text.

Output MUST be a pure JSON object:
{
  "title": "Game Name (if found, else empty)",
  "core_loop": "详细的核心玩法循环与玩家体验轨迹（中文详述）",
  "usp": {
    "Gameplay": "玩法设计上的核心爽点与差异化钩子（中文详述）",
    "Visual": "美术风格、视觉表现力及带给玩家的感官刺激（中文详述）",
    "Social": "社交互动、排行榜、养成反馈等长线钩子（中文详述）",
    "Other": "情感共鸣、解压、ASMR等其他深层心理学触发器（中文详述）"
  },
  "persona": "精确的目标受众画像、年龄层及他们的核心心理诉求（中文详述）",
  "visual_dna": "整体视觉基因与材质光影特征总结（中文）",
  "competitive_set": ["竞品1", "竞品2"]
}
Only output the JSON object. Do not include markdown formatting or comments."""

    user_prompt = f"--- Raw Report ---\n{safe_text}\n"

    try:
        response = active_client.chat.completions.create(
            model=model_id,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            timeout=float(os.getenv("DEEPSEEK_TIMEOUT_SECONDS", "60")),
        )
        raw_content = response.choices[0].message.content
        parsed = json.loads(raw_content)
        
        return {
            "success": True,
            "title": parsed.get("title", ""),
            "extracted_usp": raw_content,
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/api/translate-dna")
def translate_dna(request: TranslateDnaRequest):
    active_client, provider_id, model_id, *_ = resolve_llm_client(
        request.engine_provider, request.engine_model
    )
    if not active_client:
        return {"success": False, "error": "Cloud engine not configured."}

    lang_name = "ENGLISH" if request.target_lang == "en" else "CHINESE (中文)"
    
    if request.category in ["regions", "platforms", "angles"]:
        system_prompt = f"""You are a professional Strategy Factor localizer.
Your task is to translate ALL string values in the provided JSON object into {lang_name}.
CRITICAL RULES:
1. DO NOT change ANY of the JSON keys. Keep them exactly as provided.
2. DO NOT change the structure of the JSON.
3. Translate only the string values (e.g. descriptions, rules, constraints, cultural notes).
4. ABSOLUTELY DO NOT translate the values for the "name" and "short_name" keys. Keep their original values completely unchanged.
5. Output MUST be a pure JSON object, starting with {{ and ending with }}. No markdown fences.
"""
    else:
        system_prompt = f"""You are a professional game localization expert.
Your task is to translate ALL string values in the provided JSON object into {lang_name}.
CRITICAL RULES:
1. DO NOT change ANY of the JSON keys. Keep them exactly as provided.
2. DO NOT change the structure of the JSON.
3. Translate only the string values (e.g. descriptions, hooks, persona details).
4. For competitive_set arrays, translate the game names only if they have recognized localized names, otherwise keep them as is.
5. ABSOLUTELY DO NOT translate the values for the "name" and "short_name" keys. Keep their original values completely unchanged.
6. Output MUST be a pure JSON object, starting with {{ and ending with }}. No markdown fences.
"""
    try:
        response = active_client.chat.completions.create(
            model=model_id,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": json.dumps(request.game_info, ensure_ascii=False)},
            ],
            timeout=float(os.getenv("DEEPSEEK_TIMEOUT_SECONDS", "30")),
        )
        raw_content = response.choices[0].message.content
        parsed = json.loads(raw_content)
        
        # Pydantic validation if category is known
        if request.category == "regions":
            parsed = RegionFactorSchema.model_validate(parsed).model_dump()
        elif request.category == "platforms":
            parsed = PlatformFactorSchema.model_validate(parsed).model_dump()
        elif request.category == "angles":
            parsed = AngleFactorSchema.model_validate(parsed).model_dump()
            
        # Re-inject missing structural keys that were stripped by model_dump()
        for key in ["id", "category", "_metadata"]:
            if key in request.game_info:
                parsed[key] = request.game_info[key]
                
        return {"success": True, "translated_info": parsed}
    except Exception as e:
        return {"success": False, "error": str(e)}

class IngestRequest(BaseModel):
    raw_text: str = ""
    source_url: str = "Manual Entry"
    year_quarter: str = "Unknown Date"
    mark_pending: bool = False

class IngestResponse(BaseModel):
    success: bool
    extracted_count: int = 0
    error: str = ""

@app.post("/api/refinery/ingest", response_model=IngestResponse)
def ingest_report(request: IngestRequest):
    result = distill_and_store(
        request.raw_text, 
        request.source_url, 
        request.year_quarter,
        mark_pending=request.mark_pending
    )
    success = result.get("success", False)
    if success:
        record_oracle_ingest_success()
    return {
        "success": success,
        "extracted_count": result.get("extracted_count", 0),
        "error": result.get("error", "")
    }

@app.get("/api/refinery/stats")
def get_refinery_stats():
    from refinery import get_collection_stats
    return get_collection_stats()

@app.get("/api/refinery/intel")
def search_refinery_intel(query: str = "", limit: int = 50, region: str = "", tag: str = "", status: str = "active"):
    from refinery import search_intel
    return search_intel(query=query, limit=limit, region=region, tag=tag, status=status)

class UpdateIntelRequest(BaseModel):
    content: str | None = None
    region: str | None = None
    category: str | None = None
    time: str | None = None
    status: str | None = None

@app.put("/api/refinery/intel/{item_id}")
def edit_refinery_intel(item_id: str, req: UpdateIntelRequest):
    from refinery import update_intel
    success = update_intel(item_id, req.model_dump(exclude_none=True))
    if success:
        return {"success": True}
    return {"success": False, "error": "Item not found or update failed"}

@app.get("/api/refinery/export")
def export_intel_seed():
    from db import get_conn
    import json
    rows = get_conn().execute("SELECT doc_text, source, region, year_quarter, category FROM knowledge_docs").fetchall()
    docs = []
    metas = []
    for r in rows:
        docs.append(str(r["doc_text"] or ""))
        metas.append({
            "source": r["source"] or "",
            "region": r["region"] or "",
            "year_quarter": r["year_quarter"] or "",
            "category": r["category"] or ""
        })
    content = json.dumps({"docs": docs, "metas": metas}, ensure_ascii=False, indent=2)
    from fastapi.responses import Response
    return Response(content=content, media_type="application/json", headers={"Content-Disposition": "attachment; filename=oracle_seed.json"})

@app.get("/api/refinery/template")
def download_intel_template():
    import json
    template = {
        "docs": [
            "[Global] Style: Keep it under 15s. - Start with a fast hook. (Why: Low attention span)",
            "[Japan] Style: Cute characters. - Use high-pitched voiceovers. (Why: Cultural preference)"
        ],
        "metas": [
            {"source": "Manual Entry", "region": "Global", "year_quarter": "2026-Q1", "category": "General"},
            {"source": "Market Report", "region": "Japan", "year_quarter": "2026-Q1", "category": "region_jp"}
        ]
    }
    content = json.dumps(template, ensure_ascii=False, indent=2)
    from fastapi.responses import Response
    return Response(content=content, media_type="application/json", headers={"Content-Disposition": "attachment; filename=seed_template.json"})


@app.delete("/api/refinery/intel")
def clear_refinery_intel(status: Optional[str] = None):
    from refinery import clear_intel
    success = clear_intel(status=status)
    return {"success": success}

@app.delete("/api/refinery/intel/{item_id}")
def delete_refinery_intel(item_id: str):
    from db import get_conn
    conn = get_conn()
    conn.execute("DELETE FROM knowledge_docs WHERE id = ?", (item_id,))
    conn.execute("DELETE FROM knowledge_fts WHERE doc_id = ?", (item_id,))
    # Invalidate matrix lazily
    from refinery import collection
    collection._vector_matrix = None
    collection._vector_doc_ids = []
    return {"success": True}

@app.post("/api/refinery/backfill-tags")
def trigger_backfill_tags():
    """Re-analyze all existing intel via LLM to enrich missing metadata tags."""
    from refinery import backfill_intel_tags
    result = backfill_intel_tags()
    return result

class RecommendStrategyRequest(BaseModel):
    title: str
    core_gameplay: str
    core_usp: str
    region: str
    platform: str

class RecommendStrategyResponse(BaseModel):
    region_analysis: str
    platform_analysis: str

@app.post("/api/refinery/recommend-strategy", response_model=RecommendStrategyResponse)
def recommend_strategy(request: RecommendStrategyRequest):
    if cloud_client:
        prompt = f"""You are an elite UA strategy manager.
Given Game: {request.title}
Gameplay: {request.core_gameplay}
USP: {request.core_usp}
Target Region: {request.region}
Target Platform: {request.platform}

Output a JSON with two keys:
1. "region_analysis": A 1-2 sentence tactical insight on what this culture/region wants.
2. "platform_analysis": A 1-2 sentence tactical insight for this platform.
Keep it strictly technical and UA focused."""
        try:
            response = cloud_client.chat.completions.create(
                model=os.getenv("DEEPSEEK_MODEL", "deepseek-chat"),
                response_format={ "type": "json_object" },
                messages=[{"role": "user", "content": prompt}]
            )
            raw = response.choices[0].message.content
            import json
            parsed = json.loads(raw)
            return RecommendStrategyResponse(
                region_analysis=parsed.get("region_analysis", f"Emphasis on {request.region} localized visuals."),
                platform_analysis=parsed.get("platform_analysis", f"First 3 seconds hook for {request.platform}.")
            )
        except Exception as e:
            print(f"Recommend error: {e}")
            pass
            
    # Mock fallback
    return RecommendStrategyResponse(
        region_analysis=f"Recommended for {request.region}: Culturally resonant voiceovers and targeted localization.",
        platform_analysis=f"Recommended for {request.platform}: Format matching with fast jump cuts targeting user behavior."
    )


@app.get("/api/insights/metadata")
def get_insights_metadata():
    """Phase 26/E — served from SQLite factors table (seeded from FACTORS_DIR)."""
    from factors_store import list_by_type

    regions = [item["data"] for item in list_by_type("region")]
    platforms = [item["data"] for item in list_by_type("platform")]
    angles = [item["data"] for item in list_by_type("angle")]
    return {"regions": regions, "platforms": platforms, "angles": angles}

class InsightManageRequest(BaseModel):
    category: str
    insight_id: str
    content: dict

@app.post("/api/insights/manage/update")
def update_insight(req: InsightManageRequest):
    """Phase 26/E — writes the factor back to JSON (git seed) *and* upserts into DB."""
    import os, json
    ensure_knowledge_layout()
    base_dir = str(FACTORS_DIR)
    target_dir = os.path.join(base_dir, req.category)
    os.makedirs(target_dir, exist_ok=True)
    file_path = os.path.join(target_dir, f"{req.insight_id}.json")
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(req.content, f, ensure_ascii=False, indent=4)
    try:
        from factors_store import seed_from_filesystem as _seed_now

        _seed_now()
    except Exception as exc:
        print(f"factor upsert failed: {exc}")
    return {"success": True}

class InsightDeleteRequest(BaseModel):
    category: str
    insight_id: str

@app.post("/api/insights/manage/delete")
def delete_insight(req: InsightDeleteRequest):
    """Phase 26/E — deletes the JSON file and mirrors the deletion in SQLite."""
    import os
    ensure_knowledge_layout()
    base_dir = str(FACTORS_DIR)
    file_path = os.path.join(base_dir, req.category, f"{req.insight_id}.json")
    removed = False
    if os.path.exists(file_path):
        os.remove(file_path)
        removed = True
    try:
        from db import execute as _db_execute

        _db_execute("DELETE FROM factors WHERE id = ?", (req.insight_id,))
    except Exception as exc:
        print(f"factor delete (DB) failed: {exc}")
    if removed:
        return {"success": True}
    return {"success": False, "error": "Not found"}


class GenerateInsightRequest(BaseModel):
    category: str
    source_text: str

class RegionFactorSchema(BaseModel):
    name: str
    short_name: str
    description: str
    language: str
    focus: list[str] = []
    rules: list[str] = []
    constraints: list[str] = []
    culture_notes: list[str] = []
    creative_hooks: list[str] = []

class PlatformFactorSchema(BaseModel):
    name: str
    short_name: str
    description: str
    focus: list[str] = []
    rules: list[str] = []
    constraints: list[str] = []
    specs: dict = {}
    native_behavior: str = ""
    algorithm_signals: list[str] = []
    visual_keywords: list[str] = []

class AngleFactorSchema(BaseModel):
    name: str
    short_name: str
    description: str
    focus: list[str] = []
    rules: list[str] = []
    constraints: list[str] = []
    core_emotion: str = ""
    visual_tempo: str = ""
    logic_steps: list[str] = []
    audio_strategy: str = ""

@app.post("/api/insights/manage/generate")
def generate_insight(req: GenerateInsightRequest):
    import json
    import re
    from providers import get_client, default_provider_id, resolve_model, is_json_mode_supported
    
    def _extract_json_from_text(text: str) -> dict:
        match = re.search(r'\{.*\}', text, re.DOTALL)
        if match:
            return json.loads(match.group(0))
        return json.loads(text)
    
    provider_id = default_provider_id()
    client = get_client(provider_id)
    if not client:
        return {"success": False, "error": "No LLM provider configured."}

    model_id = resolve_model(provider_id, None)
    supports_json = is_json_mode_supported(provider_id)

    if req.category == "regions":
        target_schema = RegionFactorSchema.model_json_schema()
        domain_prompt = """
[DOMAIN FOCUS: REGIONS]
- Force extraction of "Cultural Taboos" and "Local Unique Memes" into `culture_notes`.
- Extract proven psychological triggers for this region into `creative_hooks`.
- Auto-translate the `name` and `short_name` appropriately.
"""
        model_class = RegionFactorSchema
    elif req.category == "platforms":
        target_schema = PlatformFactorSchema.model_json_schema()
        domain_prompt = """
[DOMAIN FOCUS: PLATFORMS]
- Force extraction of "UI Occluded Areas" (e.g., safe zones) and standard aspect ratios into `specs`.
- Extract "Algorithm Distribution Features" (how the algorithm ranks videos) into `algorithm_signals`.
- Extract key visual mood and pacing tags (e.g., #FastPaced, #FirstPerson, #HighSaturation) into `visual_keywords`.
"""
        model_class = PlatformFactorSchema
    else:
        target_schema = AngleFactorSchema.model_json_schema()
        domain_prompt = """
[DOMAIN FOCUS: ANGLES]
- Force structuring the raw text into the 4-step framework: Hook -> Build-up -> Climax -> CTA in `logic_steps`.
- Identify the primary psychological trigger and place it in `core_emotion`.
"""
        model_class = AngleFactorSchema

    schema_props = target_schema.get("properties", target_schema)
    json_skeleton = {}
    for k, v in schema_props.items():
        if v.get("type") == "array":
            json_skeleton[k] = [f"<{v.get('items', {}).get('type', 'string')}>"]
        elif v.get("type") == "string":
            json_skeleton[k] = "<string>"
        elif v.get("type") == "integer":
            json_skeleton[k] = "<integer>"
        elif v.get("type") == "object":
            json_skeleton[k] = {"<key>": "<string>"}
        else:
            json_skeleton[k] = "<any>"

    is_enhance_mode = "[INSTRUCTIONS TO ENHANCE/OPTIMIZE THE EXISTING FACTOR]:" in req.source_text

    if is_enhance_mode:
        system_prompt = f"""# Role: 全球顶尖小游戏买量素材专家 & 心理学转化大师

## Context
你是一个拥有100年经验的移动端买量专家，专门负责优化小游戏（Mini-Games）的投放因子树（Factor Tree）。你的任务是接收一个现有的 JSON 因子对象，并根据用户的“优化指令”进行深度加工。

## Core Mission
- **保持结构**：必须严格遵守输入的 JSON 模式（Schema），不得增删字段，不得修改原始 ID。
- **内容升级**：将平庸的描述升级为具有“多巴胺刺激”、“心理学钩子”和“极高转化率”的专业内容。
- **语言地道**：所有 English 内容（如 hooks, descriptive focus）必须是地道的北美母语者水平，严禁中式英语。

## Capability Matrix
1. **智能补全 (Auto-fill)**：若字段为空，根据 ID 和 Name 自动推导该因子在买量实战中最核心的知识点。
2. **定向进化 (Directional Enhancement)**：根据用户指令精准调整内容的侧重点。
3. **逻辑校验 (Logical Consistency)**：确保 focus, rules, 和 constraints 之间互不矛盾且环环相扣。

## Operational Rules
1. **ID 锁定**：绝对禁止修改 `id` 字段。
2. **深度合并**：只输出优化后的完整 JSON 对象。
3. **术语要求**：在内容中恰当使用买量黑话（如：Rage Bait, Scroll-stopper, ASMR, Seamless Loop, UGC-style, eCPM optimization）。
4. **禁止废话**：输出必须仅包含 JSON 代码块，不要任何开场白或解释。
5. **法律与合规红线 (Legal Red Line)**：在任何“更具攻击性”或“擦边”的优化指令下，绝对禁止生成涉及真实血腥暴力、明显侵权（如直接使用米老鼠、马里奥等知名IP）或触犯平台封号底线的策略。必须将这些列入 `constraints` 字段中作为严格禁区。

## Optimization Logic (按字段)
- **description**: 解释该因子的底层心理学逻辑或转化原理。
- **focus**: 必须是可落地的执行重点，强调前 2 秒的视觉冲击。
- **rules**: 具体的制作标准，包含安全区、画质、节奏要求。
- **constraints**: 明确的禁区，防止平台封号或用户反感。
- **visual_tempo / audio_strategy**: 提供具体的物理参数建议（如 Hz, BPM, Duration）。

{domain_prompt}

OUTPUT FORMAT:
Return ONLY a valid JSON object matching the exact keys and data types shown below. Do NOT output schema definitions like {{"type": "string"}}, output the ACTUAL strings/arrays!
{json.dumps(json_skeleton, indent=2)}
"""
    else:
        system_prompt = f"""You are an expert Ad Creative Strategist.
Your task is to analyze the user's unstructured notes and output a highly structured JSON Strategy Factor.
You MUST extract the core directives into imperative, actionable rules.
Use imperative tone (e.g., "Must show...", "Absolutely prohibit...").

CRITICAL INSTRUCTION FOR MISSING FIELDS: 
If the user's text does not explicitly mention certain aspects (e.g., audio_strategy, visual_tempo, constraints), DO NOT leave them blank, but DO NOT hallucinate randomly.
You MUST deduce highly specific, industry-standard recommendations that STRICTLY ALIGN with the established `core_emotion` and `logic_steps`.
To ensure data transparency, you MUST prefix any AI-deduced field values with "[AI 推演] " (or "[AI Inferred] " depending on language) so the human strategist knows it was automatically generated for their review.

{domain_prompt}

OUTPUT FORMAT:
Return ONLY a valid JSON object matching the exact keys and data types shown below. Do NOT output schema definitions like {{"type": "string"}}, output the ACTUAL strings/arrays!
{json.dumps(json_skeleton, indent=2)}
"""
    if not supports_json:
        system_prompt += "\nYou MUST output valid JSON only. Do not include any preamble or markdown blocks."

    try:
        kwargs = {
            "model": model_id,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": req.source_text}
            ],
            "temperature": 0.7
        }
        if supports_json:
            kwargs["response_format"] = {"type": "json_object"}
            
        response = client.chat.completions.create(**kwargs)
        content = response.choices[0].message.content
        
        if not supports_json:
            parsed = _extract_json_from_text(content)
        else:
            parsed = json.loads(content)
            
        # Defensive unwrapping and case normalization for LLM hallucinations
        if isinstance(parsed, list) and len(parsed) > 0 and isinstance(parsed[0], dict):
            parsed = parsed[0]
            
        if isinstance(parsed, dict):
            lowercase_parsed = {k.lower(): v for k, v in parsed.items()}
            if "name" not in lowercase_parsed:
                # Try to unwrap if nested inside "properties" or schema name
                for v in lowercase_parsed.values():
                    if isinstance(v, dict):
                        lowercase_v = {k.lower(): val for k, val in v.items()}
                        if "name" in lowercase_v:
                            parsed = lowercase_v
                            break
                else:
                    parsed = lowercase_parsed
            else:
                parsed = lowercase_parsed
                
        # Pydantic Strict Validation
        validated = model_class.model_validate(parsed)
        final_dict = validated.model_dump()
        final_dict["category"] = req.category
        return {"success": True, "data": final_dict}
    except Exception as e:
        print(f"Generate Insight Error: {e}")
        return {"success": False, "error": f"Validation/Generation Error: {str(e)}"}


@app.post("/api/generate", response_model=GenerateScriptResponse)
def generate_script(request: GenerateScriptRequest):
    import os, json
    import time
    from prompts import render_draft_prompt, render_director_prompt

    t0 = time.perf_counter()
    mode = (request.mode or "auto").strip().lower()
    if mode not in {"draft", "director", "auto"}:
        mode = "auto"

    # 1. READ DATABASES
    from projects_api import load_project as _load_project
    project_json = _load_project(request.project_id) or {"name": "Unknown", "game_info": {"core_loop": "Generic Game"}}
    workspace_file = os.path.join(os.path.dirname(__file__), 'data', 'workspaces', f"{request.project_id}.json")
    if project_json.get("name") == "Unknown" and os.path.exists(workspace_file):
        with open(workspace_file, 'r', encoding='utf-8') as f:
            project_json = json.load(f)
    
    # Get Atomic Insights (Phase 26/E — served from SQLite factors table)
    ensure_knowledge_layout()
    def read_insight(insight_id: str):
        data = read_insight_factor(insight_id)
        if not data:
            return {"error": "not provided"} if not insight_id else {"error": "not found"}
        return data

    region_json = read_insight(request.region_id)
    platform_json = read_insight(request.platform_id)
    angle_json = read_insight(request.angle_id)

    # Phase 23/B1 — sanitize project-origin user text before it enters the prompt.
    gi = sanitize_game_info(project_json.get('game_info', {}))
    safe_name = sanitize_user_text(project_json.get('name'), max_len=200, allow_newlines=False)
    usp_dict = gi.get('usp', {})
    usp_str = "\\n".join([f"- {k}: {v}" for k, v in usp_dict.items()]) if isinstance(usp_dict, dict) else str(usp_dict)
    comp_set = ", ".join(gi.get('competitive_set', []))
    game_context = (
        f"Title: {safe_name}\\n"
        f"Core Loop: {gi.get('core_loop', '')}\\n"
        f"USP:\\n{usp_str}\\n"
        f"Persona: {gi.get('persona', '')}\\n"
        f"Visual DNA: {gi.get('visual_dna', '')}\\n"
        f"Competitive Set: {comp_set}"
    )
    from usage_tracker import record_generate_success
    script_id = "SOP-" + uuid.uuid4().hex[:6].upper()
    # Phase 25/D2 — resolve once for both draft and director stages.
    active_client, provider_id, model_id, *_ = resolve_llm_client(
        request.engine_provider, request.engine_model
    )

    # record_history was promoted to module scope in Phase 22 (see _record_history
    # below) so that quick_copy / refresh_copy can reliably write history entries.
    def record_history(*args, **kwargs):
        return _record_history(*args, **kwargs)

    def build_rag_supplement() -> tuple[str, list[str], list[dict]]:
        rag_parts: list[str] = [request.region_id, request.platform_id, request.angle_id, game_context]
        # --- Shared base: extract common fields (description, focus, rules, constraints) ---
        def _extract_base(factor: dict, label: str) -> None:
            n = factor.get("name")
            if n:
                rag_parts.append(f"[{label}] {n}")
            desc = factor.get("description")
            if desc:
                rag_parts.append(f"[{label} Strategy] {desc[:600]}")
            for field, prefix in [("focus", "MUST DO"), ("rules", "SPEC RULES"), ("constraints", "ABSOLUTE TABOOS")]:
                val = factor.get(field)
                if isinstance(val, list) and val:
                    items = "\n".join(f"- {str(x)}" for x in val[:8])
                    rag_parts.append(f"[{label} — {prefix}]\n{items}")

        # --- Region-specific: cultural context & language ---
        if isinstance(region_json, dict):
            _extract_base(region_json, "REGION")
            lang = region_json.get("language")
            if lang:
                rag_parts.append(f"[REGION Language] Output language: {lang}")
            for key in ("culture_notes", "creative_hooks"):
                val = region_json.get(key)
                if isinstance(val, list) and val:
                    items = "\n".join(f"- {str(x)}" for x in val[:6])
                    rag_parts.append(f"[REGION — {key.upper()}]\n{items}")

        # --- Platform-specific: technical specs & algorithm behavior ---
        if isinstance(platform_json, dict):
            _extract_base(platform_json, "PLATFORM")
            specs = platform_json.get("specs")
            if isinstance(specs, dict):
                spec_lines = [f"  {k}: {v}" for k, v in specs.items()]
                rag_parts.append(f"[PLATFORM — TECH SPECS]\n" + "\n".join(spec_lines))
            nb = platform_json.get("native_behavior")
            if nb:
                rag_parts.append(f"[PLATFORM — USER BEHAVIOR] {nb[:600]}")
            algo = platform_json.get("algorithm_signals")
            if isinstance(algo, list) and algo:
                items = "\n".join(f"- {str(x)}" for x in algo[:6])
                rag_parts.append(f"[PLATFORM — ALGORITHM SIGNALS]\n{items}")

        # --- Angle-specific: psychological conversion model ---
        if isinstance(angle_json, dict):
            _extract_base(angle_json, "ANGLE")
            ce = angle_json.get("core_emotion")
            if ce:
                rag_parts.append(f"[ANGLE — CORE EMOTION] {ce}")
            ls = angle_json.get("logic_steps")
            if isinstance(ls, list) and ls:
                items = "\n".join(f"{str(x)}" for x in ls[:8])
                rag_parts.append(f"[ANGLE — CONVERSION FUNNEL]\n{items}")
            vt = angle_json.get("visual_tempo")
            if vt:
                rag_parts.append(f"[ANGLE — VISUAL TEMPO] {vt}")
            aus = angle_json.get("audio_strategy")
            if aus:
                rag_parts.append(f"[ANGLE — AUDIO STRATEGY] {aus[:600]}")
        if getattr(request, "intel_constraint", None):
            rag_parts.append(f"!!! CRITICAL ACTIONABLE OVERRIDE !!!\n{request.intel_constraint}")

        rag_supplement = "\n".join(p for p in rag_parts if p)
        region_boost: list[str] = []
        if isinstance(region_json, dict) and region_json.get("name"):
            region_boost.append(str(region_json["name"]))
        ctx, citations, evidence = retrieve_context_with_evidence(
            f"{request.region_id} {request.platform_id} {request.angle_id}",
            top_k=5,
            supplement=rag_supplement,
            region_boost_tokens=region_boost or None,
        )

        # Phase 3: The Winner's Loop
        from db import get_conn
        import json
        winner_row = get_conn().execute(
            "SELECT payload_json FROM history_log WHERE region_id = ? AND platform_id = ? AND angle_id = ? AND is_winner = 1 ORDER BY created_at DESC LIMIT 1",
            (request.region_id, request.platform_id, request.angle_id)
        ).fetchone()
        if winner_row:
            try:
                winner_data = json.loads(winner_row["payload_json"])
                winner_script = json.dumps(winner_data.get("script", []), ensure_ascii=False)
                winner_prompt = f"!!! 历史爆款锚点：请参考以下经市场验证过的胜利逻辑进行进化 !!!\n{winner_script[:1500]}\n"
                ctx = winner_prompt + ctx
            except Exception as e:
                print(f"Failed to load winner script: {e}")

        return ctx, citations, evidence

    def finalize_response(
        resp: dict[str, Any],
        engine_label: str,
        *,
        drafts: list[dict] | None = None,
        evidence: list[dict] | None = None,
    ) -> GenerateScriptResponse:
        resp = _normalize_script_lines(resp)
        resp.setdefault("citations", [])
        if resp.get("cultural_notes") is None:
            resp["cultural_notes"] = []
        # Enforce Ad Copy Matrix requirements (best-effort backfill)
        resp = _ensure_ad_copy_matrix(
            resp,
            angle_name=str(angle_json.get("name", request.angle_id)) if isinstance(angle_json, dict) else request.angle_id,
            platform_name=str(platform_json.get("name", request.platform_id)) if isinstance(platform_json, dict) else request.platform_id,
            region_name=str(region_json.get("name", request.region_id)) if isinstance(region_json, dict) else request.region_id,
        )
        review = _build_script_review(
            resp,
            core_gameplay=str(gi.get("core_gameplay", "")),
            angle_name=str(angle_json.get("name", request.angle_id)) if isinstance(angle_json, dict) else request.angle_id,
        )
        resp["review"] = review
        # Build render-friendly ad copy tiles + compliance scan (best-effort; never fail the request)
        try:
            from compliance import (
                build_ad_copy_tiles,
                maybe_generate_rewrite_suggestions,
                scan_ad_copy,
            )

            tiles = build_ad_copy_tiles(resp.get("ad_copy_matrix"), region_id=request.region_id)
            resp["ad_copy_tiles"] = tiles
            compliance_obj = scan_ad_copy(tiles, platform_id=request.platform_id, region_id=request.region_id)
            if request.compliance_suggest and active_client:
                tiles_by_id = {str(t.get("id")): t for t in tiles if isinstance(t, dict) and t.get("id")}
                suggestions = maybe_generate_rewrite_suggestions(
                    cloud_client=active_client,
                    hits=list(compliance_obj.get("hits") or []),
                    tiles_by_id=tiles_by_id,
                    output_mode=request.output_mode,
                    model=model_id,
                )
                if suggestions:
                    compliance_obj["suggestions"] = suggestions
            resp["compliance"] = compliance_obj
        except Exception:
            resp["ad_copy_tiles"] = resp.get("ad_copy_tiles") or []
            resp["compliance"] = resp.get("compliance") or {"risk_level": "unknown", "hits": []}
        if drafts:
            resp["drafts"] = drafts
        if evidence:
            resp["rag_evidence"] = evidence
        resp["generation_metrics"] = {
            "mode": mode,
            "elapsed_ms": int((time.perf_counter() - t0) * 1000),
            "rag_rules_used": len(evidence or []),
            "failover_notice": getattr(request, "_failover_notice", None),
        }
        md_rel = export_markdown_after_generate(
            request.project_id,
            str(project_json.get("name") or "Unknown"),
            {
                "region": request.region_id,
                "platform": request.platform_id,
                "angle": request.angle_id,
                "region_name": str(region_json.get("name") or request.region_id) if isinstance(region_json, dict) else request.region_id,
                "platform_name": str(platform_json.get("name") or request.platform_id) if isinstance(platform_json, dict) else request.platform_id,
                "angle_name": str(angle_json.get("name") or request.angle_id) if isinstance(angle_json, dict) else request.angle_id,
                "region_short": str(region_json.get("short_name") or "") if isinstance(region_json, dict) else "",
                "platform_short": str(platform_json.get("short_name") or "") if isinstance(platform_json, dict) else "",
                "angle_short": str(angle_json.get("short_name") or "") if isinstance(angle_json, dict) else "",
                "visual_keywords": ", ".join(platform_json.get("visual_keywords", [])) if isinstance(platform_json, dict) and platform_json.get("visual_keywords") else "",
            },
            engine_label,
            resp,
            request.output_mode,
        )
        payload = {**resp, "markdown_path": md_rel}
        return GenerateScriptResponse(**payload)

    # shared context
    rag_context, rag_citations, rag_evidence = build_rag_supplement()
    selected_draft: dict[str, Any] | None = request.selected_draft_payload
    drafts: list[dict] = []
    # Phase 22 - history schema v2 context
    factor_version = _compute_factor_version(region_json, platform_json, angle_json)
    rag_rule_ids = _extract_rag_rule_ids(rag_evidence, rag_citations)
    avoid_terms = _collect_avoid_terms(project_json)
    draft_status: str | None = "skipped" if selected_draft else "pending"

    # 2. DRAFT STAGE
    if mode in {"draft", "auto"} and not selected_draft:
        draft_prompt = render_draft_prompt(
            game_context=game_context,
            culture_context=region_json,
            platform_rules=platform_json,
            creative_logic=angle_json,
            video_duration=request.video_duration,
            scene_count=request.scene_count,
            user_prompt=request.intel_constraint,
        )
        draft_user = f"Market context:\n{rag_context}\n\nReturn draft concepts JSON only."
        draft_payload: dict[str, Any] = {}
        draft_status = "ok"
        if not active_client:
            raise HTTPException(
                status_code=502,
                detail={
                    "error_code": "CLOUD_UNAVAILABLE",
                    "error_message": "No LLM provider configured (set DEEPSEEK_API_KEY or another provider key).",
                },
            )
        try:
            dresp = active_client.chat.completions.create(
                model=model_id,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": draft_prompt},
                    {"role": "user", "content": draft_user},
                ],
                timeout=float(os.getenv("DEEPSEEK_TIMEOUT_SECONDS", "90")),
            )
            draft_payload = json.loads(dresp.choices[0].message.content or "{}")
        except Exception as e:
            print(f"Draft stage failed: {e}")
            draft_status = "fallback"
        drafts, selected_draft = _pick_top_draft(draft_payload)
        if mode == "draft":
            if not selected_draft:
                raise HTTPException(
                    status_code=502,
                    detail={
                        "error_code": "DRAFT_UNAVAILABLE",
                        "error_message": "Draft stage produced no candidates.",
                        "elapsed_ms": int((time.perf_counter() - t0) * 1000),
                    },
                )
            base_line = {
                "time": "0s",
                "visual": str((selected_draft or {}).get("hook", "Hook gameplay concept")),
                "visual_meaning": str((selected_draft or {}).get("gameplay_bridge", "前2镜完成与玩法闭环")),
                "audio_content": "Voiceover placeholder",
                "audio_meaning": "根据入选草案补齐导演口播情绪与节奏。",
                "text_content": "On-screen text placeholder",
                "text_meaning": "根据草案补齐贴纸文案意图。",
                "direction_note": "草案模式：先用于创意评审，再进入导演定稿。",
                "sfx_transition_note": "草案模式：标记关键节拍点，待定稿补充细节。",
            }
            draft_resp = {
                "script_id": script_id,
                "hook_score": _safe_int((selected_draft or {}).get("estimated_ctr"), 70),
                "hook_reasoning": f"Selected draft: {(selected_draft or {}).get('title', 'N/A')}",
                "clarity_score": _safe_int((selected_draft or {}).get("estimated_quality"), 70),
                "clarity_reasoning": "Draft mode prioritizes ideation speed over full production details.",
                "conversion_score": 70,
                "conversion_reasoning": "Conversion is estimated only at draft stage.",
                "bgm_direction": "Draft stage placeholder",
                "editing_rhythm": "Draft stage placeholder",
                "script": [base_line],
                "psychology_insight": str((selected_draft or {}).get("story_arc", "")),
                "cultural_notes": [str((selected_draft or {}).get("gameplay_bridge", ""))],
                "competitor_trend": "Draft stage only",
                "citations": rag_citations,
            }
            record_generate_success(engine="cloud", measured_tokens=0, provider=provider_id)
            finalized = finalize_response(draft_resp, "cloud", drafts=drafts, evidence=rag_evidence)
            record_history(
                project_json,
                request,
                finalized.model_dump(),
                "cloud",
                factor_version=factor_version,
                rag_rule_ids=rag_rule_ids,
                draft_status=draft_status,
                provider=provider_id,
                model=model_id,
            )
            return finalized

    # 3. DIRECTOR STAGE
    director_prompt = render_director_prompt(
        game_context=game_context,
        culture_context=region_json,
        platform_rules=platform_json,
        creative_logic=angle_json,
        selected_draft_json=json.dumps(selected_draft, ensure_ascii=False) if selected_draft else "",
        avoid_terms=avoid_terms,
        video_duration=request.video_duration,
        scene_count=request.scene_count,
        user_prompt=request.intel_constraint,
        output_mode=request.output_mode,
    )
    _print_console_safe("\n[ATOMIC DB SYNTHESIS SUCCESS - SUPER CONTEXT GENERATED]")
    _print_console_safe(director_prompt)

    if not active_client:
        raise HTTPException(
            status_code=502,
            detail={
                "error_code": "CLOUD_UNAVAILABLE",
                "error_message": "No LLM provider configured (set DEEPSEEK_API_KEY or another provider key).",
            },
        )

    try:
        response = active_client.chat.completions.create(
            model=model_id,
            messages=[
                {"role": "system", "content": director_prompt},
                {
                    "role": "user",
                    "content": (
                        f"Market context:\n{rag_context}\n\n"
                        f"Selected draft:\n{json.dumps(selected_draft or {}, ensure_ascii=False)}\n\n"
                        "Please generate the final director script JSON."
                    ),
                },
            ],
            response_format={"type": "json_object"},
            timeout=float(os.getenv("DEEPSEEK_TIMEOUT_SECONDS", "120")),
        )
        raw = response.choices[0].message.content
        parsed = _normalize_script_lines(json.loads(raw))
    except HTTPException:
        raise
    except Exception as e:
        elapsed_ms = int((time.perf_counter() - t0) * 1000)
        print(f"Synthesis Engine failed after {elapsed_ms}ms: {e}")
        raise HTTPException(
            status_code=502,
            detail={
                "error_code": "CLOUD_SYNTHESIS_FAILED",
                "error_message": f"LLM synthesis failed: {e}",
                "elapsed_ms": elapsed_ms,
                "draft_status": draft_status,
            },
        )

    parsed["script_id"] = script_id
    parsed.setdefault("citations", rag_citations)
    if parsed.get("cultural_notes") is None:
        parsed["cultural_notes"] = []
    record_generate_success(engine='cloud', measured_tokens=0, provider=provider_id)
    finalized = finalize_response(parsed, "cloud", drafts=drafts, evidence=rag_evidence)
    record_history(
        project_json,
        request,
        finalized.model_dump(),
        "cloud",
        factor_version=factor_version,
        rag_rule_ids=rag_rule_ids,
        draft_status=draft_status,
        provider=provider_id,
        model=model_id,
    )
    return finalized

class ContextPreviewRequest(BaseModel):
    region_id: str
    platform_id: str
    angle_id: str
    game_info: Optional[dict] = None

@app.post("/api/context-preview")
def context_preview(req: ContextPreviewRequest):
    oracle_flashes = []
    try:
        from factors_store import read_insight
        region_data = read_insight(req.region_id)
        platform_data = read_insight(req.platform_id)
        
        region_name = region_data.get("name") or req.region_id
        platform_name = platform_data.get("name") or req.platform_id
        
        from refinery import search_intel
        intel_res = search_intel(region=region_name, limit=2)
        if not intel_res:
             intel_res = search_intel(limit=2)
             
        oracle_flashes = [i.get('title', '') for i in intel_res if i.get('title')]
    except Exception as e:
        print(f"Error in context_preview oracle: {e}")
        platform_name = req.platform_id
        
    dna_conflicts = []
    if req.game_info:
        core_loop = req.game_info.get("core_loop", "")
        if core_loop:
            dna_conflicts.append(f"核心玩法: {core_loop[:25]}")
            
        usp_data = req.game_info.get("usp")
        if isinstance(usp_data, dict) and usp_data:
            first_usp = list(usp_data.values())[0]
            dna_conflicts.append(f"核心卖点: {first_usp[:25]}")
        elif isinstance(usp_data, str) and usp_data:
            dna_conflicts.append(f"核心卖点: {usp_data[:25]}")
            
        persona = req.game_info.get("persona", "")
        if persona and len(dna_conflicts) < 2:
            dna_conflicts.append(f"受众基因: {persona[:25]}")
            
    # Visual keywords based on platform/region
    # First, try to get them dynamically from the platform's JSON data
    visual_keywords = platform_data.get("visual_keywords", [])
        
    return {
        "oracle_flashes": oracle_flashes[:2],
        "dna_conflicts": dna_conflicts[:2],
        "visual_keywords": visual_keywords[:3]
    }
