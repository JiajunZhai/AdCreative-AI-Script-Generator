import json
import re
from typing import Dict, Any, Optional

from google_play_scraper import app as gplay_app

# -----------------------------------------------------------------------------
# System prompt: bilingual director archive (used by the DeepSeek cloud path in
# main.extract_url; scraper itself only ships a rule-based fallback).
# English-first distillation; Chinese = director-practical for domestic editors.
# -----------------------------------------------------------------------------
def get_extract_usp_prompt(lang: str) -> str:
    lang_name = "CHINESE (中文)" if lang == "cn" else "ENGLISH"
    lang_note = "（中文详述）" if lang == "cn" else "(Detailed in English)"
    
    return f"""You are an elite Game Analysis AI and Senior UA Creative Director.

## Task
Turn raw Google Play store copy into ONE profound JSON object: a "5-Pillar Project DNA".
CRITICAL RULE: You MUST output profound, rich analysis IN {lang_name}. Do NOT overly truncate the insights. Read between the lines of the marketing copy to deduce the real psychological hooks, gameplay loops, and target audience. Provide director-level strategic notes.

## Output schema (pure JSON, no markdown fences)
{{
  "core_loop": "详细的核心玩法循环与玩家体验轨迹 {lang_note}",
  "usp": {{
    "Gameplay": "玩法设计上的核心爽点与差异化钩子 {lang_note}",
    "Visual": "美术风格、视觉表现力及带给玩家的感官刺激 {lang_note}",
    "Social": "社交互动、排行榜、养成反馈等长线钩子 {lang_note}",
    "Other": "情感共鸣、解压、ASMR等其他深层心理学触发器 {lang_note}"
  }},
  "persona": "精确的目标受众画像、年龄层及他们的核心心理诉求 {lang_note}",
  "visual_dna": "整体视觉基因与材质光影特征总结 {lang_note}",
  "competitive_set": ["竞品1", "竞品2"]
}}

## Rules
- All string values MUST be in rich, professional {lang_name}.
- Provide actionable director notes mixed into your analysis.
- Output **only** the JSON object, first character `{{`, last character `}}`.
"""


def extract_app_id(url: str) -> Optional[str]:
    """Extrac the com.package.name from a play store URL."""
    match = re.search(r'id=([a-zA-Z0-9._]+)', url)
    if match:
        return match.group(1)
    return None


