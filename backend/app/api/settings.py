from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import uuid

from app.core.database import get_db
from app.models.schemas import WorkspaceSettings, WorkspaceSettingsResponse, WorkspaceSettingsCreate
from app.api.chats import get_current_user_email

router = APIRouter(prefix="/settings", tags=["settings"])

@router.get("/", response_model=WorkspaceSettingsResponse)
def get_settings(workspace_id: uuid.UUID, email: str = Depends(get_current_user_email), db: Session = Depends(get_db)):
    settings = db.query(WorkspaceSettings).filter(WorkspaceSettings.workspace_id == workspace_id).first()
    if not settings:
        # Create default settings record on access
        settings = WorkspaceSettings(
            workspace_id=workspace_id,
            openai_api_key="••••••••••••••••••••••••••••••••••••••••",
            rag_context_limit=5,
            theme="dark"
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings

@router.post("/", response_model=WorkspaceSettingsResponse)
def update_settings(payload: WorkspaceSettingsCreate, email: str = Depends(get_current_user_email), db: Session = Depends(get_db)):
    settings = db.query(WorkspaceSettings).filter(WorkspaceSettings.workspace_id == payload.workspace_id).first()
    if not settings:
        settings = WorkspaceSettings(workspace_id=payload.workspace_id)
        db.add(settings)
        
    settings.openai_api_key = payload.openai_api_key
    settings.rag_context_limit = payload.rag_context_limit
    settings.theme = payload.theme
    
    db.commit()
    db.refresh(settings)
    return settings
