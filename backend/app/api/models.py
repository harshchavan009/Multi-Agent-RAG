from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import uuid

from app.core.database import get_db
from app.models.schemas import LLMModel, LLMModelCreate, LLMModelResponse, LLMModelBase
from app.api.chats import get_current_user_email

router = APIRouter(prefix="/models", tags=["models"])

@router.get("/", response_model=List[LLMModelResponse])
def list_models(workspace_id: uuid.UUID, email: str = Depends(get_current_user_email), db: Session = Depends(get_db)):
    models = db.query(LLMModel).filter(LLMModel.workspace_id == workspace_id).all()
    # If no models exist in this workspace, populate default standard engines
    if not models:
        defaults = [
            {"name": "GPT-4o", "provider": "OpenAI", "model_name": "gpt-4o", "latency": "140ms", "cost": "$2.50 / M"},
            {"name": "Claude 3.5 Sonnet", "provider": "Anthropic", "model_name": "claude-3-5-sonnet", "latency": "280ms", "cost": "$3.00 / M"},
            {"name": "DeepSeek R1", "provider": "DeepSeek", "model_name": "deepseek-r1", "latency": "640ms", "cost": "$0.55 / M"},
            {"name": "Gemini 1.5 Pro", "provider": "Gemini", "model_name": "gemini-1.5-pro", "latency": "310ms", "cost": "$1.25 / M"},
        ]
        for d in defaults:
            new_model = LLMModel(
                workspace_id=workspace_id,
                name=d["name"],
                provider=d["provider"],
                model_name=d["model_name"],
                latency=d["latency"],
                cost=d["cost"],
                is_active=True
            )
            db.add(new_model)
        db.commit()
        models = db.query(LLMModel).filter(LLMModel.workspace_id == workspace_id).all()
    return models

@router.post("/", response_model=LLMModelResponse)
def create_model(payload: LLMModelCreate, email: str = Depends(get_current_user_email), db: Session = Depends(get_db)):
    new_model = LLMModel(
        workspace_id=payload.workspace_id,
        name=payload.name,
        provider=payload.provider,
        model_name=payload.model_name,
        latency=payload.latency or "200ms",
        cost=payload.cost or "$1.00 / M",
        is_active=payload.is_active if payload.is_active is not None else True
    )
    db.add(new_model)
    db.commit()
    db.refresh(new_model)
    return new_model

@router.put("/{model_id}", response_model=LLMModelResponse)
def update_model(model_id: uuid.UUID, payload: LLMModelBase, email: str = Depends(get_current_user_email), db: Session = Depends(get_db)):
    model = db.query(LLMModel).filter(LLMModel.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
        
    model.name = payload.name
    model.provider = payload.provider
    model.model_name = payload.model_name
    model.latency = payload.latency
    model.cost = payload.cost
    model.is_active = payload.is_active
    db.commit()
    db.refresh(model)
    return model

@router.delete("/{model_id}")
def delete_model(model_id: uuid.UUID, email: str = Depends(get_current_user_email), db: Session = Depends(get_db)):
    model = db.query(LLMModel).filter(LLMModel.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    db.delete(model)
    db.commit()
    return {"message": "Model removed from registry"}
