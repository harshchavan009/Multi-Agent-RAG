"""
╔══════════════════════════════════════════════════════════════════════════════╗
║            UNIFIED LLM PROVIDER INTERFACE                                   ║
║                                                                              ║
║  One interface — six providers.                                              ║
║  Call complete() / stream() regardless of the underlying model.             ║
║                                                                              ║
║  Supported:                                                                  ║
║    • OpenAI     (gpt-4o, gpt-4o-mini, gpt-4-turbo, o3-mini …)              ║
║    • Anthropic  (claude-3-5-sonnet, claude-3-opus …)                        ║
║    • Google     (gemini-1.5-pro, gemini-1.5-flash …)                        ║
║    • Groq       (llama-3.3-70b, mixtral-8x7b …)                            ║
║    • DeepSeek   (deepseek-chat, deepseek-reasoner …)                        ║
║    • OpenRouter (any model string with a "/" in it)                         ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import os
import time
from dataclasses import dataclass, field
from typing import AsyncGenerator, Dict, Iterator, List, Optional


# ──────────────────────────────────────────────────────────────────────────────
# Data models
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class Message:
    role: str        # "system" | "user" | "assistant"
    content: str


@dataclass
class LLMResponse:
    content: str
    model: str
    provider: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    latency_ms: float = 0.0
    finish_reason: str = "stop"
    raw: Optional[Dict] = field(default=None, repr=False)


@dataclass
class ProviderConfig:
    name: str
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    extra: Dict = field(default_factory=dict)


# ──────────────────────────────────────────────────────────────────────────────
# Provider detection helper
# ──────────────────────────────────────────────────────────────────────────────

def detect_provider(model: str) -> str:
    """Return the canonical provider name for a given model string."""
    m = model.strip().lower()
    if m.startswith("gpt") or m in ("o1-preview", "o1-mini", "o3-mini", "o1"):
        return "openai"
    if m.startswith("claude"):
        return "anthropic"
    if m.startswith("gemini"):
        return "gemini"
    if m.startswith("deepseek"):
        return "deepseek"
    # OpenRouter models use "org/model" format — check "/" BEFORE groq prefixes
    if "/" in m:
        return "openrouter"
    if m.startswith(("llama", "mixtral", "gemma", "qwen", "mistral", "whisper-groq")):
        return "groq"
    return "openai"   # safe fallback


# ──────────────────────────────────────────────────────────────────────────────
# Per-provider backends
# ──────────────────────────────────────────────────────────────────────────────

def _messages_to_dicts(messages: List[Message]) -> List[Dict]:
    return [{"role": m.role, "content": m.content} for m in messages]


def _call_openai(
    model: str,
    messages: List[Message],
    temperature: float,
    max_tokens: Optional[int],
    api_key: str,
    base_url: Optional[str] = None,
) -> LLMResponse:
    from openai import OpenAI
    t0 = time.perf_counter()
    kwargs = {"api_key": api_key}
    if base_url:
        kwargs["base_url"] = base_url
    client = OpenAI(**kwargs)
    resp = client.chat.completions.create(
        model=model,
        messages=_messages_to_dicts(messages),
        temperature=temperature,
        **({"max_tokens": max_tokens} if max_tokens else {}),
    )
    latency = (time.perf_counter() - t0) * 1000
    usage = resp.usage or type("U", (), {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0})()
    return LLMResponse(
        content=resp.choices[0].message.content or "",
        model=resp.model,
        provider="openai" if not base_url else ("deepseek" if "deepseek" in (base_url or "") else "openrouter"),
        prompt_tokens=usage.prompt_tokens,
        completion_tokens=usage.completion_tokens,
        total_tokens=usage.total_tokens,
        latency_ms=round(latency, 2),
        finish_reason=resp.choices[0].finish_reason or "stop",
        raw=resp.model_dump() if hasattr(resp, "model_dump") else None,
    )


def _stream_openai(
    model: str,
    messages: List[Message],
    temperature: float,
    max_tokens: Optional[int],
    api_key: str,
    base_url: Optional[str] = None,
) -> Iterator[str]:
    from openai import OpenAI
    kwargs = {"api_key": api_key}
    if base_url:
        kwargs["base_url"] = base_url
    client = OpenAI(**kwargs)
    with client.chat.completions.create(
        model=model,
        messages=_messages_to_dicts(messages),
        temperature=temperature,
        stream=True,
        **({"max_tokens": max_tokens} if max_tokens else {}),
    ) as stream:
        for chunk in stream:
            delta = chunk.choices[0].delta.content if chunk.choices else None
            if delta:
                yield delta


def _call_anthropic(
    model: str,
    messages: List[Message],
    temperature: float,
    max_tokens: Optional[int],
    api_key: str,
) -> LLMResponse:
    import anthropic
    t0 = time.perf_counter()
    client = anthropic.Anthropic(api_key=api_key)
    # Anthropic separates system from human turns
    system_parts = [m.content for m in messages if m.role == "system"]
    chat_parts = [{"role": m.role, "content": m.content} for m in messages if m.role != "system"]
    resp = client.messages.create(
        model=model,
        system="\n".join(system_parts) if system_parts else anthropic.NOT_GIVEN,
        messages=chat_parts,
        max_tokens=max_tokens or 4096,
        temperature=temperature,
    )
    latency = (time.perf_counter() - t0) * 1000
    return LLMResponse(
        content=resp.content[0].text if resp.content else "",
        model=resp.model,
        provider="anthropic",
        prompt_tokens=resp.usage.input_tokens,
        completion_tokens=resp.usage.output_tokens,
        total_tokens=resp.usage.input_tokens + resp.usage.output_tokens,
        latency_ms=round(latency, 2),
        finish_reason=resp.stop_reason or "end_turn",
    )


def _stream_anthropic(
    model: str,
    messages: List[Message],
    temperature: float,
    max_tokens: Optional[int],
    api_key: str,
) -> Iterator[str]:
    import anthropic
    client = anthropic.Anthropic(api_key=api_key)
    system_parts = [m.content for m in messages if m.role == "system"]
    chat_parts = [{"role": m.role, "content": m.content} for m in messages if m.role != "system"]
    with client.messages.stream(
        model=model,
        system="\n".join(system_parts) if system_parts else anthropic.NOT_GIVEN,
        messages=chat_parts,
        max_tokens=max_tokens or 4096,
        temperature=temperature,
    ) as stream:
        for text in stream.text_stream:
            yield text


def _call_gemini(
    model: str,
    messages: List[Message],
    temperature: float,
    max_tokens: Optional[int],
    api_key: str,
) -> LLMResponse:
    import google.generativeai as genai
    t0 = time.perf_counter()
    genai.configure(api_key=api_key)
    gen_model = genai.GenerativeModel(model)
    # Gemini uses a different message format
    history = []
    for m in messages:
        role = "user" if m.role in ("user", "system") else "model"
        history.append({"role": role, "parts": [m.content]})
    cfg = genai.types.GenerationConfig(temperature=temperature, **({"max_output_tokens": max_tokens} if max_tokens else {}))
    resp = gen_model.generate_content(history, generation_config=cfg)
    latency = (time.perf_counter() - t0) * 1000
    text = resp.text if hasattr(resp, "text") else ""
    usage = resp.usage_metadata if hasattr(resp, "usage_metadata") else None
    return LLMResponse(
        content=text,
        model=model,
        provider="gemini",
        prompt_tokens=getattr(usage, "prompt_token_count", 0) if usage else 0,
        completion_tokens=getattr(usage, "candidates_token_count", 0) if usage else 0,
        total_tokens=getattr(usage, "total_token_count", 0) if usage else 0,
        latency_ms=round(latency, 2),
    )


def _stream_gemini(
    model: str,
    messages: List[Message],
    temperature: float,
    max_tokens: Optional[int],
    api_key: str,
) -> Iterator[str]:
    import google.generativeai as genai
    genai.configure(api_key=api_key)
    gen_model = genai.GenerativeModel(model)
    history = []
    for m in messages:
        role = "user" if m.role in ("user", "system") else "model"
        history.append({"role": role, "parts": [m.content]})
    cfg = genai.types.GenerationConfig(temperature=temperature, **({"max_output_tokens": max_tokens} if max_tokens else {}))
    for chunk in gen_model.generate_content(history, generation_config=cfg, stream=True):
        if chunk.text:
            yield chunk.text


def _call_groq(
    model: str,
    messages: List[Message],
    temperature: float,
    max_tokens: Optional[int],
    api_key: str,
) -> LLMResponse:
    from groq import Groq
    t0 = time.perf_counter()
    client = Groq(api_key=api_key)
    resp = client.chat.completions.create(
        model=model,
        messages=_messages_to_dicts(messages),
        temperature=temperature,
        **({"max_tokens": max_tokens} if max_tokens else {}),
    )
    latency = (time.perf_counter() - t0) * 1000
    usage = resp.usage
    return LLMResponse(
        content=resp.choices[0].message.content or "",
        model=resp.model,
        provider="groq",
        prompt_tokens=usage.prompt_tokens if usage else 0,
        completion_tokens=usage.completion_tokens if usage else 0,
        total_tokens=usage.total_tokens if usage else 0,
        latency_ms=round(latency, 2),
        finish_reason=resp.choices[0].finish_reason or "stop",
    )


def _stream_groq(
    model: str,
    messages: List[Message],
    temperature: float,
    max_tokens: Optional[int],
    api_key: str,
) -> Iterator[str]:
    from groq import Groq
    client = Groq(api_key=api_key)
    stream = client.chat.completions.create(
        model=model,
        messages=_messages_to_dicts(messages),
        temperature=temperature,
        stream=True,
        **({"max_tokens": max_tokens} if max_tokens else {}),
    )
    for chunk in stream:
        delta = chunk.choices[0].delta.content if chunk.choices else None
        if delta:
            yield delta


# ──────────────────────────────────────────────────────────────────────────────
# Unified Provider Interface
# ──────────────────────────────────────────────────────────────────────────────

class UnifiedLLMProvider:
    """
    Single interface over all supported LLM providers.
    Usage:
        provider = UnifiedLLMProvider()
        response = provider.complete("gpt-4o", messages=[Message("user","Hello")])
        for token in provider.stream("claude-3-5-sonnet-20241022", messages=[...]):
            print(token, end="", flush=True)
    """

    # Provider registry — name → (api_key_env, base_url)
    PROVIDER_REGISTRY = {
        "openai":      ("OPENAI_API_KEY",      None),
        "anthropic":   ("ANTHROPIC_API_KEY",   None),
        "gemini":      ("GOOGLE_API_KEY",       None),
        "groq":        ("GROQ_API_KEY",         None),
        "deepseek":    ("DEEPSEEK_API_KEY",     "https://api.deepseek.com/v1"),
        "openrouter":  ("OPENROUTER_API_KEY",   "https://openrouter.ai/api/v1"),
    }

    def __init__(self, api_keys: Optional[Dict[str, str]] = None):
        """
        api_keys: optional dict of {provider_name: key} to override env vars.
        """
        self._keys = api_keys or {}

    def _resolve_key(self, provider: str, override_key: Optional[str] = None) -> Optional[str]:
        if override_key:
            return override_key
        if provider in self._keys:
            return self._keys[provider]
        env_var, _ = self.PROVIDER_REGISTRY.get(provider, (None, None))
        if env_var:
            return os.getenv(env_var)
        return None

    def _resolve_base_url(self, provider: str) -> Optional[str]:
        _, base_url = self.PROVIDER_REGISTRY.get(provider, (None, None))
        return base_url

    def complete(
        self,
        model: str,
        messages: List[Message],
        temperature: float = 0.2,
        max_tokens: Optional[int] = None,
        api_key: Optional[str] = None,
    ) -> LLMResponse:
        """Blocking call — returns a full LLMResponse."""
        provider = detect_provider(model)
        key = self._resolve_key(provider, api_key)
        base_url = self._resolve_base_url(provider)

        try:
            if provider == "anthropic":
                if not key:
                    raise ValueError("ANTHROPIC_API_KEY is not set")
                return _call_anthropic(model, messages, temperature, max_tokens, key)

            elif provider == "gemini":
                if not key:
                    raise ValueError("GOOGLE_API_KEY is not set")
                return _call_gemini(model, messages, temperature, max_tokens, key)

            elif provider == "groq":
                if not key:
                    raise ValueError("GROQ_API_KEY is not set")
                return _call_groq(model, messages, temperature, max_tokens, key)

            else:
                # openai / deepseek / openrouter all use the openai-compatible SDK
                if not key:
                    raise ValueError(f"API key for provider '{provider}' is not set")
                resp = _call_openai(model, messages, temperature, max_tokens, key, base_url)
                resp.provider = provider  # correct the provider label
                return resp

        except Exception as e:
            print(f"[UnifiedLLMProvider] {provider}/{model} failed: {e}")
            raise

    def stream(
        self,
        model: str,
        messages: List[Message],
        temperature: float = 0.2,
        max_tokens: Optional[int] = None,
        api_key: Optional[str] = None,
    ) -> Iterator[str]:
        """Streaming call — yields text tokens one by one."""
        provider = detect_provider(model)
        key = self._resolve_key(provider, api_key)
        base_url = self._resolve_base_url(provider)

        if provider == "anthropic":
            if not key:
                raise ValueError("ANTHROPIC_API_KEY is not set")
            yield from _stream_anthropic(model, messages, temperature, max_tokens, key)

        elif provider == "gemini":
            if not key:
                raise ValueError("GOOGLE_API_KEY is not set")
            yield from _stream_gemini(model, messages, temperature, max_tokens, key)

        elif provider == "groq":
            if not key:
                raise ValueError("GROQ_API_KEY is not set")
            yield from _stream_groq(model, messages, temperature, max_tokens, key)

        else:
            if not key:
                raise ValueError(f"API key for provider '{provider}' is not set")
            yield from _stream_openai(model, messages, temperature, max_tokens, key, base_url)

    def providers_status(self) -> List[Dict]:
        """Returns configured status of every provider (has key or not)."""
        out = []
        for pname, (env_var, base_url) in self.PROVIDER_REGISTRY.items():
            key = self._resolve_key(pname)
            out.append({
                "provider": pname,
                "configured": bool(key and len(key) > 5),
                "base_url": base_url,
                "env_var": env_var,
            })
        return out


# ──────────────────────────────────────────────────────────────────────────────
# Module-level singleton
# ──────────────────────────────────────────────────────────────────────────────
_provider = UnifiedLLMProvider()

def get_provider() -> UnifiedLLMProvider:
    return _provider
