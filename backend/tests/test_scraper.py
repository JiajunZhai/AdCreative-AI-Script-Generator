import pytest
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scraper import fetch_playstore_data

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
