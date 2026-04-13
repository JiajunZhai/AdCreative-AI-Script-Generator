import pytest

def test_api_generate_mock_fallback(client):
    """
    Test the endpoint with an invalid URL and ensure the fallback mock logic is hit.
    """
    payload = {
        "title": "API Test Title",
        "usp": "Fast Paced",
        "platform": "TikTok",
        "angle": "Evolution",
        "region": "NA/EU",
        "playstoreUrl": "https://invalid.google.com/store/apps/xyz",
        "engine": "cloud"
    }
    
    response = client.post("/api/generate", json=payload)
    
    # Even on mock fallback, the response should be HTTP 200
    assert response.status_code == 200
    data = response.json()
    
    assert "hook_score" in data
    assert "script" in data
    assert "citations" in data
    # Ensure title was passed into fallback properly
    assert "API Test Title" in data["hook_reasoning"] or "API Test Title" in data["hook_reasoning"]

def test_api_ingest_oracle_invalid_empty(client):
    """
    Test the Oracle Ingestion endpoint with missing parameters to ensure robust handling.
    """
    payload = {
        "raw_text": "",
        "source_url": "", # Empty URL should fail because both are missing
        "year_quarter": "2024-Q1"
    }
    
    response = client.post("/api/refinery/ingest", json=payload)
    
    # Should probably be 422 Unprocessable Entity, but if handled gracefully 200 with success=False
    # Our schema specifies strings, Pydantic passes it to the handler
    data = response.json()
    assert data["success"] is False
    assert "error" in data or "failed" in str(data).lower()
