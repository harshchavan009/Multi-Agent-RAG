import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import uuid

from app.main import app
from app.core.database import Base, get_db
from app.core.security import get_password_hash
from app.models.schemas import User, Organization, Workspace, OrganizationMember, Chat, Message, Workflow, KnowledgeBase
from app.rag.pipeline import RAGPipeline, InMemoryVectorStore, EmbeddingGenerator
from app.services.evaluator import AIEvaluator
from app.agents.graph import execute_agent_workflow

# Configure sqlite database file for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_auth_temp.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def db_session():
    # Force Drop and Recreate tables for a clean test sandbox
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()

# ==========================================
# AUTHENTICATION TESTS
# ==========================================

def test_signup_success(client):
    payload = {
        "email": "architect@enterprise.com",
        "password": "SecurePassword123",
        "first_name": "Antigravity",
        "last_name": "Architect"
    }
    response = client.post("/api/v1/auth/signup", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "architect@enterprise.com"
    assert "id" in data

def test_login_fail_bad_credentials(client):
    payload = {
        "email": "wrong@enterprise.com",
        "password": "WrongPassword"
    }
    response = client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 401

def test_enterprise_auth_lifecycle(client, db_session):
    # 1. Onboard member user
    signup_payload = {
        "email": "employee@enterprise.com",
        "password": "SecretPassword",
        "first_name": "Test",
        "last_name": "Employee"
    }
    signup_res = client.post("/api/v1/auth/signup", json=signup_payload)
    assert signup_res.status_code == 200
    user_data = signup_res.json()
    assert user_data["is_email_verified"] is False
    
    # Check verification token exists in DB
    user_db = db_session.query(User).filter(User.email == "employee@enterprise.com").first()
    assert user_db.email_verification_token is not None
    v_token = user_db.email_verification_token

    # 2. Verify Email address endpoint
    verify_res = client.post("/api/v1/auth/verify-email", json={"token": v_token})
    assert verify_res.status_code == 200
    assert verify_res.json()["message"] == "Email address successfully verified."

    # 3. Request Password Recovery token
    forgot_res = client.post("/api/v1/auth/forgot-password", json={"email": "employee@enterprise.com"})
    assert forgot_res.status_code == 200
    db_session.refresh(user_db)
    reset_token = user_db.password_reset_token
    assert reset_token is not None

    # 4. Reset Password with token
    reset_res = client.post("/api/v1/auth/reset-password", json={"token": reset_token, "new_password": "NewSecretPassword"})
    assert reset_res.status_code == 200

    # 5. Log in with updated credentials & get access/refresh tokens
    login_res = client.post("/api/v1/auth/login", json={"email": "employee@enterprise.com", "password": "NewSecretPassword"})
    assert login_res.status_code == 200
    tokens = login_res.json()
    assert "access_token" in tokens
    acc_token = tokens["access_token"]
    
    # 6. Fetch user profile session
    session_res = client.get("/api/v1/auth/session", headers={"Authorization": f"Bearer {acc_token}"})
    assert session_res.status_code == 200
    profile = session_res.json()
    assert profile["email"] == "employee@enterprise.com"
    assert profile["role"] == "admin"
    assert profile["is_email_verified"] is True


# ==========================================
# RAG PIPELINE DENSE/SPARSE TESTS
# ==========================================

def test_rag_hybrid_retrieval():
    # Setup mock store and embedding generator
    store = InMemoryVectorStore()
    emb = EmbeddingGenerator()
    pipeline = RAGPipeline(vector_store=store, embedding_gen=emb)

    collection = "kb_test_001"
    pipeline.ingest_document(
        collection_name=collection,
        doc_id="doc_a",
        title="GDPR Audit",
        text="All customer data must be isolated and row level database partitioning active."
    )
    
    pipeline.ingest_document(
        collection_name=collection,
        doc_id="doc_b",
        title="Web Stack",
        text="NextJS 15 React 19 and Tailwind CSS styling setup guidelines."
    )

    results = pipeline.hybrid_search(collection, "customer data isolation", limit=1)
    assert len(results) > 0
    assert "isolated" in results[0]["text"].lower()
    assert results[0]["doc_id"] == "doc_a"

def test_real_enterprise_rag():
    from app.rag.pipeline import rewrite_query, RAGPipeline, InMemoryVectorStore, EmbeddingGenerator
    
    # 1. Test Query Rewriting
    q1 = "What is the leave policy?"
    rewritten_1 = rewrite_query(q1)
    assert rewritten_1 == "employee leave policy annual leave sick leave company handbook"
    
    q2 = "Explain RAG search boundaries"
    rewritten_2 = rewrite_query(q2)
    assert "explain" not in rewritten_2.split()
    assert "boundaries" in rewritten_2.split()
    
    # 2. Test Ingestion with Pages & Hybrid search
    store = InMemoryVectorStore()
    emb = EmbeddingGenerator()
    pipeline = RAGPipeline(vector_store=store, embedding_gen=emb)
    collection = "kb_test_enterprise"
    
    pages = [
        {"page_number": 1, "text": "This is page one discussing organizational roles."},
        {"page_number": 12, "text": "What is the leave policy? The employee leave policy allows annual leave and sick leave. Detailed company handbook terms apply."}
    ]
    
    pipeline.ingest_document_pages(
        collection_name=collection,
        doc_id="doc_handbook",
        title="Employee_Handbook.pdf",
        pages=pages
    )
    
    # Search for leave policy
    results = pipeline.hybrid_search(
        collection_name=collection,
        query="What is the leave policy?",
        limit=5,
        reranker_provider="local"
    )
    
    assert len(results) > 0
    top_hit = results[0]
    assert top_hit["doc_id"] == "doc_handbook"
    assert top_hit["page"] == 12
    assert "leave policy" in top_hit["text"].lower()
    
    for r in results:
        assert "score" in r
        assert r["score"] >= 0.0

# ==========================================
# MULTI-AGENT GRAPH & EVALUATION TESTS
# ==========================================

def test_evaluator_metrics():
    sources = [
        "Row level security enforces workspace isolation rules.",
        "Celery queues index document vectors asynchronously."
    ]
    response_a = "Row level security enforces workspace isolation."
    response_b = "I love eating delicious pizza for dinner on Friday nights."

    scores_a = AIEvaluator.evaluate_turn("Explain security boundaries", response_a, sources)
    scores_b = AIEvaluator.evaluate_turn("Explain security boundaries", response_b, sources)

    # Response A is highly grounded; Response B is a hallucination relative to sources
    assert scores_a["groundedness_score"] > 0.8
    assert scores_a["hallucination_score"] < 0.2
    assert scores_b["groundedness_score"] < 0.3
    assert scores_b["hallucination_score"] > 0.7

def test_agent_graph_execution(db_session):
    # Onboard mock user, org, and workspace to run graph dependencies
    user = User(email="test_graph@agent.com", password_hash=get_password_hash("pass"))
    db_session.add(user)
    db_session.flush()

    org = Organization(name="Test Org", slug="test-org")
    db_session.add(org)
    db_session.flush()

    member = OrganizationMember(organization_id=org.id, user_id=user.id, role="org_admin")
    db_session.add(member)

    ws = Workspace(organization_id=org.id, name="Test WS", slug="test-ws")
    db_session.add(ws)
    db_session.flush()

    chat = Chat(workspace_id=ws.id, user_id=user.id, title="Test Chat")
    db_session.add(chat)
    db_session.commit()

    # Store the User Message
    user_msg = Message(
        chat_id=chat.id,
        role="user",
        content="What is customer data isolation policy?"
    )
    db_session.add(user_msg)
    db_session.commit()

    # Execute graph loop
    result = execute_agent_workflow(
        query="What is customer data isolation policy?",
        workspace_id=str(ws.id),
        chat_id=chat.id,
        db=db_session
    )

    assert "response" in result
    assert "citations" in result
    assert "evaluations" in result
    # Check messages logged in database
    msgs = db_session.query(Message).filter(Message.chat_id == chat.id).all()
    assert len(msgs) == 2 # 1 User message + 1 Assistant message


def test_qdrant_adapter_and_ingestion(db_session):
    from app.rag.pipeline import QdrantAdapter, EmbeddingGenerator, RAGPipeline
    import shutil
    import os

    # 1. Test QdrantAdapter Local Persistent Fallback
    local_path = "./qdrant_local_test_run"
    if os.path.exists(local_path):
        shutil.rmtree(local_path)

    # Use QdrantAdapter (will fallback to local_path since url localhost:9999 is down)
    adapter = QdrantAdapter(url="http://localhost:9999")
    # Force use of local path for testing isolation
    from qdrant_client import QdrantClient
    adapter.client = QdrantClient(path=local_path)

    emb = EmbeddingGenerator()
    pipeline = RAGPipeline(vector_store=adapter, embedding_gen=emb)

    collection = "kb_test_qdrant_run"
    pipeline.ingest_document(
        collection_name=collection,
        doc_id="test_doc_1",
        title="GDPR Data Portability",
        text="GDPR mandates that users can request dynamic exports of their customer data profiles."
    )

    results = pipeline.hybrid_search(collection, "dynamic customer data exports", limit=1)
    assert len(results) > 0
    assert "GDPR mandates" in results[0]["text"]
    assert results[0]["doc_id"] == "test_doc_1"

    # Clean up local qdrant test directory
    if os.path.exists(local_path):
        shutil.rmtree(local_path)


def test_chat_file_upload_and_agent_search(client, db_session):
    import app.tasks.ingestion
    import app.agents.graph
    
    orig_ingestion_session = app.tasks.ingestion.SessionLocal
    orig_graph_session = app.agents.graph.SessionLocal
    
    app.tasks.ingestion.SessionLocal = TestingSessionLocal
    app.agents.graph.SessionLocal = TestingSessionLocal
    
    try:
        import os
        from app.models.schemas import User, Organization, Workspace, OrganizationMember, Chat, Message, KnowledgeBase
        from app.core.security import get_password_hash
        from app.core.config import settings
        import uuid

        # 1. Onboard user, organization, workspace, and chat thread
        user = User(email="chat_uploader@enterprise.com", password_hash=get_password_hash("pass"), is_email_verified=True)
        db_session.add(user)
        db_session.flush()

        org = Organization(name="Chat Uploader Org", slug="chat-uploader-org")
        db_session.add(org)
        db_session.flush()

        member = OrganizationMember(organization_id=org.id, user_id=user.id, role="org_admin")
        db_session.add(member)

        ws = Workspace(organization_id=org.id, name="Chat Uploader WS", slug="chat-uploader-ws")
        db_session.add(ws)
        db_session.flush()

        chat = Chat(workspace_id=ws.id, user_id=user.id, title="Test Chat File Upload")
        db_session.add(chat)
        db_session.commit()

        # Generate token for client authorization
        from app.core.security import create_access_token
        token = create_access_token(subject=user.email, org_id=str(org.id), role="org_admin")
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Check/create knowledge base
        kb = db_session.query(KnowledgeBase).filter(KnowledgeBase.workspace_id == ws.id).first()
        if not kb:
            kb = KnowledgeBase(workspace_id=ws.id, name="Default Chat Knowledge Base", description="Chat upload test")
            db_session.add(kb)
            db_session.commit()

        # Create temporary text file
        test_file_path = "test_upload_rules.txt"
        with open(test_file_path, "w") as f:
            f.write("Workspace Rule 1: All customer tenant profiles must be strictly isolated.\n")
            f.write("Workspace Rule 2: Cross-tenant searches are forbidden.\n")

        # 3. Perform file upload via endpoint
        with open(test_file_path, "rb") as f:
            response = client.post(
                "/api/v1/documents/upload",
                data={"knowledge_base_id": str(kb.id)},
                files={"file": (os.path.basename(test_file_path), f, "text/plain")},
                headers=headers
            )
        
        # Clean up file
        if os.path.exists(test_file_path):
            os.remove(test_file_path)

        assert response.status_code == 200
        doc_data = response.json()
        assert doc_data["status"] in ["completed", "processing", "pending"]

        # Flush database changes to make sure background tasks are committed before executing RAG search
        db_session.commit()

        # 4. Trigger message and execute workflow
        msg_response = client.post(
            f"/api/v1/chats/{chat.id}/messages",
            json={"chat_id": str(chat.id), "role": "user", "content": "What is Workspace Rule 2?"},
            headers=headers
        )
        assert msg_response.status_code == 200
        msg_data = msg_response.json()
        assert "response" in msg_data
        assert len(msg_data["citations"]) > 0
        assert "Workspace Rule 2" in msg_data["response"]
        
    finally:
        app.tasks.ingestion.SessionLocal = orig_ingestion_session
        app.agents.graph.SessionLocal = orig_graph_session


def test_workspace_settings_crud(client, db_session):
    # 1. Onboard user and workspace
    user = User(email="settings_owner@enterprise.com", password_hash=get_password_hash("pass"), is_email_verified=True)
    db_session.add(user)
    db_session.flush()

    org = Organization(name="Settings Org", slug="settings-org")
    db_session.add(org)
    db_session.flush()

    member = OrganizationMember(organization_id=org.id, user_id=user.id, role="org_admin")
    db_session.add(member)

    ws = Workspace(organization_id=org.id, name="Settings WS", slug="settings-ws")
    db_session.add(ws)
    db_session.commit()

    # Generate token for client authorization
    from app.core.security import create_access_token
    token = create_access_token(subject=user.email, org_id=str(org.id), role="org_admin")
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Get initial settings (defaults should be auto-created)
    get_res = client.get(f"/api/v1/settings/?workspace_id={ws.id}", headers=headers)
    assert get_res.status_code == 200
    data = get_res.json()
    assert data["openai_api_key"] == "••••••••••••••••••••••••••••••••••••••••"
    assert data["rag_context_limit"] == 5
    assert data["theme"] == "dark"

    # 3. Update settings
    payload = {
        "workspace_id": str(ws.id),
        "openai_api_key": "sk-new-secret-key-1234",
        "rag_context_limit": 15,
        "theme": "light"
    }
    post_res = client.post("/api/v1/settings/", json=payload, headers=headers)
    assert post_res.status_code == 200
    updated_data = post_res.json()
    assert updated_data["openai_api_key"] == "sk-new-secret-key-1234"
    assert updated_data["rag_context_limit"] == 15
    assert updated_data["theme"] == "light"

    # 4. Fetch settings again and check persistence
    get_res_again = client.get(f"/api/v1/settings/?workspace_id={ws.id}", headers=headers)
    assert get_res_again.status_code == 200
    persisted_data = get_res_again.json()
    assert persisted_data["openai_api_key"] == "sk-new-secret-key-1234"
    assert persisted_data["rag_context_limit"] == 15
    assert persisted_data["theme"] == "light"


def test_chat_streaming_persistence(client, db_session):
    # 1. Onboard user and workspace
    user = User(email="streamer@enterprise.com", password_hash=get_password_hash("pass"), is_email_verified=True)
    db_session.add(user)
    db_session.flush()

    org = Organization(name="Streamer Org", slug="streamer-org")
    db_session.add(org)
    db_session.flush()

    member = OrganizationMember(organization_id=org.id, user_id=user.id, role="org_admin")
    db_session.add(member)

    ws = Workspace(organization_id=org.id, name="Streamer WS", slug="streamer-ws")
    db_session.add(ws)
    db_session.flush()

    chat = Chat(workspace_id=ws.id, user_id=user.id, title="Stream test chat")
    db_session.add(chat)
    db_session.commit()

    # Generate token
    from app.core.security import create_access_token
    token = create_access_token(subject=user.email, org_id=str(org.id), role="org_admin")
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Call stream endpoint
    payload = {
        "chat_id": str(chat.id),
        "role": "user",
        "content": "Verify code sandbox execution template print(5 * 5)",
        "selected_agent": "code"
    }
    
    response = client.post(f"/api/v1/chats/{chat.id}/messages/stream", json=payload, headers=headers)
    assert response.status_code == 200
    
    stream_content = response.text
    assert "data: " in stream_content
    assert "agent_start" in stream_content
    assert "token" in stream_content
    assert "done" in stream_content

    # 3. Check message persistence in DB
    messages = db_session.query(Message).filter(Message.chat_id == chat.id).all()
    assert len(messages) == 2  # 1 User message + 1 Assistant message
    assistant_msg = next(m for m in messages if m.role == "assistant")
    assert "Sandbox" in assistant_msg.content or "Code" in assistant_msg.content


def test_workflow_engine_execution(client, db_session):
    # 1. Onboard user, org, and workspace
    user = User(email="workflow_runner@enterprise.com", password_hash=get_password_hash("pass"), is_email_verified=True)
    db_session.add(user)
    db_session.flush()

    org = Organization(name="Workflow Org", slug="workflow-org")
    db_session.add(org)
    db_session.flush()

    member = OrganizationMember(organization_id=org.id, user_id=user.id, role="org_admin")
    db_session.add(member)

    ws = Workspace(organization_id=org.id, name="Workflow WS", slug="workflow-ws")
    db_session.add(ws)
    db_session.commit()

    # Generate token
    from app.core.security import create_access_token
    token = create_access_token(subject=user.email, org_id=str(org.id), role="org_admin")
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Define workflow nodes (Webhook, Database, API, etc.)
    definition = {
        "nodes": [
            {
                "id": "node_sched",
                "name": "Schedule Trigger",
                "type": "schedule",
                "config": {"schedule": "*/5 * * * *"}
            },
            {
                "id": "node_manual",
                "name": "Manual Trigger",
                "type": "manual",
                "config": {}
            },
            {
                "id": "node_web",
                "name": "Webhook Trigger",
                "type": "webhook",
                "config": {"source": "http://localhost:8000/webhook"}
            },
            {
                "id": "node_kb",
                "name": "Query Knowledge Base",
                "type": "query_knowledge_base",
                "config": {"query": "compliance regulations"}
            },
            {
                "id": "node_agent",
                "name": "Run Agent (Compliance)",
                "type": "run_agent",
                "config": {"agent": "compliance", "prompt": "Check if contract violates NDA policy"}
            },
            {
                "id": "node_report",
                "name": "Generate Report",
                "type": "generate_report",
                "config": {"title": "Risk Assessment Report", "content": "No high risks found."}
            },
            {
                "id": "node_email",
                "name": "Send Email",
                "type": "send_email",
                "config": {
                    "to": "legal@enterprise.com",
                    "subject": "Risk Assessment Complete",
                    "body": "Please review the generated report."
                }
            },
            {
                "id": "node_api",
                "name": "Fetch Test Endpoint",
                "type": "api",
                "config": {"url": "https://httpbin.org/get", "method": "GET"}
            },
            {
                "id": "node_db",
                "name": "Query Local Users",
                "type": "database",
                "config": {"query": "SELECT * FROM users LIMIT 1;"}
            }
        ]
    }

    # 3. Create workflow in DB
    workflow = Workflow(
        workspace_id=ws.id,
        name="Telemetry Pipeline",
        definition=definition,
        is_active=True
    )
    db_session.add(workflow)
    db_session.commit()

    # 4. Trigger workflow execution endpoint (mocking network calls)
    from unittest.mock import patch, AsyncMock, MagicMock
    mock_res = MagicMock()
    mock_res.status_code = 200
    mock_res.text = '{"greetings": "hello"}'
    
    mock_get = AsyncMock(return_value=mock_res)
    mock_post = AsyncMock(return_value=mock_res)
    mock_request = AsyncMock(return_value=mock_res)
    
    with patch("httpx.AsyncClient.get", mock_get), \
         patch("httpx.AsyncClient.post", mock_post), \
         patch("httpx.AsyncClient.request", mock_request):
        response = client.post(f"/api/v1/workflows/{workflow.id}/execute", headers=headers)
        
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["workflow_id"] == str(workflow.id)
    assert res_data["success"] is True
    assert len(res_data["logs"]) == 9

    # Check validation logs
    assert res_data["logs"][0]["node_name"] == "Schedule Trigger"
    assert res_data["logs"][0]["status"] == "success"
    assert "Triggered successfully via cron" in res_data["logs"][0]["output"]

    assert res_data["logs"][1]["node_name"] == "Manual Trigger"
    assert res_data["logs"][1]["status"] == "success"
    assert "Manual trigger node executed" in res_data["logs"][1]["output"]

    assert res_data["logs"][2]["node_name"] == "Webhook Trigger"
    assert res_data["logs"][2]["status"] == "success"
    assert "Triggered successfully via webhook" in res_data["logs"][2]["output"]

    assert res_data["logs"][3]["node_name"] == "Query Knowledge Base"
    assert res_data["logs"][3]["status"] == "success"
    assert "Knowledge base query returned" in res_data["logs"][3]["output"]

    assert res_data["logs"][4]["node_name"] == "Run Agent (Compliance)"
    assert res_data["logs"][4]["status"] == "success"
    assert "finished graph execution" in res_data["logs"][4]["output"]

    assert res_data["logs"][5]["node_name"] == "Generate Report"
    assert res_data["logs"][5]["status"] == "success"
    assert "generated PDF report" in res_data["logs"][5]["output"]

    assert res_data["logs"][6]["node_name"] == "Send Email"
    assert res_data["logs"][6]["status"] == "success"
    assert "Email successfully sent" in res_data["logs"][6]["output"]

    assert res_data["logs"][7]["node_name"] == "Fetch Test Endpoint"
    assert res_data["logs"][7]["status"] == "success"

    assert res_data["logs"][8]["node_name"] == "Query Local Users"
    assert res_data["logs"][8]["status"] == "success"
    assert "SQL query executed successfully" in res_data["logs"][8]["output"]


def test_document_versioning_and_rbac(client, db_session):
    # 1. Onboard two users: one org_admin (admin) and one standard user
    admin_user = User(email="admin_owner@enterprise.com", password_hash=get_password_hash("pass"), is_email_verified=True)
    db_session.add(admin_user)
    
    standard_user = User(email="regular_user@enterprise.com", password_hash=get_password_hash("pass"), is_email_verified=True)
    db_session.add(standard_user)
    db_session.flush()

    org = Organization(name="Test Versioning Org", slug="test-versioning-org")
    db_session.add(org)
    db_session.flush()

    # Map admin user as admin
    member_admin = OrganizationMember(organization_id=org.id, user_id=admin_user.id, role="admin")
    db_session.add(member_admin)

    # Map standard user as user
    member_user = OrganizationMember(organization_id=org.id, user_id=standard_user.id, role="user")
    db_session.add(member_user)

    ws = Workspace(organization_id=org.id, name="Versioning WS", slug="versioning-ws")
    db_session.add(ws)
    db_session.flush()

    kb = KnowledgeBase(workspace_id=ws.id, name="Versioning KB", description="Versioning test library")
    db_session.add(kb)
    db_session.commit()

    # Generate tokens
    from app.core.security import create_access_token
    admin_token = create_access_token(subject=admin_user.email, org_id=str(org.id), role="admin")
    user_token = create_access_token(subject=standard_user.email, org_id=str(org.id), role="user")
    
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    user_headers = {"Authorization": f"Bearer {user_token}"}

    # 2. Try to upload a document as a standard user -> Should fail with 403 Forbidden (RBAC)
    import io
    file_payload = {"file": ("manual.txt", io.BytesIO(b"Workspace guidelines details"), "text/plain")}
    rbac_res = client.post(
        "/api/v1/documents/upload",
        data={"knowledge_base_id": str(kb.id)},
        files=file_payload,
        headers=user_headers
    )
    assert rbac_res.status_code == 403
    assert "Forbidden" in rbac_res.json()["detail"]

    # 3. Upload document as admin -> Should succeed and create Version 1
    file_payload_1 = {"file": ("manual.txt", io.BytesIO(b"Workspace guidelines v1"), "text/plain")}
    upload_res_1 = client.post(
        "/api/v1/documents/upload",
        data={"knowledge_base_id": str(kb.id)},
        files=file_payload_1,
        headers=admin_headers
    )
    assert upload_res_1.status_code == 200
    doc_1 = upload_res_1.json()
    assert doc_1["version"] == 1
    assert doc_1["is_latest"] is True

    # 4. Upload document with the same name as admin -> Should create Version 2 and mark Version 1 as is_latest=False
    file_payload_2 = {"file": ("manual.txt", io.BytesIO(b"Workspace guidelines v2"), "text/plain")}
    upload_res_2 = client.post(
        "/api/v1/documents/upload",
        data={"knowledge_base_id": str(kb.id)},
        files=file_payload_2,
        headers=admin_headers
    )
    assert upload_res_2.status_code == 200
    doc_2 = upload_res_2.json()
    assert doc_2["version"] == 2
    assert doc_2["is_latest"] is True

    # Query database directly to verify version 1 state
    from app.models.schemas import Document
    db_doc_1 = db_session.query(Document).filter(Document.id == uuid.UUID(doc_1["id"])).first()
    assert db_doc_1.version == 1
    assert db_doc_1.is_latest is False

    # 5. List documents without show_all_versions -> Should return only Version 2
    list_res_latest = client.get(f"/api/v1/documents/?knowledge_base_id={kb.id}", headers=admin_headers)
    assert list_res_latest.status_code == 200
    latest_docs = list_res_latest.json()
    assert len(latest_docs) == 1
    assert latest_docs[0]["version"] == 2

    # 6. List documents with show_all_versions -> Should return both versions
    list_res_all = client.get(f"/api/v1/documents/?knowledge_base_id={kb.id}&show_all_versions=true", headers=admin_headers)
    assert list_res_all.status_code == 200
    all_docs = list_res_all.json()
    assert len(all_docs) == 2
    assert all_docs[0]["version"] == 2
    assert all_docs[1]["version"] == 1

def test_multi_agent_architecture(db_session):
    import os
    import uuid
    from app.models.schemas import User, Organization, Workspace, OrganizationMember, Chat, Message
    from app.core.security import get_password_hash
    from app.agents.graph import execute_agent_workflow, run_crewai_execution
    
    # 1. Onboard mock workspace/chat dependencies
    user = User(email="agent_test@enterprise.com", password_hash=get_password_hash("pass"), is_email_verified=True)
    db_session.add(user)
    db_session.flush()
    
    org = Organization(name="MultiAgent Org", slug="multiagent-org")
    db_session.add(org)
    db_session.flush()
    
    member = OrganizationMember(organization_id=org.id, user_id=user.id, role="org_admin")
    db_session.add(member)
    
    ws = Workspace(organization_id=org.id, name="MultiAgent WS", slug="multiagent-ws")
    db_session.add(ws)
    db_session.flush()
    
    chat = Chat(workspace_id=ws.id, user_id=user.id, title="Test Chat")
    db_session.add(chat)
    db_session.commit()
    
    # 2. Test RAG / Compliance / Reporting Sequential Execution in LangGraph
    # We trigger the compliance agent explicitly using the selected_agent routing override
    comp_result = execute_agent_workflow(
        query="Validate our compliance parameters relative to the leave handbook policies.",
        workspace_id=str(ws.id),
        chat_id=chat.id,
        db=db_session,
        selected_agent="compliance"
    )
    
    assert "Compliance Agent" in comp_result["response"] or "Compliance Officer" in comp_result["response"]
    assert "STATUS:" in comp_result["response"]
    
    # Run the reporting node to generate a PDF summary
    rep_result = execute_agent_workflow(
        query="Compile and generate a PDF report of all workflow logs.",
        workspace_id=str(ws.id),
        chat_id=chat.id,
        db=db_session,
        selected_agent="reporting"
    )
    
    assert "Reporting Agent" in rep_result["response"] or "PDF" in rep_result["response"]
    assert "report_" in rep_result["response"]
    
    # 3. Test CrewAI Collaborative Execution Team
    crew_result = run_crewai_execution(
        query="Run the collaborative crew to draft a leave policy report and validate compliance.",
        workspace_id=str(ws.id),
        chat_id=str(chat.id),
        db=db_session
    )
    
    assert crew_result["success"] is True
    assert "CrewAI" in crew_result["response"]
    assert "Compliance Agent" in crew_result["response"]
    assert "Reporting Agent" in crew_result["response"]
    
    # Check that PDF report file was physically generated
    report_filename = f"report_{chat.id}.pdf"
    report_path = os.path.join("/Users/harsh/Desktop/Multi agent rag/uploads", report_filename)
    assert os.path.exists(report_path)
    
    # Clean up generated PDF
    if os.path.exists(report_path):
        os.remove(report_path)


def test_knowledge_graph_extraction_and_reasoning(client, db_session):
    import os
    import uuid
    from app.models.schemas import User, Organization, Workspace, OrganizationMember, Chat, Message
    from app.core.security import get_password_hash
    from app.rag.neo4j_adapter import Neo4jAdapter, get_mock_graph_extraction
    from app.tasks.ingestion import process_document
    from app.agents.graph import execute_agent_workflow
    
    # 1. Verify Neo4jAdapter initialization and mock fallbacks
    adapter = Neo4jAdapter()
    assert adapter is not None
    
    # Clean previous mock graphs
    adapter.mock_nodes.clear()
    adapter.mock_relationships.clear()
    
    # Insert node
    adapter.add_node("Alice", "Employee")
    adapter.add_node("Engineering", "Department")
    adapter.add_node("Apollo Project", "Project")
    
    # Insert relationships
    adapter.add_relationship("Alice", "Employee", "Engineering", "Department", "belongs_to")
    adapter.add_relationship("Apollo Project", "Project", "Alice", "Employee", "managed_by")
    
    # Execute query search
    res_belongs = adapter.query("MATCH (e:Employee {name: 'Alice'})-[:belongs_to]->(d:Department) RETURN d.name AS dept")
    assert len(res_belongs) > 0
    assert res_belongs[0]["dept"] == "Engineering"
    
    res_managed = adapter.query("MATCH (p:Project {name: 'Apollo Project'})-[:managed_by]->(e:Employee) RETURN e.name AS emp")
    assert len(res_managed) > 0
    assert res_managed[0]["emp"] == "Alice"
    
    # Test natural language translator
    from app.agents.graph import kg_search_tool
    kg_out = kg_search_tool(query="Who manages Apollo Project?")
    assert "Alice" in kg_out
    assert "employee" in kg_out.lower()
    
    # 2. Test ingestion hook
    sample_text = "Alice belongs to the Engineering department, and manages the Apollo Project."
    extracted = get_mock_graph_extraction(sample_text)
    assert any(n["name"] == "Alice" and n["label"] == "Employee" for n in extracted["nodes"])
    assert any(n["name"] == "Engineering" and n["label"] == "Department" for n in extracted["nodes"])
    assert any(n["name"] == "Apollo Project" and n["label"] == "Project" for n in extracted["nodes"])
    assert any(r["source"] == "Alice" and r["target"] == "Engineering" and r["type"] == "belongs_to" for r in extracted["relationships"])
    assert any(r["source"] == "Apollo Project" and r["target"] == "Alice" and r["type"] == "managed_by" for r in extracted["relationships"])
    
    # 3. Test Agent RAG Node reasoning with graph adapter context
    user = User(email="kg_test@enterprise.com", password_hash=get_password_hash("pass"), is_email_verified=True)
    db_session.add(user)
    db_session.flush()
    
    org = Organization(name="KG Org", slug="kg-org")
    db_session.add(org)
    db_session.flush()
    
    member = OrganizationMember(organization_id=org.id, user_id=user.id, role="org_admin")
    db_session.add(member)
    
    ws = Workspace(organization_id=org.id, name="KG WS", slug="kg-ws")
    db_session.add(ws)
    db_session.flush()
    
    chat = Chat(workspace_id=ws.id, user_id=user.id, title="KG Chat")
    db_session.add(chat)
    db_session.commit()
    
    comp_result = execute_agent_workflow(
        query="Who is the manager of Apollo Project?",
        workspace_id=str(ws.id),
        chat_id=chat.id,
        db=db_session,
        selected_agent="rag"
    )
    
    assert "Alice" in comp_result["response"]

    dept_result = execute_agent_workflow(
        query="Which department does Alice belong to?",
        workspace_id=str(ws.id),
        chat_id=chat.id,
        db=db_session,
        selected_agent="rag"
    )
    
    assert "Engineering" in dept_result["response"]

    
    # 4. Verify API route
    response = client.get("/api/v1/documents/knowledge-graph")
    assert response.status_code == 200
    data = response.json()
    assert "nodes" in data
    assert "relationships" in data
    assert any(n["name"] == "Alice" for n in data["nodes"])


def test_enterprise_analytics_dashboard(client, db_session):
    import uuid
    from app.models.schemas import User, Organization, Workspace, OrganizationMember, Chat, Message, Evaluation, AnalyticsLog
    from app.core.security import get_password_hash, create_access_token
    from app.agents.graph import execute_agent_workflow
    
    # 1. Onboard workspace & user
    user = User(email="analytics_test@enterprise.com", password_hash=get_password_hash("pass"), is_email_verified=True)
    db_session.add(user)
    db_session.flush()
    
    org = Organization(name="Analytics Org", slug="analytics-org")
    db_session.add(org)
    db_session.flush()
    
    member = OrganizationMember(organization_id=org.id, user_id=user.id, role="org_admin")
    db_session.add(member)
    
    ws = Workspace(organization_id=org.id, name="Analytics WS", slug="analytics-ws")
    db_session.add(ws)
    db_session.flush()
    
    chat = Chat(workspace_id=ws.id, user_id=user.id, title="Analytics Chat")
    db_session.add(chat)
    db_session.commit()
    
    # 2. Run agent workflow to write telemetry logs automatically into analytics_logs & evaluations
    execute_agent_workflow(
        query="Verify workflow trace stats",
        workspace_id=str(ws.id),
        chat_id=chat.id,
        db=db_session,
        selected_agent="analytics"
    )
    
    # 3. Verify analytics_logs and evaluations exist
    logs_count = db_session.query(AnalyticsLog).filter(AnalyticsLog.workspace_id == ws.id).count()
    assert logs_count > 0
    
    evals_count = db_session.query(Evaluation).count()
    assert evals_count > 0
    
    # 4. Verify API route /analytics/enterprise returns correct structures
    token = create_access_token(subject=user.email, role="org_admin")
    headers = {"Authorization": f"Bearer {token}"}
    
    response = client.get(f"/api/v1/analytics/enterprise?workspace_id={str(ws.id)}", headers=headers)
    assert response.status_code == 200
    data = response.json()
    
    assert "rag" in data
    assert "llm" in data
    assert "agents" in data
    
    assert "retrieval_accuracy" in data["rag"]
    assert "hallucination_rate" in data["rag"]
    assert "citation_quality" in data["rag"]
    
    assert "total_tokens" in data["llm"]
    assert "total_cost" in data["llm"]
    assert "avg_latency" in data["llm"]
    
    assert "success_rate" in data["agents"]
    assert "failures" in data["agents"]
    assert "utilization" in data["agents"]
    assert "Supervisor Agent" in data["agents"]["utilization"]


def test_enterprise_integrations_crud(client, db_session):
    from app.models.schemas import User, Organization, Workspace, OrganizationMember, Integration
    from app.core.security import get_password_hash, create_access_token
    
    # 1. Onboard workspace & user
    user = User(email="integrations_admin@enterprise.com", password_hash=get_password_hash("pass"), is_email_verified=True)
    db_session.add(user)
    db_session.flush()
    
    org = Organization(name="Integrations Org", slug="integrations-org")
    db_session.add(org)
    db_session.flush()
    
    member = OrganizationMember(organization_id=org.id, user_id=user.id, role="org_admin")
    db_session.add(member)
    
    ws = Workspace(organization_id=org.id, name="Integrations WS", slug="integrations-ws")
    db_session.add(ws)
    db_session.commit()
    
    # Generate token
    token = create_access_token(subject=user.email, role="org_admin")
    headers = {"Authorization": f"Bearer {token}"}
    
    # 2. Save Integration configuration (Notion)
    notion_payload = {
        "workspace_id": str(ws.id),
        "name": "notion",
        "credentials": {
            "api_key": "secret_notion_key_abc123",
            "workspace_name": "Antigravity Workspace"
        },
        "is_active": True
    }
    
    response = client.post("/api/v1/integrations/", json=notion_payload, headers=headers)
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["name"] == "notion"
    assert res_data["credentials"]["api_key"] == "secret_notion_key_abc123"
    
    # 3. List integrations
    list_res = client.get(f"/api/v1/integrations/?workspace_id={str(ws.id)}", headers=headers)
    assert list_res.status_code == 200
    list_data = list_res.json()
    assert len(list_data) == 1
    assert list_data[0]["name"] == "notion"
    integration_id = list_data[0]["id"]
    
    # 4. Remove integration
    del_res = client.delete(f"/api/v1/integrations/{integration_id}", headers=headers)
    assert del_res.status_code == 200
    assert del_res.json()["message"] == "Integration removed successfully"
    
    # 5. Verify list is empty
    list_res_2 = client.get(f"/api/v1/integrations/?workspace_id={str(ws.id)}", headers=headers)
    assert len(list_res_2.json()) == 0


def test_llmops_prompt_versioning_and_ab_routing(client, db_session):
    from app.models.schemas import User, Organization, Workspace, OrganizationMember, Chat, Message, Prompt, Experiment, AnalyticsLog
    from app.core.security import get_password_hash, create_access_token
    import uuid

    # 1. Onboard workspace & user
    user = User(email="llmops_admin@enterprise.com", password_hash=get_password_hash("pass"), is_email_verified=True)
    db_session.add(user)
    db_session.flush()

    org = Organization(name="LLMOps Org", slug="llmops-org")
    db_session.add(org)
    db_session.flush()

    member = OrganizationMember(organization_id=org.id, user_id=user.id, role="org_admin")
    db_session.add(member)

    ws = Workspace(organization_id=org.id, name="LLMOps WS", slug="llmops-ws")
    db_session.add(ws)
    db_session.commit()

    token = create_access_token(subject=user.email, role="org_admin")
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Add some prompt versions
    p_payload = {
        "workspace_id": str(ws.id),
        "name": "rag_synthesis",
        "content": "Template version A system instruction content",
        "is_active": True
    }
    res_p1 = client.post("/api/v1/llmops/prompts", json=p_payload, headers=headers)
    assert res_p1.status_code == 200
    prompt_a_id = res_p1.json()["id"]

    p_payload_b = {
        "workspace_id": str(ws.id),
        "name": "rag_synthesis",
        "content": "Template version B system instruction content",
        "is_active": False
    }
    res_p2 = client.post("/api/v1/llmops/prompts", json=p_payload_b, headers=headers)
    assert res_p2.status_code == 200
    prompt_b_id = res_p2.json()["id"]

    # 3. Create experiment
    exp_payload = {
        "workspace_id": str(ws.id),
        "name": "RAG Synth test gpt-vs-claude",
        "status": "draft",
        "model_a": "gpt-4o",
        "model_b": "claude-3-5-sonnet",
        "prompt_a_id": prompt_a_id,
        "prompt_b_id": prompt_b_id,
        "traffic_split_a": 0.50
    }
    res_exp = client.post("/api/v1/llmops/experiments", json=exp_payload, headers=headers)
    assert res_exp.status_code == 200
    exp_data = res_exp.json()
    exp_id = exp_data["id"]

    # 4. Activate experiment
    exp_payload["status"] = "active"
    res_act = client.put(f"/api/v1/llmops/experiments/{exp_id}", json=exp_payload, headers=headers)
    assert res_act.status_code == 200
    assert res_act.json()["status"] == "active"

    # 5. Seed chat and trigger agent execution workflow several times to assert variants routing
    chat = Chat(workspace_id=ws.id, user_id=user.id, title="Test Chat")
    db_session.add(chat)
    db_session.commit()

    # Create dummy user message
    user_msg = Message(
        chat_id=chat.id,
        role="user",
        content="What is isolation?"
    )
    db_session.add(user_msg)
    db_session.commit()

    # Trigger agent workflow
    res_workflow = execute_agent_workflow(
        query="What is isolation?",
        workspace_id=str(ws.id),
        chat_id=chat.id,
        db=db_session
    )
    assert "response" in res_workflow
    
    # 6. Retrieve metrics
    res_metrics = client.get(f"/api/v1/llmops/experiments/{exp_id}/metrics", headers=headers)
    assert res_metrics.status_code == 200
    metrics_data = res_metrics.json()
    assert "variant_a" in metrics_data
    assert "variant_b" in metrics_data
    assert "calls" in metrics_data["variant_a"]
    assert "avg_latency_ms" in metrics_data["variant_a"]


def test_advanced_ai_features(client, db_session):
    from app.models.schemas import User, Organization, Workspace, OrganizationMember, KnowledgeBase, Document, MeetingAnalysis, ResearchTask
    from app.core.security import create_access_token
    from io import BytesIO

    # 1. Setup workspace & auth headers
    org = Organization(name="AI Features Org", slug="ai-features-org")
    db_session.add(org)
    db_session.commit()

    user = User(
        email="test_features@example.com",
        password_hash=get_password_hash("password123"),
        first_name="AI",
        last_name="Tester",
        is_active=True
    )
    db_session.add(user)
    db_session.commit()

    member = OrganizationMember(organization_id=org.id, user_id=user.id, role="admin")
    db_session.add(member)

    ws = Workspace(organization_id=org.id, name="AI Features WS", slug="ai-features-ws")
    db_session.add(ws)
    db_session.commit()

    kb = KnowledgeBase(workspace_id=ws.id, name="Test KB", description="KB for tests")
    db_session.add(kb)
    db_session.commit()

    token = create_access_token(subject=user.email, role="org_admin")
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Test Voice RAG Upload & Processing
    audio_file = BytesIO(b"dummy audio content")
    response = client.post(
        "/api/v1/voice-rag/upload",
        data={"knowledge_base_id": str(kb.id)},
        files={"file": ("test_voice.mp3", audio_file, "audio/mpeg")},
        headers=headers
    )
    assert response.status_code == 200, response.text
    doc_id = response.json()["id"]

    # Verify document exists in DB and status is either completed or pending/processing
    doc = db_session.query(Document).filter(Document.id == uuid.UUID(doc_id)).first()
    assert doc is not None
    assert doc.name == "test_voice.mp3"

    # List transcriptions
    list_resp = client.get(f"/api/v1/voice-rag/transcriptions?knowledge_base_id={kb.id}", headers=headers)
    assert list_resp.status_code == 200
    assert len(list_resp.json()) >= 1

    # Get transcript
    transcript_resp = client.get(f"/api/v1/voice-rag/transcript/{doc_id}", headers=headers)
    assert transcript_resp.status_code == 200
    assert "transcript" in transcript_resp.json()

    # 3. Test OCR Upload & Processing
    pdf_file = BytesIO(b"dummy pdf content")
    response_ocr = client.post(
        "/api/v1/ocr/upload",
        data={"knowledge_base_id": str(kb.id)},
        files={"file": ("test_scanned.pdf", pdf_file, "application/pdf")},
        headers=headers
    )
    assert response_ocr.status_code == 200
    ocr_doc_id = response_ocr.json()["id"]

    # List OCR results
    list_ocr = client.get(f"/api/v1/ocr/results?knowledge_base_id={kb.id}", headers=headers)
    assert list_ocr.status_code == 200
    assert len(list_ocr.json()) >= 1

    # Get OCR text
    text_resp = client.get(f"/api/v1/ocr/text/{ocr_doc_id}", headers=headers)
    assert text_resp.status_code == 200
    assert "full_text" in text_resp.json()

    # 4. Test Meeting Intelligence
    meeting_file = BytesIO(b"dummy meeting content")
    response_meeting = client.post(
        "/api/v1/meeting/upload",
        data={"workspace_id": str(ws.id), "save_to_kb": "false"},
        files={"file": ("meeting_recording.mp4", meeting_file, "video/mp4")},
        headers=headers
    )
    assert response_meeting.status_code == 200
    analysis_id = response_meeting.json()["id"]

    # List meeting analyses
    list_meetings = client.get(f"/api/v1/meeting/analyses?workspace_id={ws.id}", headers=headers)
    assert list_meetings.status_code == 200
    assert len(list_meetings.json()) >= 1

    # Get specific meeting analysis
    analysis_resp = client.get(f"/api/v1/meeting/analysis/{analysis_id}", headers=headers)
    assert analysis_resp.status_code == 200
    assert analysis_resp.json()["filename"] == "meeting_recording.mp4"

    # Delete meeting analysis
    del_resp = client.delete(f"/api/v1/meeting/analysis/{analysis_id}", headers=headers)
    assert del_resp.status_code == 200

    # 5. Test Autonomous Research
    research_payload = {
        "workspace_id": str(ws.id),
        "query": "Research top AI startups in India",
        "email_to": "client@example.com"
    }
    response_research = client.post("/api/v1/research/", json=research_payload, headers=headers)
    assert response_research.status_code == 200
    task_id = response_research.json()["id"]

    # List research tasks
    list_tasks = client.get(f"/api/v1/research/?workspace_id={ws.id}", headers=headers)
    assert list_tasks.status_code == 200
    assert len(list_tasks.json()) >= 1

    # Get research task
    task_resp = client.get(f"/api/v1/research/{task_id}", headers=headers)
    assert task_resp.status_code == 200
    assert task_resp.json()["query"] == "Research top AI startups in India"

    # Delete research task
    del_task = client.delete(f"/api/v1/research/{task_id}", headers=headers)
    assert del_task.status_code == 200









