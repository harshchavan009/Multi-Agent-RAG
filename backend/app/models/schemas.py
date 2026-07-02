import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, Numeric, Integer, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from pydantic import BaseModel

from app.core.database import Base

# ==========================================
# SQLALCHEMY DATABASE MODELS
# ==========================================

class Organization(Base):
    __tablename__ = "organizations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), unique=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    workspaces = relationship("Workspace", back_populates="organization", cascade="all, delete-orphan")
    members = relationship("OrganizationMember", back_populates="organization", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="organization", cascade="all, delete-orphan")


class Workspace(Base):
    __tablename__ = "workspaces"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), nullable=False)
    settings = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    organization = relationship("Organization", back_populates="workspaces")
    teams = relationship("Team", back_populates="workspace", cascade="all, delete-orphan")
    knowledge_bases = relationship("KnowledgeBase", back_populates="workspace", cascade="all, delete-orphan")
    agents = relationship("Agent", back_populates="workspace", cascade="all, delete-orphan")
    workflows = relationship("Workflow", back_populates="workspace", cascade="all, delete-orphan")
    chats = relationship("Chat", back_populates="workspace", cascade="all, delete-orphan")
    llm_models = relationship("LLMModel", back_populates="workspace", cascade="all, delete-orphan")
    analytics_logs = relationship("AnalyticsLog", back_populates="workspace", cascade="all, delete-orphan")
    workspace_settings = relationship("WorkspaceSettings", back_populates="workspace", uselist=False, cascade="all, delete-orphan")
    integrations = relationship("Integration", back_populates="workspace", cascade="all, delete-orphan")
    prompts = relationship("Prompt", back_populates="workspace", cascade="all, delete-orphan")
    experiments = relationship("Experiment", back_populates="workspace", cascade="all, delete-orphan")


class Team(Base):
    __tablename__ = "teams"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    workspace = relationship("Workspace", back_populates="teams")


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=False)
    first_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True)
    is_email_verified = Column(Boolean, default=False)
    email_verification_token = Column(String(255), nullable=True)
    password_reset_token = Column(String(255), nullable=True)
    refresh_token = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    memberships = relationship("OrganizationMember", back_populates="user", cascade="all, delete-orphan")
    chats = relationship("Chat", back_populates="user")
    audit_logs = relationship("AuditLog", back_populates="user")


class OrganizationMember(Base):
    __tablename__ = "organization_members"

    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), primary_key=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    role = Column(String(50), nullable=False, default="user") # 'super_admin', 'org_admin', 'team_admin', 'manager', 'user', 'viewer'
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    organization = relationship("Organization", back_populates="members")
    user = relationship("User", back_populates="memberships")


class KnowledgeBase(Base):
    __tablename__ = "knowledge_bases"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    vector_settings = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    workspace = relationship("Workspace", back_populates="knowledge_bases")
    documents = relationship("Document", back_populates="knowledge_base", cascade="all, delete-orphan")


class Document(Base):
    __tablename__ = "documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    knowledge_base_id = Column(UUID(as_uuid=True), ForeignKey("knowledge_bases.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    file_path = Column(String(512), nullable=True)
    file_size = Column(Integer, nullable=True)
    mime_type = Column(String(100), nullable=True)
    status = Column(String(50), nullable=False, default="pending") # 'pending', 'processing', 'completed', 'failed'
    metadata_fields = Column(JSON, default=dict) # renamed to avoid metadata naming clash
    version = Column(Integer, default=1, nullable=False)
    is_latest = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    knowledge_base = relationship("KnowledgeBase", back_populates="documents")


class Agent(Base):
    __tablename__ = "agents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    role = Column(String(100), nullable=False)
    system_prompt = Column(Text, nullable=False)
    model_provider = Column(String(50), nullable=False) # 'openai', 'anthropic', 'gemini'
    model_name = Column(String(100), nullable=False)
    temperature = Column(Numeric(3, 2), default=0.7)
    tools = Column(JSON, default=list)
    memory_config = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    workspace = relationship("Workspace", back_populates="agents")


class Workflow(Base):
    __tablename__ = "workflows"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    definition = Column(JSON, nullable=False) # n8n style graph definition
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    workspace = relationship("Workspace", back_populates="workflows")


