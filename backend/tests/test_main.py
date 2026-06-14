import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import uuid

from app.main import app
from app.core.database import Base, get_db
from app.core.security import get_password_hash
from app.models.schemas import User, Organization, Workspace, OrganizationMember, Chat, Message, Workflow
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

    # 2. Define workflow nodes (Webhook, Database, API)
    definition = {
        "nodes": [
            {
                "id": "node_web",
                "name": "Trigger Source Link",
                "type": "webhook",
                "config": {"source": "http://localhost:8000/webhook"}
            },
            {
                "id": "node_db",
                "name": "Query Local Users",
                "type": "database",
                "config": {"query": "SELECT * FROM users LIMIT 1;"}
            },
            {
                "id": "node_api",
                "name": "Fetch Test Endpoint",
                "type": "api",
                "config": {"url": "https://httpbin.org/get", "method": "GET"}
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

    # 4. Trigger workflow execution endpoint
    response = client.post(f"/api/v1/workflows/{workflow.id}/execute", headers=headers)
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["workflow_id"] == str(workflow.id)
    assert res_data["success"] is True
    assert len(res_data["logs"]) == 3

    # Check validation logs
    assert res_data["logs"][0]["node_name"] == "Trigger Source Link"
    assert res_data["logs"][0]["status"] == "success"
    assert "Triggered successfully" in res_data["logs"][0]["output"]

    assert res_data["logs"][1]["node_name"] == "Query Local Users"
    assert res_data["logs"][1]["status"] == "success"
    assert "SQL query executed successfully" in res_data["logs"][1]["output"]

    assert res_data["logs"][2]["node_name"] == "Fetch Test Endpoint"
    assert res_data["logs"][2]["status"] == "success"



