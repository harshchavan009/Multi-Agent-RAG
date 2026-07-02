from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any
import uuid

from app.core.database import get_db
from app.models.schemas import Integration, IntegrationCreate, IntegrationResponse
from app.api.auth import RoleChecker

router = APIRouter(prefix="/integrations", tags=["integrations"])

@router.get("/", response_model=List[IntegrationResponse])
def list_integrations(
    workspace_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user = Depends(RoleChecker(allowed_roles=["super_admin", "admin", "org_admin"]))
):
    return db.query(Integration).filter(Integration.workspace_id == workspace_id).all()

@router.post("/", response_model=IntegrationResponse)
def save_integration(
    payload: IntegrationCreate,
    db: Session = Depends(get_db),
    current_user = Depends(RoleChecker(allowed_roles=["super_admin", "admin", "org_admin"]))
):
    # Check if this integration already exists in the workspace
    integration = db.query(Integration).filter(
        Integration.workspace_id == payload.workspace_id,
        Integration.name == payload.name
    ).first()

    if not integration:
        integration = Integration(
            workspace_id=payload.workspace_id,
            name=payload.name,
            credentials=payload.credentials,
            is_active=payload.is_active
        )
        db.add(integration)
    else:
        integration.credentials = payload.credentials
        integration.is_active = payload.is_active

    db.commit()
    db.refresh(integration)
    return integration

@router.delete("/{integration_id}")
def delete_integration(
    integration_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user = Depends(RoleChecker(allowed_roles=["super_admin", "admin", "org_admin"]))
):
    integration = db.query(Integration).filter(Integration.id == integration_id).first()
    if not integration:
        raise HTTPException(status_code=404, detail="Integration config not found")
    
    db.delete(integration)
    db.commit()
    return {"message": "Integration removed successfully"}
