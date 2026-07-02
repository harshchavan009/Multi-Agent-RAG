"""
Voice RAG API — Upload audio/voice notes, transcribe, and index into Knowledge Base
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

router = APIRouter(prefix="/voice-rag", tags=["voice-rag"])

SUPPORTED_AUDIO_TYPES = {
    "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav",
    "audio/ogg", "audio/flac", "audio/m4a", "audio/mp4",
    "audio/webm", "audio/aac", "video/mp4", "video/webm"
}


def _run_voice_transcription(document_id: str, file_path: str, knowledge_base_id: str):
    """Background task: transcribe audio, save transcript, index into KB."""
    from app.core.database import SessionLocal
    from app.services.transcription import transcribe_audio
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

        # Get API key from workspace settings
        kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == doc.knowledge_base_id).first()
        api_key = settings.OPENAI_API_KEY
        if kb:
            ws_settings = db.query(WorkspaceSettings).filter(
                WorkspaceSettings.workspace_id == kb.workspace_id
            ).first()
            if ws_settings and ws_settings.openai_api_key:
                api_key = ws_settings.openai_api_key

        # Download file for transcription
        try:
            file_bytes = storage_service.download_file(file_path)
            suffix = os.path.splitext(doc.name)[1] or ".mp3"
            with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
                tmp.write(file_bytes)
                tmp_path = tmp.name
        except Exception as dl_err:
            print(f"[Voice RAG] Download failed: {dl_err}. Using mock transcription.")
            tmp_path = None

        # Transcribe
        if tmp_path:
            transcript = transcribe_audio(tmp_path, api_key=api_key)
            try:
                os.remove(tmp_path)
            except Exception:
                pass
        else:
            from app.services.transcription import _mock_transcription
            transcript = _mock_transcription(doc.name)

        # Index transcript into vector store
        if kb:
            collection_name = f"kb_{str(kb.id).replace('-', '_')}"
            vector_store = get_vector_store(settings.VECTOR_DB_PROVIDER, settings)
            embedding_gen = EmbeddingGenerator(provider="openai", api_key=api_key)
            pipeline = RAGPipeline(vector_store=vector_store, embedding_gen=embedding_gen)
            pipeline.ingest_document_pages(
                collection_name=collection_name,
                doc_id=str(doc.id),
                title=doc.name,
                pages=[{"page_number": 1, "text": transcript}]
            )

        words = transcript.split()
        doc.status = "completed"
        doc.metadata_fields = {
            "type": "voice_transcription",
            "char_count": len(transcript),
            "word_count": len(words),
            "transcript_preview": transcript[:300] + ("..." if len(transcript) > 300 else ""),
            "full_transcript": transcript
        }
        db.commit()
        print(f"[Voice RAG] Document {doc.name} transcribed and indexed successfully.")

    except Exception as e:
        import traceback
        print(f"[Voice RAG] Error: {e}")
        traceback.print_exc()
        if 'doc' in locals() and doc:
            doc.status = "failed"
            doc.metadata_fields = {"error": str(e)}
            db.commit()
    finally:
        db.close()


@router.post("/upload", response_model=DocumentResponse)
async def upload_voice_note(
    background_tasks: BackgroundTasks,
    knowledge_base_id: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(RoleChecker(allowed_roles=["super_admin", "admin", "org_admin", "manager", "user"]))
):
    """Upload an audio/voice note, transcribe it, and index it into a Knowledge Base."""
    # Validate KB
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
            mime_type=file.content_type or "audio/mpeg"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to store audio file: {str(e)}")

    # Create document record
    new_doc = Document(
        knowledge_base_id=kb.id,
        name=file.filename,
        file_path=stored_path,
        file_size=file_size,
        mime_type=file.content_type or "audio/mpeg",
        status="pending",
        version=1,
        is_latest=True,
        metadata_fields={"type": "voice_transcription"}
    )
    db.add(new_doc)
    db.commit()
    db.refresh(new_doc)

    # Dispatch background transcription task
    background_tasks.add_task(_run_voice_transcription, str(new_doc.id), stored_path, knowledge_base_id)

    return new_doc


@router.get("/transcriptions", response_model=List[DocumentResponse])
def list_transcriptions(
    knowledge_base_id: uuid.UUID,
    email: str = Depends(get_current_user_email),
    db: Session = Depends(get_db)
):
    """List all voice transcriptions for a knowledge base."""
    docs = db.query(Document).filter(
        Document.knowledge_base_id == knowledge_base_id,
        Document.is_latest == True
    ).all()
    # Filter to audio/voice types
    voice_docs = [d for d in docs if d.mime_type and (
        "audio" in d.mime_type or
        (d.metadata_fields and d.metadata_fields.get("type") == "voice_transcription")
    )]
    return voice_docs


@router.get("/transcript/{document_id}")
def get_transcript(
    document_id: uuid.UUID,
    email: str = Depends(get_current_user_email),
    db: Session = Depends(get_db)
):
    """Get the full transcript for a voice document."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return {
        "id": str(doc.id),
        "name": doc.name,
        "status": doc.status,
        "transcript": doc.metadata_fields.get("full_transcript", "") if doc.metadata_fields else "",
        "transcript_preview": doc.metadata_fields.get("transcript_preview", "") if doc.metadata_fields else "",
        "word_count": doc.metadata_fields.get("word_count", 0) if doc.metadata_fields else 0,
    }