def fetch_playstore_data(url: str) -> Dict[str, Any]:
    """Scrape the play store app data."""
    app_id = extract_app_id(url)
    if not app_id:
        return {"success": False, "error": "Invalid Google Play URL format."}

    try:
        result = gplay_app(app_id, lang='en', country='us')
        return {
            "success": True,
            "title": result.get("title", "Unknown Game"),
            "description": result.get("description", "")[:1500] + (
                "... [TRUNCATED FOR ENGINE SAFETY]"
                if len(result.get("description", "")) > 1500
                else ""
            ),
            "genre": result.get("genre", "Game"),
            "developer": result.get("developer", "Unknown"),
            "installs": result.get("installs", "Unknown"),
            "recentChanges": result.get("recentChanges", "")
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


def _nonempty_str(v: Any) -> bool:
    return isinstance(v, str) and bool(v.strip())


def _valid_bilingual_pair(obj: Any) -> bool:
    return (
        isinstance(obj, dict)
        and _nonempty_str(obj.get("en"))
        and _nonempty_str(obj.get("cn"))
    )


def _validate_director_archive(data: Dict[str, Any]) -> bool:
    if not isinstance(data, dict):
        return False
    if not _nonempty_str(data.get("core_loop")):
        return False
    if not _nonempty_str(data.get("persona")):
        return False
    if not isinstance(data.get("usp"), dict):
        return False
    return True


def _serialize_director_archive(
    archive: Dict[str, Any],
    installs: str,
    recent_changes: str,
) -> str:
    """Stable string for API `extracted_usp` and downstream prompts."""
    payload = {
        "core_loop": archive.get("core_loop", ""),
        "usp": archive.get("usp", {}),
        "persona": archive.get("persona", ""),
        "visual_dna": archive.get("visual_dna", ""),
        "competitive_set": archive.get("competitive_set", []),
    }
    parts = [json.dumps(payload, ensure_ascii=False, indent=2)]
    parts.append(f"\n\n[Store scale signal]\ninstalls: {installs}\n")
    if recent_changes and str(recent_changes).strip():
        parts.append(
            "\n[Recent store updates — optional creative angle]\n"
            f"{str(recent_changes).strip()[:500]}\n"
        )
    return "".join(parts)


def _rule_based_director_archive(game_title: str, metadata: Dict[str, Any]) -> Dict[str, Any]:
    desc = metadata.get("description", "")[:1500].lower()
    genre = metadata.get("genre", "Game")
    installs = metadata.get("installs", "Unknown")

    core_en = f"Casual {genre.lower()} title with meta-progression and short session loops."
    if "rpg" in desc or "role" in desc:
        core_en = (
            f"Role-playing progression loop with {genre.lower()} combat or character growth "
            "as the primary retention driver."
        )
    elif "strategy" in desc or "build" in desc or "formation" in desc:
        core_en = (
            "Strategy battle loop: squad setup, timing, and resource choices with readable UI feedback."
        )
    elif "merge" in desc:
        core_en = "Merge-2 / merge-3 style loop to reveal higher-tier units or objects."

    core_cn = (
        f"【导演笔记】围绕「{game_title}」商店描述归纳：{core_en} "
        "建议优先截取核心操作反馈（升级/合成/开战）前 3 秒强反馈画面，避免空镜铺垫过长。"
    )

    hooks_en: list[str] = []
    if any(token in desc for token in ["collect", "summon", "hero", "squad", "team"]):
        hooks_en.append(
            "Collect and combine distinctive heroes into a customizable battle squad for clear progression fantasy."
        )
    if any(token in desc for token in ["chest", "treasure", "loot", "mining", "reward", "free"]):
        hooks_en.append(
            "Frequent chest or loot cadence delivers constant progression feedback and re-engagement hooks."
        )
    if any(token in desc for token in ["stress", "relief", "fun", "hilarious", "chaotic", "addictive"]):
        hooks_en.append(
            "Comedic tone and low-pressure pacing make sessions easy to start and share in short-form cuts."
        )
    if any(token in desc for token in ["strategy", "formation", "brain", "plan"]):
        hooks_en.append(
            "Simple controls paired with formation or timing depth support a low-entry, high-mastery narrative."
        )
    if any(token in desc for token in ["leaderboard", "ranking", "compare", "boss"]):
        hooks_en.append(
            "Competitive ranking or boss-challenge framing fuels comparison and repeat attempts."
        )

    fallback_en = [
        "Clear power-growth loop with frequent upgrade payoffs suitable for fail-bait creatives.",
        "Strong first-session clarity: mechanics readable within the first interactive beat.",
        "Distinct character or world fantasy that is easy to telegraph in 3-second hooks.",
    ]
    for item in fallback_en:
        if len(hooks_en) >= 5:
            break
        hooks_en.append(item)
    hooks_en = hooks_en[:5]
    while len(hooks_en) < 3:
        hooks_en.append(fallback_en[len(hooks_en) % len(fallback_en)])

    value_hooks = []
    for he in hooks_en[:5]:
        value_hooks.append(
            {
                "en": he,
                "cn": (
                    "【导演释义】"
                    + he
                    + " — 剪辑侧建议：用对比剪辑（前后数值/阵容）强化爽点；字幕突出「免费/开箱/成长」之一，避免信息堆叠。"
                ),
            }
        )

    aud_en = "General casual players seeking short, low-friction sessions."
    if any(token in desc for token in ["hardcore", "pvp", "battle", "leaderboard", "strategy", "action"]):
        aud_en = (
            "Competition-oriented players (approx. 18–35) who respond to skill growth, rankings, and mastery cues."
        )
    elif any(token in desc for token in ["design", "story", "fashion", "decorate"]):
        aud_en = "Lifestyle-leaning players who favor narrative, decoration, or identity expression loops."
    elif any(token in desc for token in ["stress", "relief", "casual", "fun", "hilarious"]):
        aud_en = "Stress-relief casuals who prefer humor, low stakes, and snackable session length."

    aud_cn = (
        f"【人群导演向】{aud_en} "
        f"安装量级参考：{installs}。素材语气宜与商店调性一致；若描述偏轻休闲，避免过度硬核电竞话术。"
    )

    visual_dna = "Casual distinct style"
    if "anime" in desc or "waifu" in desc:
        visual_dna = "Anime style, character focused"
    elif "dark" in desc or "gothic" in desc:
        visual_dna = "Dark fantasy, mature tone"
    
    comparatives = [genre.lower()]
    if "rpg" in genre.lower():
        comparatives.append("role-playing")

    return {
        "core_loop": f"{core_en.strip()} / {core_cn.strip()}",
        "usp": {
            "Gameplay": hooks_en[0] if len(hooks_en) > 0 else "",
            "Visual": hooks_en[1] if len(hooks_en) > 1 else "",
            "Social": hooks_en[2] if len(hooks_en) > 2 else "",
            "Other": hooks_en[3] if len(hooks_en) > 3 else ""
        },
        "persona": f"{aud_en.strip()} / {aud_cn.strip()}",
        "visual_dna": visual_dna,
        "competitive_set": comparatives,
    }


def _rule_based_usp(game_title: str, metadata: Dict[str, Any]) -> str:
    archive = _rule_based_director_archive(game_title, metadata)
    return _serialize_director_archive(
        archive,
        metadata.get("installs", "Unknown"),
        metadata.get("recentChanges", "") or "",
    )


def extract_usp_via_llm(game_title: str, metadata: Dict[str, Any]) -> str:
    """Rule-based distillation of store metadata into a bilingual director archive.

    The cloud LLM path lives in ``main.extract_url``; this helper is the
    deterministic fallback used when the cloud call fails or the key is absent.
    """
    return _rule_based_usp(game_title, metadata)


def extract_usp_via_llm_with_usage(
    game_title: str, metadata: Dict[str, Any]
) -> tuple[str, int | None, bool]:
    """Rule-based variant that also reports ``(tokens, used_llm)`` for the usage tracker.

    Rule-based distillation consumes no LLM tokens, so this always returns
    ``(text, None, False)``.
    """
    return _rule_based_usp(game_title, metadata), None, False


# Backward-compatible alias used in older tests and docs.
extract_usp_via_llm_mock = extract_usp_via_llm
