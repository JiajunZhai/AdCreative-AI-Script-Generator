import json
import pytest
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ollama_client import LocalLLMResult
from scraper import fetch_playstore_data, extract_usp_via_llm


def test_google_play_extraction_truncation():
    """
    Ensure the scraper correctly fetches a known URL and truncates description
    to <= 1500 + suffix length for VRAM safety.
    """
    url = "https://play.google.com/store/apps/details?id=com.supercell.brawlstars"
    data = fetch_playstore_data(url)

    assert data is not None
    assert "title" in data
    assert "description" in data

    # 1500 chars limit + len("... [TRUNCATED FOR ENGINE SAFETY]")
    assert len(data["description"]) <= 1600


def test_extract_usp_is_deterministic_and_description_driven():
    metadata = {
        "description": (
            "Cute but chaotic capybara RPG battle game. "
            "Collect heroes, build your squad, and use strategy and formation. "
            "Open chests, mine treasure, and claim free rewards. "
            "Funny stress-relief style with addictive progression."
        ),
        "genre": "Casual",
        "installs": "100K+",
        "recentChanges": "Bug fixes and rewards."
    }
    result = extract_usp_via_llm("Capybara Bomb!", metadata, engine="cloud")

    doc = json.loads(result.split("\n\n[Store scale signal]")[0])
    assert "core_gameplay" in doc and "en" in doc["core_gameplay"] and "cn" in doc["core_gameplay"]
    assert len(doc["value_hooks"]) >= 3
    assert all("en" in h and "cn" in h for h in doc["value_hooks"])
    assert "target_persona" in doc

    joined_en = " ".join(h["en"] for h in doc["value_hooks"])
    assert "hero" in joined_en.lower() or "squad" in joined_en.lower()
    assert "chest" in joined_en.lower() or "loot" in joined_en.lower()
    assert "100K+" in result


def test_extract_usp_local_uses_llm_when_valid(monkeypatch):
    metadata = {
        "description": "battle strategy chest rewards hero collect",
        "genre": "Casual",
        "installs": "10K+",
        "recentChanges": "update",
    }
    monkeypatch.setattr(
        "scraper.generate_with_local_llm",
        lambda **_kwargs: LocalLLMResult(
            {
                "core_gameplay": {
                    "en": "Tactical squad battle with hero progression.",
                    "cn": "战术小队战斗，英雄成长为核心循环。",
                },
                "value_hooks": [
                    {"en": "Hook A", "cn": "卖点A 导演释义"},
                    {"en": "Hook B", "cn": "卖点B 导演释义"},
                    {"en": "Hook C", "cn": "卖点C 导演释义"},
                ],
                "target_persona": {
                    "en": "Strategy-minded mobile players.",
                    "cn": "偏策略的移动端玩家，吃阵容与成长反馈。",
                },
            },
            900,
        ),
    )
    result = extract_usp_via_llm("Capybara Bomb!", metadata, engine="local")
    doc = json.loads(result.split("\n\n[Store scale signal]")[0])
    assert doc["core_gameplay"]["en"] == "Tactical squad battle with hero progression."
    assert len(doc["value_hooks"]) == 3
    assert doc["value_hooks"][0]["en"] == "Hook A"


def test_extract_usp_local_falls_back_when_llm_fails(monkeypatch):
    metadata = {
        "description": "collect hero chest fun strategy",
        "genre": "Casual",
        "installs": "10K+",
        "recentChanges": "",
    }
    monkeypatch.setattr(
        "scraper.generate_with_local_llm",
        lambda **_kwargs: LocalLLMResult(
            {"success": False, "error_code": "LOCAL_REQUEST_FAILED"},
            None,
        ),
    )
    result = extract_usp_via_llm("Capybara Bomb!", metadata, engine="local")
    doc = json.loads(result.split("\n\n[Store scale signal]")[0])
    joined_en = " ".join(h["en"] for h in doc["value_hooks"])
    assert "hero" in joined_en.lower() or "squad" in joined_en.lower()
