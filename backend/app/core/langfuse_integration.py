import os
import uuid
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.schemas import Prompt

# Initialize Langfuse client if credentials are set
langfuse_client = None
if settings.LANGFUSE_PUBLIC_KEY and settings.LANGFUSE_SECRET_KEY:
    try:
        from langfuse import Langfuse
        langfuse_client = Langfuse(
            public_key=settings.LANGFUSE_PUBLIC_KEY,
            secret_key=settings.LANGFUSE_SECRET_KEY,
            host=settings.LANGFUSE_HOST
        )
        print("[Langfuse Integration] Successfully initialized Langfuse client.")
    except Exception as e:
        print(f"[Langfuse Integration] Failed to initialize Langfuse client: {e}")

def get_langfuse_callback(chat_id: str, tags: Optional[List[str]] = None, metadata: Optional[Dict[str, Any]] = None):
    """
    Returns a Langfuse CallbackHandler for Langchain/LangGraph tracking.
    Returns None if Langfuse is not configured.
    """
    if not settings.LANGFUSE_PUBLIC_KEY or not settings.LANGFUSE_SECRET_KEY:
        return None
        
    try:
        from langfuse.callback import CallbackHandler
        
        handler_tags = ["agent-workflow"]
        if tags:
            handler_tags.extend(tags)
            
        handler_metadata = {
            "chat_id": chat_id
        }
        if metadata:
            handler_metadata.update(metadata)
            
        return CallbackHandler(
            public_key=settings.LANGFUSE_PUBLIC_KEY,
            secret_key=settings.LANGFUSE_SECRET_KEY,
            host=settings.LANGFUSE_HOST,
            user_id=chat_id,
            tags=handler_tags,
            metadata=handler_metadata
        )
    except Exception as e:
        print(f"[Langfuse Integration] Failed to instantiate CallbackHandler: {e}")
        return None

def get_active_prompt(db: Session, name: str, default_content: str, workspace_id: Optional[uuid.UUID] = None) -> str:
    """
    Retrieves the active prompt template.
    1. Tries to retrieve from Langfuse prompt registry if configured.
    2. Falls back to querying the local PostgreSQL/SQLite Prompts database table.
    3. Seeds the local database with a default prompt if none is found.
    """
    # 1. Attempt Langfuse Prompt Registry Fetch
    if langfuse_client:
        try:
            # langfuse prompt registry get_prompt
            lf_prompt = langfuse_client.get_prompt(name)
            if lf_prompt and hasattr(lf_prompt, "prompt"):
                content = lf_prompt.prompt
                # Proactively cache/sync this version locally
                if workspace_id:
                    existing = db.query(Prompt).filter(
                        Prompt.workspace_id == workspace_id,
                        Prompt.name == name,
                        Prompt.content == content
                    ).first()
                    if not existing:
                        max_v = db.query(Prompt).filter(
                            Prompt.workspace_id == workspace_id,
                            Prompt.name == name
                        ).order_by(Prompt.version.desc()).first()
                        new_version = (max_v.version + 1) if max_v else 1
                        
                        # Set others to inactive
                        db.query(Prompt).filter(
                            Prompt.workspace_id == workspace_id,
                            Prompt.name == name
                        ).update({"is_active": False})
                        
                        db_prompt = Prompt(
                            workspace_id=workspace_id,
                            name=name,
                            version=new_version,
                            content=content,
                            is_active=True
                        )
                        db.add(db_prompt)
                        db.commit()
                return content
        except Exception as lf_err:
            print(f"[Langfuse Integration] Error fetching prompt '{name}' from Langfuse: {lf_err}")

    # 2. Query Local Database for Active version
    if workspace_id:
        db_prompt = db.query(Prompt).filter(
            Prompt.workspace_id == workspace_id,
            Prompt.name == name,
            Prompt.is_active == True
        ).first()
        if db_prompt:
            return db_prompt.content

        # 3. Seed default prompt in local DB if not present
        try:
            # Query max version to avoid unique key conflicts
            max_v = db.query(Prompt).filter(
                Prompt.workspace_id == workspace_id,
                Prompt.name == name
            ).order_by(Prompt.version.desc()).first()
            new_version = (max_v.version + 1) if max_v else 1

            new_db_prompt = Prompt(
                workspace_id=workspace_id,
                name=name,
                version=new_version,
                content=default_content,
                is_active=True
            )
            db.add(new_db_prompt)
            db.commit()
            db.refresh(new_db_prompt)
            return new_db_prompt.content
        except Exception as db_err:
            print(f"[Langfuse Integration] Error seeding default prompt '{name}' locally: {db_err}")
            return default_content

    return default_content

def sync_prompts_from_langfuse(db: Session, workspace_id: uuid.UUID) -> Dict[str, Any]:
    """
    Forces a sync of known prompt templates from Langfuse Prompt Registry into the local DB.
    """
    if not langfuse_client:
        return {"success": False, "message": "Langfuse client is not initialized. Check your credentials."}

    known_prompts = ["rag_synthesis", "kg_translation"]
    synced = []
    errors = []

    for name in known_prompts:
        try:
            lf_prompt = langfuse_client.get_prompt(name)
            if lf_prompt and hasattr(lf_prompt, "prompt"):
                content = lf_prompt.prompt
                version = getattr(lf_prompt, "version", 1)
                
                # Check if this exact content is already registered
                existing = db.query(Prompt).filter(
                    Prompt.workspace_id == workspace_id,
                    Prompt.name == name,
                    Prompt.content == content
                ).first()
                
                if not existing:
                    # Deactivate existing active prompt
                    db.query(Prompt).filter(
                        Prompt.workspace_id == workspace_id,
                        Prompt.name == name
                    ).update({"is_active": False})

                    # Insert new synced prompt version
                    db_prompt = Prompt(
                        workspace_id=workspace_id,
                        name=name,
                        version=version,
                        content=content,
                        is_active=True
                    )
                    db.add(db_prompt)
                    synced.append(name)
                else:
                    # Make sure it's active
                    db.query(Prompt).filter(
                        Prompt.workspace_id == workspace_id,
                        Prompt.name == name
                    ).update({"is_active": False})
                    existing.is_active = True
                    synced.append(f"{name} (already cached)")
            else:
                errors.append(f"Prompt '{name}' has empty payload in Langfuse.")
        except Exception as e:
            errors.append(f"Failed to fetch '{name}' from Langfuse: {str(e)}")
            
    db.commit()
    return {
        "success": len(synced) > 0 or len(errors) == 0,
        "synced": synced,
        "errors": errors
    }
