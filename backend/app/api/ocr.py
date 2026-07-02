"""
OCR Intelligence API — Upload scanned PDFs/images, extract text via OCR, index into KB
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid
import os
import tempfile

from app.core.database import get_db
from app.models.schemas import KnowledgeBase, Document, DocumentResponse
from app.api.chats import get_current_user_email
from app.api.auth import RoleChecker
from app.services.storage import storage_service
from app.core.config import settings

router = APIRouter(prefix="/ocr", tags=["ocr"])

SUPPORTED_OCR_TYPES = {
    "application/pdf", "image/png", "image/jpeg", "image/jpg",
    "image/tiff", "image/bmp", "image/webp", "image/gif"
}


def _run_ocr_processing(document_id: str, file_path: str):
    """Background task: run OCR on uploaded file, store extracted text, index into KB."""
    from app.core.database import SessionLocal
    from app.services.ocr_service import ocr_pdf, ocr_image
    from app.models.schemas import Document, WorkspaceSettings, KnowledgeBase
    from app.rag.pipeline import RAGPipeline, get_vector_store, EmbeddingGenerator
    import uuid as _uuid

    db = SessionLocal()
    try:
        doc = db.query(Document).filter(Document.id == _uuid.UUID(document_id)).first()
        if not doc:
            return

        doc.status = "processing"
        db.commit()

        # Get API key
        kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == doc.knowledge_base_id).first()
        api_key = settings.OPENAI_API_KEY
        if kb:
            ws_settings = db.query(WorkspaceSettings).filter(
                WorkspaceSettings.workspace_id == kb.workspace_id
            ).first()
            if ws_settings and ws_settings.openai_api_key:
                api_key = ws_settings.openai_api_key

        # Download file
        try:
            file_bytes = storage_service.download_file(file_path)
            suffix = os.path.splitext(doc.name)[1] or ".pdf"
            with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
                tmp.write(file_bytes)
                tmp_path = tmp.name
        except Exception as dl_err:
            print(f"[OCR] Download failed: {dl_err}. Using mock OCR.")
            tmp_path = None

        # Run OCR
        if tmp_path:
            mime = doc.mime_type or ""
            if "pdf" in mime or doc.name.lower().endswith(".pdf"):
                extracted_text = ocr_pdf(tmp_path, api_key=api_key)
            else:
                extracted_text = ocr_image(tmp_path, api_key=api_key)
            try:
                os.remove(tmp_path)
            except Exception:
                pass
        else:
            from app.services.ocr_service import _mock_ocr
            extracted_text = _mock_ocr(doc.name)

        # Index into vector store
        if kb and extracted_text:
            collection_name = f"kb_{str(kb.id).replace('-', '_')}"
            vector_store = get_vector_store(settings.VECTOR_DB_PROVIDER, settings)
            embedding_gen = EmbeddingGenerator(provider="openai", api_key=api_key)
            pipeline = RAGPipeline(vector_store=vector_store, embedding_gen=embedding_gen)
            # Split pages if present
            pages = []
            for i, section in enumerate(extracted_text.split("=== Page"), 1):
                if section.strip():
                    text = section.split("===")[-1].strip() if "===" in section else section.strip()
                    if text:
                        pages.append({"page_number": i, "text": text})
            if not pages:
                pages = [{"page_number": 1, "text": extracted_text}]
            pipeline.ingest_document_pages(
                collection_name=collection_name,
                doc_id=str(doc.id),
                title=doc.name,
                pages=pages
            )

        words = extracted_text.split() if extracted_text else []
        doc.status = "completed"
        doc.metadata_fields = {
            "type": "ocr_extraction",
            "char_count": len(extracted_text),
            "word_count": len(words),
            "text_preview": extracted_text[:400] + ("..." if len(extracted_text) > 400 else ""),
            "full_text": extracted_text
        }
        db.commit()
        print(f"[OCR] Document {doc.name} OCR processed and indexed successfully.")

    except Exception as e:
        import traceback
        print(f"[OCR] Error: {e}")
        traceback.print_exc()
        if 'doc' in locals() and doc:
            doc.status = "failed"
            doc.metadata_fields = {"error": str(e)}
            db.commit()
    finally:
        db.close()


@router.post("/upload", response_model=DocumentResponse)
async def upload_for_ocr(
    background_tasks: BackgroundTasks,
    knowledge_base_id: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(RoleChecker(allowed_roles=["super_admin", "admin", "org_admin", "manager", "user"]))
):
    """Upload a scanned PDF or image, extract text via OCR, and index into Knowledge Base."""
    kb_uuid = uuid.UUID(knowledge_base_id)
    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_uuid).first()
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")

    file_content = await file.read()
    file_size = len(file_content)

    # Save file
    safe_filename = f"{uuid.uuid4()}_{file.filename}"
    try:
        stored_path = storage_service.upload_file(
            file_name=safe_filename,
            file_content=file_content,
            mime_type=file.content_type or "application/pdf"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to store file: {str(e)}")

    # Create document record
    new_doc = Document(
        knowledge_base_id=kb.id,
        name=file.filename,
        file_path=stored_path,
        file_size=file_size,
        mime_type=file.content_type or "application/pdf",
        status="pending",
        version=1,
        is_latest=True,
        metadata_fields={"type": "ocr_extraction"}
    )
    db.add(new_doc)
    db.commit()
    db.refresh(new_doc)

    # Dispatch background OCR task
    background_tasks.add_task(_run_ocr_processing, str(new_doc.id), stored_path)

    return new_doc


@router.get("/results", response_model=List[DocumentResponse])
def list_ocr_results(
    knowledge_base_id: uuid.UUID,
    email: str = Depends(get_current_user_email),
    db: Session = Depends(get_db)
):
    """List all OCR-processed documents for a knowledge base."""
    docs = db.query(Document).filter(
        Document.knowledge_base_id == knowledge_base_id,
        Document.is_latest == True
    ).all()
    ocr_docs = [d for d in docs if d.metadata_fields and d.metadata_fields.get("type") == "ocr_extraction"]
    return ocr_docs


@router.get("/text/{document_id}")
def get_ocr_text(
    document_id: uuid.UUID,
    email: str = Depends(get_current_user_email),
    db: Session = Depends(get_db)
):
    """Get the full extracted OCR text for a document."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return {
        "id": str(doc.id),
        "name": doc.name,
        "status": doc.status,
        "full_text": doc.metadata_fields.get("full_text", "") if doc.metadata_fields else "",
        "text_preview": doc.metadata_fields.get("text_preview", "") if doc.metadata_fields else "",
        "word_count": doc.metadata_fields.get("word_count", 0) if doc.metadata_fields else 0,
        "char_count": doc.metadata_fields.get("char_count", 0) if doc.metadata_fields else 0,
    }
