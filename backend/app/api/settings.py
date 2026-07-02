from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import uuid
from pydantic import BaseModel
from typing import Optional

from app.core.database import get_db
from app.models.schemas import WorkspaceSettings, WorkspaceSettingsResponse, WorkspaceSettingsCreate
from app.api.chats import get_current_user_email

from app.api.auth import RoleChecker

router = APIRouter(prefix="/settings", tags=["settings"])

@router.get("/", response_model=WorkspaceSettingsResponse)
def get_settings(
    workspace_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user = Depends(RoleChecker(allowed_roles=["super_admin", "admin", "org_admin"]))
):
    settings = db.query(WorkspaceSettings).filter(WorkspaceSettings.workspace_id == workspace_id).first()
    if not settings:
        # Create default settings record on access
        settings = WorkspaceSettings(
            workspace_id=workspace_id,
            openai_api_key="••••••••••••••••••••••••••••••••••••••••",
            rag_context_limit=5,
            theme="dark",
            active_model_name="gpt-4o"
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings

@router.post("/", response_model=WorkspaceSettingsResponse)
def update_settings(
    payload: WorkspaceSettingsCreate,
    db: Session = Depends(get_db),
    current_user = Depends(RoleChecker(allowed_roles=["super_admin", "admin", "org_admin"]))
):
    settings = db.query(WorkspaceSettings).filter(WorkspaceSettings.workspace_id == payload.workspace_id).first()
    if not settings:
        settings = WorkspaceSettings(workspace_id=payload.workspace_id)
        db.add(settings)
        
    settings.openai_api_key = payload.openai_api_key
    settings.rag_context_limit = payload.rag_context_limit
    settings.theme = payload.theme
    settings.active_model_name = payload.active_model_name or settings.active_model_name
    settings.active_model_api_key = payload.active_model_api_key or settings.active_model_api_key
    
    db.commit()
    db.refresh(settings)
    return settings


class ModelSwitchPayload(BaseModel):
    workspace_id: uuid.UUID
    model_name: str
    api_key: Optional[str] = None


@router.patch("/model", response_model=WorkspaceSettingsResponse)
def switch_active_model(
    payload: ModelSwitchPayload,
    db: Session = Depends(get_db),
    email: str = Depends(get_current_user_email)
):
    """Switch the active LLM model for this workspace. Any authenticated user can do this."""
    settings = db.query(WorkspaceSettings).filter(WorkspaceSettings.workspace_id == payload.workspace_id).first()
    if not settings:
        settings = WorkspaceSettings(workspace_id=payload.workspace_id)
        db.add(settings)
    settings.active_model_name = payload.model_name
    if payload.api_key:
        settings.active_model_api_key = payload.api_key
    db.commit()
    db.refresh(settings)
    return settings