class Chat(Base):
    __tablename__ = "chats"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    workspace = relationship("Workspace", back_populates="chats")
    user = relationship("User", back_populates="chats")
    messages = relationship("Message", back_populates="chat", cascade="all, delete-orphan")


class Message(Base):
    __tablename__ = "messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chat_id = Column(UUID(as_uuid=True), ForeignKey("chats.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(50), nullable=False) # 'user', 'assistant', 'system'
    content = Column(Text, nullable=False)
    citations = Column(JSON, default=list)
    metrics = Column(JSON, default=dict) # response latency, token count, cost
    experiment_id = Column(UUID(as_uuid=True), ForeignKey("experiments.id", ondelete="SET NULL"), nullable=True)
    variant = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    chat = relationship("Chat", back_populates="messages")
    evaluations = relationship("Evaluation", back_populates="message", cascade="all, delete-orphan")

class AgentMemory(Base):
    __tablename__ = "agent_memories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    chat_id = Column(UUID(as_uuid=True), ForeignKey("chats.id", ondelete="CASCADE"), nullable=True)
    memory_type = Column(String(50), nullable=False) # 'conversation_summary', 'workspace_fact', 'longterm_preference', 'semantic_fact'
    content = Column(Text, nullable=False)
    vector = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(100), nullable=False)
    details = Column(JSON, default=dict)
    ip_address = Column(String(45), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    organization = relationship("Organization", back_populates="audit_logs")
    user = relationship("User", back_populates="audit_logs")


class Evaluation(Base):
    __tablename__ = "evaluations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    message_id = Column(UUID(as_uuid=True), ForeignKey("messages.id", ondelete="CASCADE"), nullable=False)
    hallucination_score = Column(Numeric(3, 2), nullable=True)
    groundedness_score = Column(Numeric(3, 2), nullable=True)
    faithfulness_score = Column(Numeric(3, 2), nullable=True)
    retrieval_score = Column(Numeric(3, 2), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    message = relationship("Message", back_populates="evaluations")


class LLMModel(Base):
    __tablename__ = "llm_models"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    provider = Column(String(100), nullable=False)
    model_name = Column(String(100), nullable=False)
    latency = Column(String(50), default="200ms")
    cost = Column(String(100), default="$1.00 / M")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    workspace = relationship("Workspace", back_populates="llm_models")


class AnalyticsLog(Base):
    __tablename__ = "analytics_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    query = Column(Text, nullable=False)
    tokens_consumed = Column(Integer, default=0)
    cost_usd = Column(Numeric(10, 5), default=0.0)
    latency_ms = Column(Integer, default=0)
    agent_visited = Column(String(100), default="RAG Agent")
    experiment_id = Column(UUID(as_uuid=True), ForeignKey("experiments.id", ondelete="SET NULL"), nullable=True)
    variant = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    workspace = relationship("Workspace", back_populates="analytics_logs")


class WorkspaceSettings(Base):
    __tablename__ = "workspace_settings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), unique=True, nullable=False)
    openai_api_key = Column(String(255), nullable=True)
    rag_context_limit = Column(Integer, default=5)
    theme = Column(String(50), default="dark")
    # Active model selection
    active_model_name = Column(String(100), default="gpt-4o", nullable=True)
    active_model_api_key = Column(String(512), nullable=True)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    workspace = relationship("Workspace", back_populates="workspace_settings")


class Integration(Base):
    __tablename__ = "integrations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    credentials = Column(JSON, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    workspace = relationship("Workspace", back_populates="integrations")


class Prompt(Base):
    __tablename__ = "prompts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    version = Column(Integer, default=1, nullable=False)
    content = Column(Text, nullable=False)
    is_active = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    workspace = relationship("Workspace", back_populates="prompts")


class Experiment(Base):
    __tablename__ = "experiments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    status = Column(String(50), default="draft", nullable=False) # 'draft', 'active', 'ended'
    model_a = Column(String(100), nullable=False)
    model_b = Column(String(100), nullable=False)
    prompt_a_id = Column(UUID(as_uuid=True), ForeignKey("prompts.id", ondelete="SET NULL"), nullable=True)
    prompt_b_id = Column(UUID(as_uuid=True), ForeignKey("prompts.id", ondelete="SET NULL"), nullable=True)
    traffic_split_a = Column(Numeric(3, 2), default=0.50, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    workspace = relationship("Workspace", back_populates="experiments")
    prompt_a = relationship("Prompt", foreign_keys=[prompt_a_id])
    prompt_b = relationship("Prompt", foreign_keys=[prompt_b_id])


class ResearchTask(Base):
    __tablename__ = "research_tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    query = Column(Text, nullable=False)
    status = Column(String(50), nullable=False, default="pending")  # pending, running, completed, failed
    result_summary = Column(Text, nullable=True)
    pdf_filename = Column(String(512), nullable=True)
    email_to = Column(String(255), nullable=True)
    steps_log = Column(Text, nullable=True)  # JSON string of step outputs
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


class MeetingAnalysis(Base):
    __tablename__ = "meeting_analyses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String(512), nullable=False)
    transcript = Column(Text, nullable=True)
    summary = Column(Text, nullable=True)
    action_items = Column(JSON, default=list)  # List of strings
    decisions = Column(JSON, default=list)       # List of strings
    status = Column(String(50), nullable=False, default="pending")  # pending, processing, completed, failed
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


# ==========================================
# PYDANTIC SCHEMAS
# ==========================================

class UserBase(BaseModel):
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: uuid.UUID
    is_active: bool
    is_email_verified: bool = False
    email_verification_token: Optional[str] = None
    created_at: datetime
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    refresh_token: Optional[str] = None

class TokenData(BaseModel):
    email: Optional[str] = None
    org_id: Optional[str] = None
    role: Optional[str] = None

class OrganizationBase(BaseModel):
    name: str
    slug: str

class OrganizationCreate(OrganizationBase):
    pass

class OrganizationResponse(OrganizationBase):
    id: uuid.UUID
    created_at: datetime
    class Config:
        from_attributes = True

class WorkspaceBase(BaseModel):
    name: str
    slug: str
    settings: Optional[Dict[str, Any]] = None

class WorkspaceCreate(WorkspaceBase):
    organization_id: uuid.UUID

class WorkspaceResponse(WorkspaceBase):
    id: uuid.UUID
    organization_id: uuid.UUID
    created_at: datetime
    class Config:
        from_attributes = True

class KnowledgeBaseBase(BaseModel):
    name: str
    description: Optional[str] = None
    vector_settings: Optional[Dict[str, Any]] = None

class KnowledgeBaseCreate(KnowledgeBaseBase):
    workspace_id: uuid.UUID

class KnowledgeBaseResponse(KnowledgeBaseBase):
    id: uuid.UUID
    workspace_id: uuid.UUID
    created_at: datetime
    class Config:
        from_attributes = True

class DocumentResponse(BaseModel):
    id: uuid.UUID
    knowledge_base_id: uuid.UUID
    name: str
    file_path: Optional[str] = None
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    status: str
    metadata_fields: Dict[str, Any]
    version: int
    is_latest: bool
    created_at: datetime
    class Config:
        from_attributes = True

class AgentBase(BaseModel):
    name: str
    role: str
    system_prompt: str
    model_provider: str
    model_name: str
    temperature: float = 0.7
    tools: List[str] = []
    memory_config: Dict[str, Any] = {}

class AgentCreate(AgentBase):
    workspace_id: uuid.UUID

class AgentResponse(AgentBase):
    id: uuid.UUID
    workspace_id: uuid.UUID
    created_at: datetime
    class Config:
        from_attributes = True

class WorkflowBase(BaseModel):
    name: str
    definition: Dict[str, Any]
    is_active: bool = True

class WorkflowCreate(WorkflowBase):
    workspace_id: uuid.UUID

class WorkflowResponse(WorkflowBase):
    id: uuid.UUID
    workspace_id: uuid.UUID
    created_at: datetime
    class Config:
        from_attributes = True

class ChatCreate(BaseModel):
    workspace_id: uuid.UUID
    title: Optional[str] = None

class ChatResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    user_id: uuid.UUID
    title: Optional[str]
    created_at: datetime
    class Config:
        from_attributes = True

class MessageCreate(BaseModel):
    chat_id: uuid.UUID
    role: str
    content: str

class MessageResponse(BaseModel):
    id: uuid.UUID
    chat_id: uuid.UUID
    role: str
    content: str
    citations: List[Dict[str, Any]] = []
    metrics: Dict[str, Any] = {}
    created_at: datetime
    class Config:
        from_attributes = True


class LLMModelBase(BaseModel):
    name: str
    provider: str
    model_name: str
    latency: Optional[str] = "200ms"
    cost: Optional[str] = "$1.00 / M"
    is_active: Optional[bool] = True

class LLMModelCreate(LLMModelBase):
    workspace_id: uuid.UUID

class LLMModelResponse(LLMModelBase):
    id: uuid.UUID
    workspace_id: uuid.UUID
    created_at: datetime
    class Config:
        from_attributes = True

class AnalyticsLogBase(BaseModel):
    query: str
    tokens_consumed: int = 0
    cost_usd: float = 0.0
    latency_ms: int = 0
    agent_visited: str = "RAG Agent"

class AnalyticsLogCreate(AnalyticsLogBase):
    workspace_id: uuid.UUID

class AnalyticsLogResponse(AnalyticsLogBase):
    id: uuid.UUID
    workspace_id: uuid.UUID
    created_at: datetime
    class Config:
        from_attributes = True

class WorkspaceSettingsBase(BaseModel):
    openai_api_key: Optional[str] = None
    rag_context_limit: int = 5
    theme: str = "dark"
    active_model_name: Optional[str] = "gpt-4o"
    active_model_api_key: Optional[str] = None

class WorkspaceSettingsCreate(WorkspaceSettingsBase):
    workspace_id: uuid.UUID

class WorkspaceSettingsResponse(WorkspaceSettingsBase):
    id: uuid.UUID
    workspace_id: uuid.UUID
    updated_at: datetime
    class Config:
        from_attributes = True

class AuditLogBase(BaseModel):
    action: str
    details: Dict[str, Any] = {}
    ip_address: Optional[str] = None

class AuditLogCreate(AuditLogBase):
    organization_id: uuid.UUID
    user_id: Optional[uuid.UUID] = None

class AuditLogResponse(AuditLogBase):
    id: uuid.UUID
    organization_id: uuid.UUID
    user_id: Optional[uuid.UUID]
    created_at: datetime
    class Config:
        from_attributes = True


class IntegrationBase(BaseModel):
    name: str
    credentials: Dict[str, Any] = {}
    is_active: bool = True

class IntegrationCreate(IntegrationBase):
    workspace_id: uuid.UUID

class IntegrationResponse(IntegrationBase):
    id: uuid.UUID
    workspace_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True


class PromptBase(BaseModel):
    name: str
    content: str
    is_active: bool = False

class PromptCreate(PromptBase):
    workspace_id: uuid.UUID

class PromptResponse(PromptBase):
    id: uuid.UUID
    workspace_id: uuid.UUID
    version: int
    created_at: datetime
    class Config:
        from_attributes = True


class ExperimentBase(BaseModel):
    name: str
    status: str = "draft"
    model_a: str
    model_b: str
    prompt_a_id: Optional[uuid.UUID] = None
    prompt_b_id: Optional[uuid.UUID] = None
    traffic_split_a: float = 0.50

class ExperimentCreate(ExperimentBase):
    workspace_id: uuid.UUID

class ExperimentResponse(ExperimentBase):
    id: uuid.UUID
    workspace_id: uuid.UUID
    created_at: datetime
    class Config:
        from_attributes = True


# --- Research Task Schemas ---

class ResearchTaskCreate(BaseModel):
    workspace_id: uuid.UUID
    query: str
    email_to: Optional[str] = None

class ResearchTaskResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    query: str
    status: str
    result_summary: Optional[str] = None
    pdf_filename: Optional[str] = None
    email_to: Optional[str] = None
    steps_log: Optional[str] = None
    created_at: datetime
    class Config:
        from_attributes = True


# --- Meeting Analysis Schemas ---

class MeetingAnalysisResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    filename: str
    transcript: Optional[str] = None
    summary: Optional[str] = None
    action_items: List[str] = []
    decisions: List[str] = []
    status: str
    created_at: datetime
    class Config:
        from_attributes = True
