"""
Autonomous Research API — Start research tasks, poll status, view reports
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid
import os

from app.core.database import get_db
from app.models.schemas import ResearchTask, ResearchTaskCreate, ResearchTaskResponse
from app.api.chats import get_current_user_email
from app.api.auth import RoleChecker

router = APIRouter(prefix="/research", tags=["autonomous-research"])


def _run_research_in_background(task_id: str, query: str, workspace_id: str, email_to: Optional[str]):
    """Wrapper to run autonomous research in background thread."""
    from app.services.research_agent import run_autonomous_research
    from app.core.database import SessionLocal
    db = SessionLocal()
    try:
        run_autonomous_research(
            task_id=task_id,
            query=query,
            workspace_id=workspace_id,
            email_to=email_to,
            db=db
        )
    finally:
        db.close()


@router.post("/", response_model=ResearchTaskResponse)
def start_research(
    payload: ResearchTaskCreate,
    background_tasks: BackgroundTasks,
    current_user=Depends(RoleChecker(allowed_roles=["super_admin", "admin", "org_admin", "manager", "user"])),
    db: Session = Depends(get_db)
):
    """
    Start an autonomous research task.
    The system will automatically:
    1. Research the topic using web intelligence
    2. Search the workspace knowledge base
    3. Synthesize a comparison/analysis report
    4. Generate a PDF report
    5. Email the report (if email_to provided and SMTP configured)
    """
    task = ResearchTask(
        workspace_id=payload.workspace_id,
        query=payload.query,
        email_to=payload.email_to,
        status="pending"
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    # Dispatch background research
    background_tasks.add_task(
        _run_research_in_background,
        str(task.id),
        payload.query,
        str(payload.workspace_id),
        payload.email_to
    )

    return task


@router.get("/", response_model=List[ResearchTaskResponse])
def list_research_tasks(
    workspace_id: uuid.UUID,
    email: str = Depends(get_current_user_email),
    db: Session = Depends(get_db)
):
    """List all research tasks for a workspace."""
    tasks = db.query(ResearchTask).filter(
        ResearchTask.workspace_id == workspace_id
    ).order_by(ResearchTask.created_at.desc()).all()
    return tasks


@router.get("/{task_id}", response_model=ResearchTaskResponse)
def get_research_task(
    task_id: uuid.UUID,
    email: str = Depends(get_current_user_email),
    db: Session = Depends(get_db)
):
    """Get research task status and results by ID."""
    task = db.query(ResearchTask).filter(ResearchTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Research task not found")
    return task


@router.get("/{task_id}/download-pdf")
def get_pdf_download_info(
    task_id: uuid.UUID,
    email: str = Depends(get_current_user_email),
    db: Session = Depends(get_db)
):
    """Get PDF download information for a completed research task."""
    task = db.query(ResearchTask).filter(ResearchTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Research task not found")
    if task.status != "completed":
        raise HTTPException(status_code=400, detail=f"Task is not completed yet. Status: {task.status}")
    if not task.pdf_filename:
        raise HTTPException(status_code=404, detail="No PDF report available for this task")

    uploads_dir = "/Users/harsh/Desktop/Multi agent rag/uploads"
    pdf_path = os.path.join(uploads_dir, task.pdf_filename)
    pdf_exists = os.path.exists(pdf_path)

    return {
        "task_id": str(task.id),
        "pdf_filename": task.pdf_filename,
        "pdf_path": pdf_path if pdf_exists else None,
        "pdf_available": pdf_exists,
        "download_url": f"/uploads/{task.pdf_filename}" if pdf_exists else None
    }


@router.delete("/{task_id}")
def delete_research_task(
    task_id: uuid.UUID,
    email: str = Depends(get_current_user_email),
    db: Session = Depends(get_db)
):
    """Delete a research task."""
    task = db.query(ResearchTask).filter(ResearchTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Research task not found")
    db.delete(task)
    db.commit()
    return {"message": "Research task deleted successfully"}
