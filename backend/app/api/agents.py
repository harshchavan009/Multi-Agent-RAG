from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import uuid

from app.core.database import get_db
from app.models.schemas import Agent, AgentCreate, AgentResponse
from app.api.chats import get_current_user_email

router = APIRouter(prefix="/agents", tags=["agents"])

@router.post("/", response_model=AgentResponse)
def create_agent(payload: AgentCreate, email: str = Depends(get_current_user_email), db: Session = Depends(get_db)):
    # Create customized agent configuration
    new_agent = Agent(
        workspace_id=payload.workspace_id,
        name=payload.name,
        role=payload.role,
        system_prompt=payload.system_prompt,
        model_provider=payload.model_provider,
        model_name=payload.model_name,
        temperature=payload.temperature,
        tools=payload.tools,
        memory_config=payload.memory_config
    )
    db.add(new_agent)
    db.commit()
    db.refresh(new_agent)
    return new_agent

@router.get("/", response_model=List[AgentResponse])
def list_agents(workspace_id: uuid.UUID, email: str = Depends(get_current_user_email), db: Session = Depends(get_db)):
    agents = db.query(Agent).filter(Agent.workspace_id == workspace_id).all()
    return agents

@router.delete("/{agent_id}")
def delete_agent(agent_id: uuid.UUID, email: str = Depends(get_current_user_email), db: Session = Depends(get_db)):
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent profile not found")
    db.delete(agent)
    db.commit()
    return {"message": "Agent deleted successfully"}
