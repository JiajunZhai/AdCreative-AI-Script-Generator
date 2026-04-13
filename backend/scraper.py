import re
import random
from typing import Dict, Any, Optional
from google_play_scraper import app as gplay_app

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
            "description": result.get("description", "")[:1500] + ("... [TRUNCATED FOR ENGINE SAFETY]" if len(result.get("description", "")) > 1500 else ""),
            "genre": result.get("genre", "Game"),
            "developer": result.get("developer", "Unknown"),
            "installs": result.get("installs", "Unknown"),
            "recentChanges": result.get("recentChanges", "")
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

from ollama_client import generate_with_local_llm

def extract_usp_via_llm_mock(game_title: str, metadata: Dict[str, Any], engine: str = "cloud") -> str:
    """
    Parses a massive wall of text and outputting a structured USP matrix.
    If engine == local, invokes Ollama passing truncated desc to save VRAM.
    Otherwise uses mock extraction.
    """
    
    desc = metadata.get("description", "")[:1500].lower() # TRUNCATE FOR LOCAL LLM VRAM
    genre = metadata.get("genre", "Game")
    installs = metadata.get("installs", "Unknown")
    recent_changes = metadata.get("recentChanges", "")[:300]
    
    if engine == "local":
        system_p = "You are a Game Data Analyst. Extract 3 core selling points (USP), the main gameplay, and target audience from the app store description. Output directly in a readable matrix format without introduction."
        user_p = f"Game: {game_title}\nGenre: {genre}\nDescription: {desc}\nUpdates: {recent_changes}"
        return str(generate_with_local_llm(system_p, user_p, model="gemma4:e4b", expected_json=False))
    
    # Guess Core Gameplay
    core_gameplay = f"Casual {genre.lower()} mechanics with meta-progression."
    if "rpg" in desc or "role" in desc:
        core_gameplay = f"Role-playing battle mechanics with deep {genre.lower()} character growth."
    elif "strategy" in desc or "build" in desc:
        core_gameplay = f"Base-building {genre.lower()} strategy with resource management."
    elif "merge" in desc:
        core_gameplay = f"Merge-2 or Merge-3 mechanics to unveil higher tier items."

    # Guess Target Audience based on genre and installs
    audience = "General casual gamers looking to kill time."
    if "hardcore" in desc or "pvp" in desc or "action" in genre.lower():
        audience = "Competitive male gamers aged 18-35."
    elif "design" in desc or "story" in desc or "fashion" in desc:
        audience = "Female players aged 25-45 looking for relaxing narrative."

    # Generate 3 Hooks
    hooks = [
        "Uncover hidden secrets behind the core progression loop.",
        "Constant visual dopamine rushes upon completing simple tasks.",
        "Social comparison and leaderboard dominance."
    ]
    
    mock_specific_hooks = [
        f"Watching {game_title} characters mutate rapidly.",
        "The satisfaction of unlocking the ultra-rare legendary tier.",
        "Punishing failure states that dare the player to try again.",
        "Massive multi-kill combo satisfying effects."
    ]
    random.shuffle(mock_specific_hooks)
    hooks[0] = mock_specific_hooks[0]
    
    # Add What's New if available
    updates_section = ""
    if recent_changes:
        updates_section = f"\n[Recent Updates (What's New)]\nExtracted Feature: Highlight newly added content ({recent_changes[:50]}...)\n"
    
    formatted_usp = f"""[Core Gameplay]
(Translated to English) {core_gameplay}

[3 Value Hooks (爽点)]
1. {hooks[0]}
2. {hooks[1]}
3. {hooks[2]}

[Target Audience Persona]
{audience} ({installs} scale proven market)
{updates_section}"""

    return formatted_usp
