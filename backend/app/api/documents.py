from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
import uuid
import os

from app.core.database import get_db
from app.models.schemas import KnowledgeBase, Document, KnowledgeBaseCreate, KnowledgeBaseResponse, DocumentResponse
from app.api.chats import get_current_user_email
from app.tasks.ingestion import process_document
from app.core.config import settings
from app.services.storage import storage_service
from app.api.auth import RoleChecker

router = APIRouter(prefix="/documents", tags=["documents"])

@router.post("/kb", response_model=KnowledgeBaseResponse)
def create_knowledge_base(
    payload: KnowledgeBaseCreate,
    db: Session = Depends(get_db),
    current_user = Depends(RoleChecker(allowed_roles=["super_admin", "admin", "org_admin", "manager"]))
):
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
    db: Session = Depends(get_db),
    current_user = Depends(RoleChecker(allowed_roles=["super_admin", "admin", "org_admin", "manager"]))
):
    # Verify KB exists
    kb_uuid = uuid.UUID(knowledge_base_id)
    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_uuid).first()
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")

    # Read file content for storage upload
    file_content = await file.read()
    file_size = len(file_content)

    # Document Versioning: check if a file with same name already exists in KB
    existing_docs = db.query(Document).filter(
        Document.knowledge_base_id == kb.id,
        Document.name == file.filename
    ).all()
    
    version = 1
    if existing_docs:
        version = max(d.version for d in existing_docs) + 1
        for d in existing_docs:
            d.is_latest = False

    # Save file using S3/Local Storage Service
    safe_filename = f"{uuid.uuid4()}_{file.filename}"
    try:
        stored_path = storage_service.upload_file(
            file_name=safe_filename,
            file_content=file_content,
            mime_type=file.content_type
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to store file: {str(e)}")

    # Create Document record
    new_doc = Document(
        knowledge_base_id=kb.id,
        name=file.filename,
        file_path=stored_path,
        file_size=file_size,
        mime_type=file.content_type,
        status="pending",
        version=version,
        is_latest=True,
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
def list_documents(
    knowledge_base_id: uuid.UUID,
    show_all_versions: bool = False,
    email: str = Depends(get_current_user_email),
    db: Session = Depends(get_db)
):
    query = db.query(Document).filter(Document.knowledge_base_id == knowledge_base_id)
    if not show_all_versions:
        query = query.filter(Document.is_latest == True)
    docs = query.order_by(Document.name.asc(), Document.version.desc()).all()
    return docs

@router.get("/knowledge-graph")
def get_knowledge_graph(db: Session = Depends(get_db)):
    try:
        from app.rag.neo4j_adapter import Neo4jAdapter
        adapter = Neo4jAdapter()
        nodes = adapter.query("MATCH (n) RETURN n.name AS name, labels(n)[0] AS label")
        relationships = adapter.query("MATCH (n)-[r]->(m) RETURN n.name AS source, labels(n)[0] AS source_label, type(r) AS type, m.name AS target, labels(m)[0] AS target_label")
        
        if adapter.mock_mode or not nodes:
            nodes = [{"name": name, "label": label} for name, label in adapter.mock_nodes.items()]
            relationships = [
                {
                    "source": r["source"],
                    "source_label": r["source_label"],
                    "target": r["target"],
                    "target_label": r["target_label"],
                    "type": r["type"]
                }
                for r in adapter.mock_relationships
            ]
            
        return {
            "nodes": nodes,
            "relationships": relationships
        }
    except Exception as e:
        try:
            from app.rag.neo4j_adapter import Neo4jAdapter
            adapter = Neo4jAdapter()
            return {
                "nodes": [{"name": name, "label": label} for name, label in adapter.mock_nodes.items()],
                "relationships": [
                    {
                        "source": r["source"],
                        "source_label": r["source_label"],
                        "target": r["target"],
                        "target_label": r["target_label"],
                        "type": r["type"]
                    }
                    for r in adapter.mock_relationships
                ]
            }
        except Exception:
            raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{document_id}")
def delete_document(
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user = Depends(RoleChecker(allowed_roles=["super_admin", "admin", "org_admin", "manager"]))
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # 1. Remove from storage
    if doc.file_path:
        try:
            storage_service.delete_file(doc.file_path)
        except Exception as storage_ex:
            print(f"[Document Delete] Storage file deletion failed: {storage_ex}")

    # 2. Remove from vector DB
    try:
        from app.rag.pipeline import get_vector_store
        kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == doc.knowledge_base_id).first()
        if kb:
            collection_name = f"kb_{str(kb.id).replace('-', '_')}"
            vector_store = get_vector_store(settings.VECTOR_DB_PROVIDER, settings)
            vector_store.delete_vectors(collection_name, str(doc.id))
    except Exception as vector_ex:
        print(f"[Document Delete] Vector database deletion failed: {vector_ex}")

    # 3. Delete from DB
    db.delete(doc)
    db.commit()

    return {"message": "Document deleted successfully"}

class GraphQueryPayload(BaseModel):
    query: str

@router.post("/knowledge-graph/query")
def query_knowledge_graph(payload: GraphQueryPayload, db: Session = Depends(get_db)):
    from app.rag.neo4j_adapter import Neo4jAdapter
    adapter = Neo4jAdapter()
    
    cypher_query = ""
    openai_key = os.getenv("OPENAI_API_KEY")
    if openai_key and not openai_key.startswith("mock") and not openai_key.startswith("super-secret") and "••••" not in openai_key:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=openai_key)
            prompt = f"""
            You are a Cypher query generator for Neo4j.
            The database contains the following entity labels: Employee, Department, Project, Policy, Product, Organization.
            And the following relationship types:
            - (:Employee)-[:belongs_to]->(:Department)
            - (:Project)-[:managed_by]->(:Employee)
            
            Translate this natural language request into a valid Cypher query:
            Request: "{payload.query}"
            
            Respond only with the Cypher query. Do not include markdown code block syntax (like ```cypher or ```), intro, or outro text.
            """
            chat_res = client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.0
            )
            cypher_query = chat_res.choices[0].message.content.strip()
        except Exception as llm_err:
            print(f"[Graph LLM Cypher Generator Error] {llm_err}")
            
    if not cypher_query:
        query_lower = payload.query.lower()
        if "manage" in query_lower or "manager" in query_lower or "managed by" in query_lower:
            proj = "Apollo Project"
            for name, label in adapter.mock_nodes.items():
                if label == "Project" and name.lower() in query_lower:
                    proj = name
            cypher_query = f"MATCH (p:Project {{name: '{proj}'}})-[:managed_by]->(e:Employee) RETURN p.name AS project, e.name AS employee"
        elif "department" in query_lower or "belongs to" in query_lower or "works in" in query_lower:
            emp = "Alice"
            for name, label in adapter.mock_nodes.items():
                if label == "Employee" and name.lower() in query_lower:
                    emp = name
            cypher_query = f"MATCH (e:Employee {{name: '{emp}'}})-[:belongs_to]->(d:Department) RETURN e.name AS employee, d.name AS department"
        else:
            cypher_query = "MATCH (n)-[r]->(m) RETURN n.name AS source, type(r) AS type, m.name AS target LIMIT 5"

    try:
        results = adapter.query(cypher_query)
    except Exception as query_err:
        print(f"[Graph query failed] {query_err}")
        results = []

    answer = ""
    if openai_key and not openai_key.startswith("mock") and not openai_key.startswith("super-secret") and "••••" not in openai_key:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=openai_key)
            prompt = f"""
            You are a helpful graph database assistant.
            The user asked the question: "{payload.query}"
            We queried the Neo4j graph database using the Cypher query:
            "{cypher_query}"
            And retrieved the following records:
            {results}
            
            Synthesize a brief, natural language response answering the user's question directly based on the records.
            """
            answer_res = client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3
            )
            answer = answer_res.choices[0].message.content.strip()
        except Exception as ans_err:
            print(f"[Answer Synthesis Error] {ans_err}")

    if not answer:
        if results:
            summary = []
            for r in results:
                items = [f"{k}: {v}" for k, v in r.items()]
                summary.append(", ".join(items))
            answer = f"Retrieved matches: " + "; ".join(summary)
        else:
            answer = "No matching relationship records found in the database graph."

    return {
        "cypher": cypher_query,
        "results": results,
        "answer": answer
    }

