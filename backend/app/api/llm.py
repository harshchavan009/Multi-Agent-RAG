"""
/api/v1/llm  —  Unified LLM Provider API

Endpoints:
  POST /llm/complete         — blocking single response
  POST /llm/stream           — SSE token stream
  GET  /llm/providers        — list providers + configuration status
  GET  /llm/models           — catalogue of all supported models
"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
import json

from app.api.chats import get_current_user_email
from app.services.llm_provider import Message, UnifiedLLMProvider, detect_provider

router = APIRouter(prefix="/llm", tags=["Unified LLM Provider"])


# ──────────────────────────────────────────────────────────────────────────────
# Request / Response schemas
# ──────────────────────────────────────────────────────────────────────────────

class MessagePayload(BaseModel):
    role: str     # "system" | "user" | "assistant"
    content: str


class CompleteRequest(BaseModel):
    model: str
    messages: List[MessagePayload]
    temperature: float = 0.2
    max_tokens: Optional[int] = None
    api_key: Optional[str] = None   # workspace-supplied override


class CompleteResponse(BaseModel):
    content: str
    model: str
    provider: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    latency_ms: float
    finish_reason: str


class StreamRequest(BaseModel):
    model: str
    messages: List[MessagePayload]
    temperature: float = 0.2
    max_tokens: Optional[int] = None
    api_key: Optional[str] = None


# ──────────────────────────────────────────────────────────────────────────────
# Model catalogue (mirrors the frontend provider list)
# ──────────────────────────────────────────────────────────────────────────────

MODEL_CATALOGUE = [
    # OpenAI
    {"id": "gpt-4o",                        "label": "GPT-4o",              "provider": "openai",      "tag": "Flagship",  "context_k": 128},
    {"id": "gpt-4o-mini",                   "label": "GPT-4o Mini",         "provider": "openai",      "tag": "Fast",      "context_k": 128},
    {"id": "gpt-4-turbo",                   "label": "GPT-4 Turbo",         "provider": "openai",      "tag": "Legacy",    "context_k": 128},
    {"id": "o3-mini",                       "label": "o3 Mini",             "provider": "openai",      "tag": "Reasoning", "context_k": 200},
    # Anthropic
    {"id": "claude-3-5-sonnet-20241022",    "label": "Claude 3.5 Sonnet",   "provider": "anthropic",   "tag": "Best",      "context_k": 200},
    {"id": "claude-3-5-haiku-20241022",     "label": "Claude 3.5 Haiku",    "provider": "anthropic",   "tag": "Fast",      "context_k": 200},
    {"id": "claude-3-opus-20240229",        "label": "Claude 3 Opus",       "provider": "anthropic",   "tag": "Powerful",  "context_k": 200},
    # Gemini
    {"id": "gemini-1.5-pro",               "label": "Gemini 1.5 Pro",      "provider": "gemini",      "tag": "Best",      "context_k": 1000},
    {"id": "gemini-1.5-flash",             "label": "Gemini 1.5 Flash",    "provider": "gemini",      "tag": "Fast",      "context_k": 1000},
    {"id": "gemini-2.0-flash-exp",         "label": "Gemini 2.0 Flash",    "provider": "gemini",      "tag": "Latest",    "context_k": 1000},
    # DeepSeek
    {"id": "deepseek-chat",                "label": "DeepSeek V3",         "provider": "deepseek",    "tag": "Flagship",  "context_k": 64},
    {"id": "deepseek-reasoner",            "label": "DeepSeek R1",         "provider": "deepseek",    "tag": "Reasoning", "context_k": 64},
    {"id": "deepseek-coder",               "label": "DeepSeek Coder",      "provider": "deepseek",    "tag": "Code",      "context_k": 16},
    # Groq
    {"id": "llama-3.3-70b-versatile",      "label": "Llama 3.3 70B",       "provider": "groq",        "tag": "Best",      "context_k": 128},
    {"id": "llama-3.1-8b-instant",         "label": "Llama 3.1 8B",        "provider": "groq",        "tag": "Fastest",   "context_k": 128},
    {"id": "mixtral-8x7b-32768",           "label": "Mixtral 8×7B",        "provider": "groq",        "tag": "MoE",       "context_k": 32},
    {"id": "gemma2-9b-it",                 "label": "Gemma2 9B",           "provider": "groq",        "tag": "Compact",   "context_k": 8},
    # OpenRouter
    {"id": "mistralai/mistral-large",      "label": "Mistral Large",       "provider": "openrouter",  "tag": "Strong",    "context_k": 32},
    {"id": "meta-llama/llama-3.1-405b",   "label": "Llama 3.1 405B",      "provider": "openrouter",  "tag": "Largest",   "context_k": 128},
    {"id": "qwen/qwen-2.5-72b-instruct",  "label": "Qwen 2.5 72B",        "provider": "openrouter",  "tag": "MoE",       "context_k": 128},
]


# ──────────────────────────────────────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/models")
def list_models():
    """Return the full model catalogue grouped by provider."""
    grouped: dict = {}
    for m in MODEL_CATALOGUE:
        p = m["provider"]
        grouped.setdefault(p, []).append(m)
    return {"providers": grouped, "total": len(MODEL_CATALOGUE)}


@router.get("/providers")
def list_providers(email: str = Depends(get_current_user_email)):
    """Return each provider's configuration status (has API key or not)."""
    prov = UnifiedLLMProvider()
    return {"providers": prov.providers_status()}


@router.post("/complete", response_model=CompleteResponse)
def complete(
    payload: CompleteRequest,
    email: str = Depends(get_current_user_email),
):
    """
    Blocking LLM call. Returns the full response once generation finishes.
    Provider is auto-detected from the model name.
    """
    msgs = [Message(role=m.role, content=m.content) for m in payload.messages]
    prov = UnifiedLLMProvider()
    try:
        result = prov.complete(
            model=payload.model,
            messages=msgs,
            temperature=payload.temperature,
            max_tokens=payload.max_tokens,
            api_key=payload.api_key,
        )
        return CompleteResponse(
            content=result.content,
            model=result.model,
            provider=result.provider,
            prompt_tokens=result.prompt_tokens,
            completion_tokens=result.completion_tokens,
            total_tokens=result.total_tokens,
            latency_ms=result.latency_ms,
            finish_reason=result.finish_reason,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/stream")
def stream(
    payload: StreamRequest,
    email: str = Depends(get_current_user_email),
):
    """
    SSE streaming call. Returns text/event-stream.
    Each SSE event: data: <token>\\n\\n
    Final event:    data: [DONE]\\n\\n
    """
    msgs = [Message(role=m.role, content=m.content) for m in payload.messages]
    prov = UnifiedLLMProvider()

    def event_generator():
        try:
            for token in prov.stream(
                model=payload.model,
                messages=msgs,
                temperature=payload.temperature,
                max_tokens=payload.max_tokens,
                api_key=payload.api_key,
            ):
                yield f"data: {json.dumps({'token': token})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/detect")
def detect(model: str):
    """Quickly detect which provider a model string routes to."""
    return {
        "model": model,
        "provider": detect_provider(model),
    }
