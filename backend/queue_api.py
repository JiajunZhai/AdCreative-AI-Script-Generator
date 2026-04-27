import time
import json
import uuid
import asyncio
from typing import Any, Optional
from fastapi import APIRouter
from pydantic import BaseModel

import db

router = APIRouter(prefix="/api/queue", tags=["Queue"])

# Models
class PresetModel(BaseModel):
    id: str
    name: str
    payload_json: str
    pinned: bool = False
    created_at: int

class JobModel(BaseModel):
    id: str
    label: str
    payload_json: str
    status: str
    error: Optional[str] = None
    script_id: Optional[str] = None
    started_at: Optional[int] = None
    finished_at: Optional[int] = None
    created_at: int

class AddPresetRequest(BaseModel):
    name: str
    payload: dict[str, Any]

class UpdatePresetRequest(BaseModel):
    name: Optional[str] = None
    pinned: Optional[bool] = None

class AddJobRequest(BaseModel):
    label: str
    payload: dict[str, Any]

@router.get("/presets", response_model=list[PresetModel])
def list_presets():
    rows = db.fetchall("SELECT * FROM presets ORDER BY pinned DESC, created_at DESC")
    return [
        PresetModel(
            id=r["id"], name=r["name"], payload_json=r["payload_json"],
            pinned=bool(r["pinned"]), created_at=int(r["created_at"])
        )
        for r in rows
    ]

@router.post("/presets", response_model=PresetModel)
def add_preset(req: AddPresetRequest):
    pid = uuid.uuid4().hex[:8]
    now = int(time.time() * 1000)
    payload_str = json.dumps(req.payload)
    db.execute(
        "INSERT INTO presets(id, name, payload_json, pinned, created_at) VALUES(?, ?, ?, 0, ?)",
        (pid, req.name, payload_str, str(now))
    )
    return PresetModel(id=pid, name=req.name, payload_json=payload_str, pinned=False, created_at=now)

@router.delete("/presets/{pid}")
def delete_preset(pid: str):
    db.execute("DELETE FROM presets WHERE id = ?", (pid,))
    return {"success": True}

@router.put("/presets/{pid}")
def update_preset(pid: str, req: UpdatePresetRequest):
    if req.name is not None:
        db.execute("UPDATE presets SET name = ? WHERE id = ?", (req.name, pid))
    if req.pinned is not None:
        db.execute("UPDATE presets SET pinned = ? WHERE id = ?", (1 if req.pinned else 0, pid))
    return {"success": True}

@router.get("/jobs", response_model=list[JobModel])
def list_jobs():
    rows = db.fetchall("SELECT * FROM job_queue ORDER BY created_at ASC")
    return [
        JobModel(
            id=r["id"], label=r["label"], payload_json=r["payload_json"],
            status=r["status"], error=r["error"], script_id=r["script_id"],
            started_at=int(r["started_at"]) if r["started_at"] else None,
            finished_at=int(r["finished_at"]) if r["finished_at"] else None,
            created_at=int(r["created_at"])
        )
        for r in rows
    ]

@router.post("/jobs", response_model=JobModel)
def add_job(req: AddJobRequest):
    jid = uuid.uuid4().hex[:8]
    now = int(time.time() * 1000)
    payload_str = json.dumps(req.payload)
    db.execute(
        "INSERT INTO job_queue(id, label, payload_json, status, created_at) VALUES(?, ?, ?, 'pending', ?)",
        (jid, req.label, payload_str, str(now))
    )
    return JobModel(id=jid, label=req.label, payload_json=payload_str, status='pending', created_at=now)

@router.delete("/jobs/{jid}")
def delete_job(jid: str):
    db.execute("DELETE FROM job_queue WHERE id = ?", (jid,))
    return {"success": True}

@router.post("/jobs/clear")
def clear_jobs(only_finished: bool = False):
    if only_finished:
        db.execute("DELETE FROM job_queue WHERE status IN ('ok', 'failed')")
    else:
        db.execute("DELETE FROM job_queue")
    return {"success": True}

# Background worker
async def background_queue_worker():
    while True:
        try:
            # Pick one pending job
            row = db.fetchone("SELECT id, payload_json FROM job_queue WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1")
            if row:
                job_id = row["id"]
                payload = json.loads(row["payload_json"])
                kind = payload.get("kind", "full_sop")
                
                now = int(time.time() * 1000)
                db.execute("UPDATE job_queue SET status = 'running', started_at = ? WHERE id = ?", (str(now), job_id))
                
                from main import generate_script, quick_copy, refresh_copy
                from main import GenerateScriptRequest, QuickCopyRequest, RefreshCopyRequest
                
                try:
                    result = None
                    if kind == "full_sop":
                        req = GenerateScriptRequest(**payload)
                        result = await asyncio.to_thread(generate_script, req)
                    elif kind == "quick_copy":
                        req = QuickCopyRequest(**payload)
                        result = await asyncio.to_thread(quick_copy, req)
                    elif kind == "refresh_copy":
                        req = RefreshCopyRequest(**payload)
                        result = await asyncio.to_thread(refresh_copy, req)
                    
                    script_id = None
                    if result:
                        if hasattr(result, "script_id"):
                            script_id = result.script_id
                        elif isinstance(result, dict) and "script_id" in result:
                            script_id = result["script_id"]
                    
                    finish_time = int(time.time() * 1000)
                    db.execute(
                        "UPDATE job_queue SET status = 'ok', finished_at = ?, script_id = ? WHERE id = ?",
                        (str(finish_time), script_id, job_id)
                    )
                except Exception as e:
                    import traceback
                    traceback.print_exc()
                    finish_time = int(time.time() * 1000)
                    db.execute(
                        "UPDATE job_queue SET status = 'failed', finished_at = ?, error = ? WHERE id = ?",
                        (str(finish_time), str(e), job_id)
                    )
        except Exception as loop_e:
            import traceback
            traceback.print_exc()
            
        await asyncio.sleep(2)
