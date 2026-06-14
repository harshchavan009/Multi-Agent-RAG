from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid

from app.core.database import get_db
from app.core.security import decode_token
from app.models.schemas import Chat, Message, User, ChatCreate, ChatResponse, MessageResponse, MessageCreate
from app.agents.graph import execute_agent_workflow

router = APIRouter(prefix="/chats", tags=["chats"])

# JWT Dependency validation
def get_current_user_email(authorization: Optional[str] = Header(None), db: Session = Depends(get_db)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization credentials."
        )
    token = authorization.split(" ")[1]
    claims = decode_token(token)
    if not claims or "sub" not in claims:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has expired or authentication token is invalid."
        )
    return claims["sub"]

@router.post("/", response_model=ChatResponse)
def create_chat(payload: ChatCreate, email: str = Depends(get_current_user_email), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    new_chat = Chat(
        workspace_id=payload.workspace_id,
        user_id=user.id,
        title=payload.title or "New Collaboration Thread"
    )
    db.add(new_chat)
    db.commit()
    db.refresh(new_chat)
    return new_chat

@router.get("/", response_model=List[ChatResponse])
def list_chats(workspace_id: uuid.UUID, email: str = Depends(get_current_user_email), db: Session = Depends(get_db)):
    # Verify user email belongs to membership org mapping
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    chats = db.query(Chat).filter(
        Chat.workspace_id == workspace_id,
        Chat.user_id == user.id
    ).order_by(Chat.created_at.desc()).all()
    return chats

from pydantic import BaseModel
from fastapi.responses import StreamingResponse
from app.agents.graph import stream_agent_workflow

class MessageStreamCreate(BaseModel):
    chat_id: uuid.UUID
    role: str
    content: str
    selected_agent: Optional[str] = None

@router.post("/{chat_id}/messages")
def send_message(chat_id: uuid.UUID, payload: MessageCreate, email: str = Depends(get_current_user_email), db: Session = Depends(get_db)):
    # 1. Verify chat exists
    chat = db.query(Chat).filter(Chat.id == chat_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Conversation session not found")

    # 2. Store the User Message
    user_msg = Message(
        chat_id=chat_id,
        role="user",
        content=payload.content
    )
    db.add(user_msg)
    db.commit()
    db.refresh(user_msg)

    # 3. Trigger multi-agent LangGraph workflow synchronously (includes evaluations scoring)
    result = execute_agent_workflow(
        query=payload.content,
        workspace_id=str(chat.workspace_id),
        chat_id=chat.id,
        db=db
    )
    
    return result

@router.post("/{chat_id}/messages/stream")
def send_message_stream(
    chat_id: uuid.UUID,
    payload: MessageStreamCreate,
    email: str = Depends(get_current_user_email),
    db: Session = Depends(get_db)
):
    # 1. Verify chat exists
    chat = db.query(Chat).filter(Chat.id == chat_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Conversation session not found")

    # 2. Store User Message
    user_msg = Message(
        chat_id=chat_id,
        role="user",
        content=payload.content
    )
    db.add(user_msg)
    db.commit()
    db.refresh(user_msg)

    # 3. Return StreamingResponse
    return StreamingResponse(
        stream_agent_workflow(
            query=payload.content,
            workspace_id=str(chat.workspace_id),
            chat_id=chat.id,
            selected_agent=payload.selected_agent,
            db=db
        ),
        media_type="text/event-stream"
    )

@router.get("/{chat_id}/messages", response_model=List[MessageResponse])
def get_chat_history(chat_id: uuid.UUID, email: str = Depends(get_current_user_email), db: Session = Depends(get_db)):
    messages = db.query(Message).filter(Message.chat_id == chat_id).order_by(Message.created_at.asc()).all()
    return messages
