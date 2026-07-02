from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List, Optional
from app.core.database import get_db
from app.models.schemas import AgentMemory
from app.rag.memory import AgentMemorySystem
from pydantic import BaseModel
from datetime import datetime

router = APIRouter()

class MemoryResponse(BaseModel):
    id: str
    workspace_id: str
    chat_id: Optional[str]
    memory_type: str
    content: str
    created_at: datetime

    class Config:
        orm_mode = True
        from_attributes = True

@router.get("/", response_model=List[MemoryResponse])
def get_workspace_memories(
    workspace_id: UUID,
    db: Session = Depends(get_db)
):
    """Retrieves all active workspace, long-term, and semantic memories."""
    memories = db.query(AgentMemory).filter(
        AgentMemory.workspace_id == workspace_id
    ).order_by(AgentMemory.created_at.desc()).all()
    return memories

@router.get("/search")
def search_semantic_memories(
    workspace_id: UUID,
    query: str,
    limit: int = 5,
    db: Session = Depends(get_db)
):
    """Performs a vector-similarity semantic memory lookup."""
    memory_sys = AgentMemorySystem(db=db, workspace_id=workspace_id)
    return memory_sys.search_semantic_memories(query, limit=limit)

@router.post("/compress")
def trigger_memory_compression(
    workspace_id: UUID,
    db: Session = Depends(get_db)
):
    """Manually triggers the OpenAI consolidation compression engine for facts."""
    memory_sys = AgentMemorySystem(db=db, workspace_id=workspace_id)
    memory_sys.compress_memories()
    return {"status": "success", "detail": "Facts consolidated successfully."}

@router.delete("/{memory_id}")
def delete_memory(
    memory_id: UUID,
    db: Session = Depends(get_db)
):
    """Deletes a specific memory from database storage."""
    mem = db.query(AgentMemory).filter(AgentMemory.id == memory_id).first()
    if not mem:
        raise HTTPException(status_code=404, detail="Memory entity not found")
    db.delete(mem)
    db.commit()
    return {"status": "success", "detail": "Memory deleted successfully"}
