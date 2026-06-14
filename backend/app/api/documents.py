from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
import uuid
import os

from app.core.database import get_db
from app.models.schemas import KnowledgeBase, Document, KnowledgeBaseCreate, KnowledgeBaseResponse, DocumentResponse
from app.api.chats import get_current_user_email
from app.tasks.ingestion import process_document
from app.core.config import settings

router = APIRouter(prefix="/documents", tags=["documents"])

# Physical directory to cache file uploads
UPLOAD_DIR = "/Users/harsh/Desktop/Multi agent rag/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/kb", response_model=KnowledgeBaseResponse)
def create_knowledge_base(payload: KnowledgeBaseCreate, email: str = Depends(get_current_user_email), db: Session = Depends(get_db)):
    new_kb = KnowledgeBase(
        workspace_id=payload.workspace_id,
        name=payload.name,
        description=payload.description,
        vector_settings=payload.vector_settings or {}
    )
    db.add(new_kb)
    db.commit()
    db.refresh(new_kb)
    return new_kb

@router.get("/kb", response_model=List[KnowledgeBaseResponse])
def list_knowledge_bases(workspace_id: uuid.UUID, email: str = Depends(get_current_user_email), db: Session = Depends(get_db)):
    kb_list = db.query(KnowledgeBase).filter(KnowledgeBase.workspace_id == workspace_id).all()
    return kb_list

@router.post("/upload", response_model=DocumentResponse)
async def upload_document(
    background_tasks: BackgroundTasks,
    knowledge_base_id: str = Form(...),
    file: UploadFile = File(...),
    email: str = Depends(get_current_user_email),
    db: Session = Depends(get_db)
):
    # Verify KB exists
    kb_uuid = uuid.UUID(knowledge_base_id)
    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_uuid).first()
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")

    # Save physical file chunk stream locally
    safe_filename = f"{uuid.uuid4()}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, safe_filename)
    
    file_size = 0
    try:
        with open(file_path, "wb") as buffer:
            while chunk := await file.read(1024 * 1024):  # 1MB chunks
                buffer.write(chunk)
                file_size += len(chunk)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to store file: {str(e)}")

    # Create Document record
    new_doc = Document(
        knowledge_base_id=kb.id,
        name=file.filename,
        file_path=file_path,
        file_size=file_size,
        mime_type=file.content_type,
        status="pending",
        metadata_fields={}
    )
    db.add(new_doc)
    db.commit()
    db.refresh(new_doc)

    # Route indexing task to background worker thread (Celery) or FastAPI BackgroundTasks
    try:
        from app.tasks.celery_app import has_celery
        if not has_celery:
            raise Exception("Celery not installed or in mock mode")
            
        import redis
        r = redis.Redis.from_url(settings.REDIS_URL, socket_timeout=1.0)
        r.ping()
        
        process_document.delay(str(new_doc.id))
        print(f"Enqueued document {new_doc.name} indexing task via Celery.")
    except Exception as worker_err:
        print(f"Celery queue not available ({worker_err}). Routing to FastAPI BackgroundTasks thread.")
        background_tasks.add_task(process_document, str(new_doc.id))

    db.refresh(new_doc)
    return new_doc

@router.get("/", response_model=List[DocumentResponse])
def list_documents(knowledge_base_id: uuid.UUID, email: str = Depends(get_current_user_email), db: Session = Depends(get_db)):
    docs = db.query(Document).filter(Document.knowledge_base_id == knowledge_base_id).all()
    return docs
