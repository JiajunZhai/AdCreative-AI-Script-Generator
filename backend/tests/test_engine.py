import pytest
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from prompts import get_system_prompt_template

def test_prompt_regional_directive_japan():
    """
    Ensure the prompt correctly maps 'Japan' logic and explicitly handles Japanese conventions.
    """
    prompt = get_system_prompt_template(
        title="Test Game",
        usp="Anime Waifu Collector",
        platform="TikTok",
        angle="剧情决策型 (Drama)",
        region="Japan"
    )
    
    # Assert specific regional keywords inject into the context
    assert "Danmaku" in prompt
    assert "Voice Actor (CV)" in prompt
    assert "Meme cut" not in prompt # NA/EU specific

def test_prompt_conflict_resolution_directive():
    """
    Ensure that injecting oracle RAG context triggers the conflict resolution constraint.
    """
    oracle_str = "[Market Context from Vector Intelligence]\n- Context Rule 1: Use Red UI\n- Context Rule 2: Use Blue UI"
    
    prompt = get_system_prompt_template(
        title="Test Game",
        usp="Match 3",
        platform="Facebook",
        angle="解压割草型 (ASMR)",
        region="NA/EU",
        oracle_context=oracle_str
    )
    
    assert "Context Rule 1: Use Red UI" in prompt
    assert "CONFLICT RESOLUTION: If you detect contradictory instructions" in prompt
