import pytest
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from exporter import generate_pdf_report

def test_pdf_exporter():
    """
    Ensure the exporter generates a valid PDF buffer and does not crash when 
    fed a typical Generation API Response.
    """
    mock_response = {
        "title": "Brawl Stars",
        "usp": "Fast 3v3 MOBA",
        "platform": "TikTok",
        "angle": "Evolution",
        "region": "NA/EU",
        "hook_score": 95,
        "hook_reasoning": "Interruptive pattern",
        "clarity_score": 90,
        "clarity_reasoning": "Clear mechanic",
        "conversion_score": 85,
        "conversion_reasoning": "Call to action urge",
        "bgm_direction": "Phonk",
        "editing_rhythm": "Fast jump cuts",
        "script": [
            {
               "time": "0s",
               "visual": "Player starts",
               "audio_content": "Whoa!",
               "audio_meaning": "Woah!",
               "text_content": "START",
               "text_meaning": "START"
            }
        ],
        "psychology_insight": "Test Insight",
        "cultural_notes": ["Test Note"],
        "competitor_trend": "Test Trend"
    }
    
    import base64
    # generate_pdf_report returns a base64 string
    b64_str = generate_pdf_report(mock_response)
    
    assert b64_str is not None
    
    # Decode to verify PDF magic bytes
    pdf_bytes = base64.b64decode(b64_str)
    assert pdf_bytes.startswith(b'%PDF')
    
    assert len(pdf_bytes) > 1000
