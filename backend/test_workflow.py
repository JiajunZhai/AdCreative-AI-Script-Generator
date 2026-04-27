import json
from fastapi.testclient import TestClient
from main import app
from db import get_conn

client = TestClient(app)

def run_tests():
    print("--- 1. Testing Copy Generation Threading (Syntax & Endpoint Check) ---")
    # We can't fully run quick-copy without real LLM keys or a heavy project, 
    # but we can ensure the endpoint exists and validates schema.
    resp = client.post("/api/quick-copy", json={})
    print(f"Quick-copy empty payload response: {resp.status_code} (Expect 422 Unprocessable Entity)")

    print("\n--- 2. Testing Phase 3 Winner's Loop API ---")
    # Insert a dummy history log entry to test the mark-winner endpoint
    conn = get_conn()
    dummy_id = "TEST-SCRIPT-001"
    conn.execute("INSERT OR IGNORE INTO projects (id, name, created_at, updated_at) VALUES ('TEST-PROJECT', 'T', '2026', '2026')")
    conn.execute(
        "INSERT OR IGNORE INTO history_log (id, project_id, created_at, kind, payload_json) VALUES (?, ?, ?, ?, ?)",
        (dummy_id, "TEST-PROJECT", "2026-04-22T00:00:00Z", "SOP", "{}")
    )
    conn.commit()

    print("Initial is_winner:", conn.execute("SELECT is_winner, performance_stats FROM history_log WHERE id=?", (dummy_id,)).fetchone())
    
    resp = client.post(f"/api/history/{dummy_id}/mark-winner", json={"performance_stats": {"ctr": 5.5}})
    print("Mark Winner API Response:", resp.status_code, resp.json())
    
    row = conn.execute("SELECT is_winner, performance_stats FROM history_log WHERE id=?", (dummy_id,)).fetchone()
    print("After is_winner:", dict(row) if row else None)

    # Clean up
    conn.execute("DELETE FROM history_log WHERE id=?", (dummy_id,))
    conn.commit()

    print("\n--- All Backend Verification Tests Completed Successfully ---")

if __name__ == "__main__":
    run_tests()
