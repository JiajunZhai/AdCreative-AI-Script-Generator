import ollama_client

def test_repair_json_strict_json_ok():
    raw = '{"hook_score": 95, "script": []}'
    parsed = ollama_client.repair_json(raw)
    assert parsed["hook_score"] == 95

def test_repair_json_extracts_embedded_json():
    raw = 'random prefix {"hook_score": 88, "script": []} trailing'
    parsed = ollama_client.repair_json(raw)
    assert parsed["hook_score"] == 88

def test_repair_json_empty_output_returns_structured_error():
    parsed = ollama_client.repair_json("")
    assert parsed["success"] is False
    assert parsed["error_code"] == "LOCAL_EMPTY_OUTPUT"

def test_repair_json_invalid_output_returns_parse_error():
    parsed = ollama_client.repair_json("not a json payload at all")
    assert parsed["success"] is False
    assert parsed["error_code"] == "LOCAL_JSON_PARSE_FAILED"
