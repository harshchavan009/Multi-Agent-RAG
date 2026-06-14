from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import uuid

from app.core.database import get_db
from app.models.schemas import AnalyticsLog, AnalyticsLogResponse, AnalyticsLogCreate
from app.api.chats import get_current_user_email

router = APIRouter(prefix="/analytics-logs", tags=["analytics-logs"])

@router.get("/", response_model=List[AnalyticsLogResponse])
def list_analytics_logs(workspace_id: uuid.UUID, email: str = Depends(get_current_user_email), db: Session = Depends(get_db)):
    logs = db.query(AnalyticsLog).filter(AnalyticsLog.workspace_id == workspace_id).order_by(AnalyticsLog.created_at.desc()).all()
    
    # If no logs exist, insert default telemetry samples for testing
    if not logs:
        defaults = [
            {"query": "Explain database row-level security policy", "tokens": 1250, "cost": 0.0025, "latency": 220, "agent": "RAG Agent"},
            {"query": "Generate a python calculation template", "tokens": 2400, "cost": 0.0048, "latency": 480, "agent": "Code Agent"},
            {"query": "Crawl current market size for AI chips", "tokens": 1850, "cost": 0.0037, "latency": 1150, "agent": "Research Agent"},
        ]
        for d in defaults:
            db.add(AnalyticsLog(
                workspace_id=workspace_id,
                query=d["query"],
                tokens_consumed=d["tokens"],
                cost_usd=d["cost"],
                latency_ms=d["latency"],
                agent_visited=d["agent"]
            ))
        db.commit()
        logs = db.query(AnalyticsLog).filter(AnalyticsLog.workspace_id == workspace_id).order_by(AnalyticsLog.created_at.desc()).all()
        
    return logs

@router.post("/", response_model=AnalyticsLogResponse)
def create_analytics_log(payload: AnalyticsLogCreate, email: str = Depends(get_current_user_email), db: Session = Depends(get_db)):
    new_log = AnalyticsLog(
        workspace_id=payload.workspace_id,
        query=payload.query,
        tokens_consumed=payload.tokens_consumed,
        cost_usd=payload.cost_usd,
        latency_ms=payload.latency_ms,
        agent_visited=payload.agent_visited
    )
    db.add(new_log)
    db.commit()
    db.refresh(new_log)
    return new_log

@router.delete("/{log_id}")
def delete_analytics_log(log_id: uuid.UUID, email: str = Depends(get_current_user_email), db: Session = Depends(get_db)):
    log = db.query(AnalyticsLog).filter(AnalyticsLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Analytics log not found")
    db.delete(log)
    db.commit()
    return {"message": "Analytics log deleted"}
