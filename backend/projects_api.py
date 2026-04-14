import json
import os
from uuid import uuid4
from datetime import datetime
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/projects", tags=["projects"])

PROJECTS_FILE = "projects.json"

class GameInfo(BaseModel):
    core_gameplay: str = ""
    core_usp: str = ""
    target_persona: str = ""
    value_hooks: str = ""

class TargetAnalysis(BaseModel):
    region_analysis: str = ""
    platform_analysis: str = ""

class MarketTarget(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    region: str
    platform: str
    analysis: TargetAnalysis = Field(default_factory=TargetAnalysis)
    historical_best_script_id: Optional[str] = None

class ProjectBase(BaseModel):
    name: str
    game_info: GameInfo = Field(default_factory=GameInfo)
    market_targets: List[MarketTarget] = Field(default_factory=list)
    history_log: List[dict] = Field(default_factory=list)

class ProjectCreate(ProjectBase):
    pass

class ProjectUpdate(ProjectBase):
    pass

class Project(ProjectBase):
    id: str
    created_at: str
    updated_at: str

WORKSPACE_DIR = os.path.join(os.path.dirname(__file__), 'data', 'workspaces')

def load_projects() -> List[dict]:
    if not os.path.exists(WORKSPACE_DIR):
        os.makedirs(WORKSPACE_DIR)
    projects = []
    for f in os.listdir(WORKSPACE_DIR):
        if f.endswith('.json'):
            with open(os.path.join(WORKSPACE_DIR, f), 'r', encoding='utf-8') as file:
                try:
                    projects.append(json.load(file))
                except json.JSONDecodeError:
                    pass
    return projects

def save_project(project: dict):
    if not os.path.exists(WORKSPACE_DIR):
        os.makedirs(WORKSPACE_DIR)
    path = os.path.join(WORKSPACE_DIR, f"{project['id']}.json")
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(project, f, ensure_ascii=False, indent=2)

@router.get("/", response_model=List[Project])
def get_projects():
    # Sort projects by created_at desc (newest first)
    projs = load_projects()
    projs.sort(key=lambda x: x.get('created_at', ''), reverse=True)
    return projs

@router.post("/", response_model=Project)
def create_project(project_in: ProjectCreate):
    new_project = project_in.model_dump()
    new_project["id"] = str(uuid4())
    # Ensure IDs for nested targets if they don't have one
    for target in new_project.get("market_targets", []):
         if not target.get("id"):
              target["id"] = str(uuid4())
    new_project["created_at"] = datetime.utcnow().isoformat() + "Z"
    new_project["updated_at"] = datetime.utcnow().isoformat() + "Z"
    
    save_project(new_project)
    return new_project

@router.put("/{project_id}", response_model=Project)
def update_project(project_id: str, project_in: ProjectUpdate):
    path = os.path.join(WORKSPACE_DIR, f"{project_id}.json")
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Project not found")
        
    with open(path, 'r', encoding='utf-8') as f:
        p = json.load(f)
        
    updated_p = project_in.model_dump()
    updated_p["id"] = project_id
    updated_p["created_at"] = p.get("created_at", datetime.utcnow().isoformat() + "Z")
    updated_p["updated_at"] = datetime.utcnow().isoformat() + "Z"
    updated_p["history_log"] = p.get("history_log", [])
    
    # ensure sub-ids
    for target in updated_p.get("market_targets", []):
         if not target.get("id"):
              target["id"] = str(uuid4())
    
    save_project(updated_p)
    return updated_p

@router.delete("/{project_id}")
def delete_project(project_id: str):
    path = os.path.join(WORKSPACE_DIR, f"{project_id}.json")
    if os.path.exists(path):
        os.remove(path)
        return {"success": True}
    raise HTTPException(status_code=404, detail="Project not found")
