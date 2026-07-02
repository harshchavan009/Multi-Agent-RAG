"use client";

import React, { useState, useEffect, useCallback } from "react";
import { apiFetch } from "../utils/api";
import {
  CheckCircle2, ChevronDown, ChevronUp, Eye, EyeOff,
  RefreshCw, Zap, Globe, Layers, BrainCircuit, Flame,
  Router, ArrowDown, Code2, Activity, Shield, Cpu
} from "lucide-react";

// ─── Provider catalogue ───────────────────────────────────────────────────────
const PROVIDERS: ProviderSpec[] = [
  {
    id: "openai", label: "OpenAI", shortLabel: "GPT",
    icon: <BrainCircuit className="h-5 w-5" />,
    accent: "#10a37f", bg: "#10a37f",
    description: "GPT-4o · GPT-4-turbo · o3-mini",
    envKey: "OPENAI_API_KEY", keyPlaceholder: "sk-…",
    models: [
      { id: "gpt-4o",       label: "GPT-4o",       tag: "Flagship",  ctx: "128K" },
      { id: "gpt-4o-mini",  label: "GPT-4o Mini",  tag: "Fast",      ctx: "128K" },
      { id: "gpt-4-turbo",  label: "GPT-4 Turbo",  tag: "Legacy",    ctx: "128K" },
      { id: "o3-mini",      label: "o3 Mini",       tag: "Reasoning", ctx: "200K" },
    ],
  },
  {
    id: "anthropic", label: "Anthropic", shortLabel: "Claude",
    icon: <Flame className="h-5 w-5" />,
    accent: "#d4836f", bg: "#d4836f",
    description: "Claude 3.5 Sonnet · Haiku · Opus",
    envKey: "ANTHROPIC_API_KEY", keyPlaceholder: "sk-ant-…",
    models: [
      { id: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet", tag: "Best",    ctx: "200K" },
      { id: "claude-3-5-haiku-20241022",  label: "Claude 3.5 Haiku",  tag: "Fast",    ctx: "200K" },
      { id: "claude-3-opus-20240229",     label: "Claude 3 Opus",     tag: "Powerful",ctx: "200K" },
    ],
  },
  {
    id: "gemini", label: "Gemini", shortLabel: "Gemini",
    icon: <Globe className="h-5 w-5" />,
    accent: "#4f8ef7", bg: "#4f8ef7",
    description: "Gemini 1.5 Pro · Flash · 2.0",
    envKey: "GOOGLE_API_KEY", keyPlaceholder: "AIza…",
    models: [
      { id: "gemini-1.5-pro",        label: "Gemini 1.5 Pro",   tag: "Best",   ctx: "1M"  },
      { id: "gemini-1.5-flash",      label: "Gemini 1.5 Flash", tag: "Fast",   ctx: "1M"  },
      { id: "gemini-2.0-flash-exp",  label: "Gemini 2.0 Flash", tag: "Latest", ctx: "1M"  },
    ],
  },
  {
    id: "groq", label: "Groq", shortLabel: "Llama",
    icon: <Zap className="h-5 w-5" />,
    accent: "#f97316", bg: "#f97316",
    description: "Llama 3.3 · Mixtral · Gemma via Groq",
    envKey: "GROQ_API_KEY", keyPlaceholder: "gsk_…",
    models: [
      { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B",  tag: "Best",    ctx: "128K" },
      { id: "llama-3.1-8b-instant",    label: "Llama 3.1 8B",   tag: "Fastest", ctx: "128K" },
      { id: "mixtral-8x7b-32768",      label: "Mixtral 8×7B",   tag: "MoE",     ctx: "32K"  },
      { id: "gemma2-9b-it",            label: "Gemma2 9B",      tag: "Compact", ctx: "8K"   },
    ],
  },
  {
    id: "deepseek", label: "DeepSeek", shortLabel: "DeepSeek",
    icon: <Layers className="h-5 w-5" />,
    accent: "#818cf8", bg: "#818cf8",
    description: "DeepSeek-V3 · R1 Reasoner · Coder",
    envKey: "DEEPSEEK_API_KEY", keyPlaceholder: "sk-…",
    models: [
      { id: "deepseek-chat",     label: "DeepSeek V3",    tag: "Flagship",  ctx: "64K" },
      { id: "deepseek-reasoner", label: "DeepSeek R1",    tag: "Reasoning", ctx: "64K" },
      { id: "deepseek-coder",    label: "DeepSeek Coder", tag: "Code",      ctx: "16K" },
    ],
  },
  {
    id: "openrouter", label: "OpenRouter", shortLabel: "Router",
    icon: <Router className="h-5 w-5" />,
    accent: "#a855f7", bg: "#a855f7",
    description: "Route to any model via OpenRouter",
    envKey: "OPENROUTER_API_KEY", keyPlaceholder: "sk-or-…",
    models: [
      { id: "mistralai/mistral-large",     label: "Mistral Large",   tag: "Strong",  ctx: "32K"  },
      { id: "meta-llama/llama-3.1-405b",  label: "Llama 3.1 405B",  tag: "Largest", ctx: "128K" },
      { id: "qwen/qwen-2.5-72b-instruct", label: "Qwen 2.5 72B",    tag: "MoE",     ctx: "128K" },
    ],
  },
];

interface ModelSpec   { id: string; label: string; tag: string; ctx: string; }
interface ProviderSpec {
  id: string; label: string; shortLabel: string;
  icon: React.ReactNode; accent: string; bg: string;
  description: string; envKey: string; keyPlaceholder: string;
  models: ModelSpec[];
}

const TAG_COLORS: Record<string, string> = {
  Flagship:  "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
  Best:      "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  Fast:      "bg-sky-500/15 text-sky-400 border-sky-500/30",
  Fastest:   "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  Reasoning: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  Legacy:    "bg-slate-500/15 text-slate-400 border-slate-500/30",
  Latest:    "bg-pink-500/15 text-pink-400 border-pink-500/30",
  Powerful:  "bg-orange-500/15 text-orange-400 border-orange-500/30",
  Code:      "bg-teal-500/15 text-teal-400 border-teal-500/30",
  MoE:       "bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/30",
  Largest:   "bg-rose-500/15 text-rose-400 border-rose-500/30",
  Strong:    "bg-amber-500/15 text-amber-400 border-amber-500/30",
  Compact:   "bg-lime-500/15 text-lime-400 border-lime-500/30",
};

import { useAuthStore } from "@/app/store/authStore";

// API feature cards shown below the architecture diagram
const API_FEATURES = [
  { icon: <Code2 className="h-4 w-4" />, label: "POST /llm/complete",  desc: "Blocking call — full response with token counts + latency" },
  { icon: <Activity className="h-4 w-4" />, label: "POST /llm/stream", desc: "SSE streaming — tokens arrive as they generate" },
  { icon: <Shield className="h-4 w-4" />, label: "GET /llm/providers", desc: "Check which providers have API keys configured" },
  { icon: <Cpu className="h-4 w-4" />, label: "GET /llm/models",       desc: "Full model catalogue grouped by provider" },
];

export default function ModelsPage() {
  const { activeWorkspaceId } = useAuthStore();
  const workspaceId = activeWorkspaceId || "8501bde6-222d-42d6-9d75-ae480447a0c0";

  const [activeModelId, setActiveModelId]     = useState("gpt-4o");
  const [expandedProvider, setExpandedProvider] = useState<string | null>("openai");
  const [apiKeys, setApiKeys]                 = useState<Record<string, string>>({});
  const [showKeys, setShowKeys]               = useState<Record<string, boolean>>({});
  const [saving, setSaving]                   = useState(false);
  const [providerStatus, setProviderStatus]   = useState<Record<string, boolean>>({});
  const [notification, setNotification]       = useState<{ text: string; ok: boolean } | null>(null);

  // Load active model + provider status
  useEffect(() => {
    apiFetch(`/settings/?workspace_id=${workspaceId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.active_model_name) setActiveModelId(d.active_model_name); })
      .catch(() => {});

    apiFetch("/llm/providers")
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.providers) {
          const map: Record<string, boolean> = {};
          d.providers.forEach((p: any) => { map[p.provider] = p.configured; });
          setProviderStatus(map);
        }
      })
      .catch(() => {});
  }, [workspaceId]);

  const notify = (text: string, ok: boolean) => {
    setNotification({ text, ok });
    setTimeout(() => setNotification(null), 3500);
  };

  const handleSelectModel = useCallback(async (modelId: string, providerId: string) => {
    setActiveModelId(modelId);
    setSaving(true);
    const apiKey = apiKeys[providerId] || undefined;
    try {
      const res = await apiFetch("/settings/model", {
        method: "PATCH",
        body: JSON.stringify({ workspace_id: workspaceId, model_name: modelId, api_key: apiKey }),
      });
      if (res.ok) {
        const pLabel = PROVIDERS.find(p => p.id === providerId)?.label;
        notify(`✓ Active model → ${pLabel} · ${modelId}`, true);
      } else {
        notify("Failed to save model selection", false);
      }
    } catch {
      notify("Network error saving model", false);
    } finally {
      setSaving(false);
    }
  }, [apiKeys, workspaceId]);

  const activeProvider = PROVIDERS.find(p => p.models.some(m => m.id === activeModelId));
  const activeModel    = activeProvider?.models.find(m => m.id === activeModelId);

  return (
    <div className="min-h-screen bg-[#080c14] text-white">
      {/* Toast notification */}
      {notification && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl text-sm font-semibold backdrop-blur-xl border transition-all ${
          notification.ok ? "bg-emerald-950/90 border-emerald-500/30 text-emerald-300" : "bg-rose-950/90 border-rose-500/30 text-rose-300"
        }`}>
          {notification.ok ? <CheckCircle2 className="h-4 w-4" /> : <RefreshCw className="h-4 w-4 animate-spin" />}
          {notification.text}
        </div>
      )}

      <div className="max-w-6xl mx-auto px-6 py-10 space-y-12">

        {/* ── Page header ── */}
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-400">Multi-Provider LLM</p>
          <h1 className="text-4xl font-extrabold tracking-tight">One Interface · Six Providers</h1>
          <p className="text-slate-400 text-sm max-w-xl">
            A single unified API surface routes your requests to any underlying LLM.
            Switch models without changing your code.
          </p>
        </div>

        {/* ── Architecture diagram ── */}
        <div className="relative rounded-3xl border border-white/8 overflow-hidden bg-[#0d1320] p-8">
          {/* Gradient glow bg */}
          <div className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.08) 0%, transparent 65%)" }} />

          <div className="relative flex flex-col items-center gap-0">

            {/* Top: Provider Interface box */}
            <div className="flex flex-col items-center">
              <div className="px-8 py-4 rounded-2xl border border-indigo-500/40 bg-indigo-500/10 backdrop-blur-xl shadow-xl shadow-indigo-500/10 text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 mb-1">Your Application</p>
                <p className="text-xl font-extrabold text-white">Provider Interface</p>
                <p className="text-[11px] text-slate-400 mt-1 font-mono">UnifiedLLMProvider.complete() / .stream()</p>
              </div>
              {/* Down arrow stem */}
              <div className="flex flex-col items-center gap-0 mt-3">
                <div className="w-px h-6 bg-gradient-to-b from-indigo-500/60 to-transparent" />
                <ArrowDown className="h-4 w-4 text-indigo-500/60 -mt-1" />
              </div>
            </div>

            {/* Auto-routing badge */}
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/4 text-[10px] font-bold text-slate-300 uppercase tracking-widest my-2">
              <Activity className="h-3 w-3 text-indigo-400" />
              Auto-routes by model name · Zero config switching
            </div>

            {/* Branching lines down to providers */}
            <div className="w-full flex justify-center mt-2 mb-4">
              <div className="w-[90%] flex items-start justify-between relative">
                {/* Horizontal bar */}
                <div className="absolute top-0 left-[8.33%] right-[8.33%] h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
                {/* Vertical drops to each card */}
                {PROVIDERS.map((p) => (
                  <div key={p.id} className="flex flex-col items-center" style={{ width: `${100 / PROVIDERS.length}%` }}>
                    <div className="w-px h-6 mt-0" style={{ background: `${p.accent}60` }} />
                    <ArrowDown className="h-3 w-3 -mt-1" style={{ color: `${p.accent}90` }} />
                  </div>
                ))}
              </div>
            </div>

            {/* Provider cards row */}
            <div className="grid grid-cols-6 gap-3 w-full">
              {PROVIDERS.map((p) => {
                const isActive = activeProvider?.id === p.id;
                const configured = providerStatus[p.id] ?? false;
                return (
                  <button
                    key={p.id}
                    onClick={() => setExpandedProvider(expandedProvider === p.id ? null : p.id)}
                    className="flex flex-col items-center gap-2.5 p-4 rounded-2xl border transition-all duration-200 group cursor-pointer"
                    style={{
                      borderColor: isActive ? `${p.accent}60` : "rgba(255,255,255,0.07)",
                      background: isActive ? `${p.accent}10` : "rgba(255,255,255,0.025)",
                      boxShadow: isActive ? `0 0 24px ${p.accent}18` : undefined,
                    }}
                  >
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center border"
                      style={{ color: p.accent, borderColor: `${p.accent}30`, background: `${p.accent}12` }}>
                      {p.icon}
                    </div>
                    <div className="text-center space-y-1">
                      <p className="text-xs font-bold text-white leading-none">{p.label}</p>
                      <p className="text-[9px] text-slate-500 font-mono leading-none">{p.shortLabel}</p>
                    </div>
                    {/* Configured / active badges */}
                    <div className="flex flex-col items-center gap-1 w-full">
                      {configured && (
                        <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 w-full text-center">
                          KEY SET
                        </span>
                      )}
                      {isActive && (
                        <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full w-full text-center border"
                          style={{ background: `${p.accent}15`, color: p.accent, borderColor: `${p.accent}30` }}>
                          ACTIVE
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── API feature pills ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {API_FEATURES.map((f) => (
            <div key={f.label} className="flex gap-3 p-4 rounded-2xl border border-white/7 bg-white/[0.025]">
              <div className="mt-0.5 text-indigo-400 shrink-0">{f.icon}</div>
              <div>
                <p className="text-[11px] font-bold text-white font-mono">{f.label}</p>
                <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Provider accordion + model selection ── */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-300">Select Active Model</h2>

          {PROVIDERS.map((provider) => {
            const isExpanded = expandedProvider === provider.id;
            const providerActive = provider.models.some(m => m.id === activeModelId);

            return (
              <div key={provider.id}
                className="rounded-2xl border overflow-hidden transition-all duration-200"
                style={{
                  borderColor: providerActive ? `${provider.accent}45` : "rgba(255,255,255,0.07)",
                  background: providerActive ? `${provider.accent}07` : "rgba(255,255,255,0.02)",
                }}>

                {/* Header */}
                <button className="w-full flex items-center gap-4 p-5 text-left"
                  onClick={() => setExpandedProvider(isExpanded ? null : provider.id)}>
                  <div className="h-9 w-9 rounded-xl flex items-center justify-center border shrink-0"
                    style={{ color: provider.accent, borderColor: `${provider.accent}30`, background: `${provider.accent}10` }}>
                    {provider.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-white">{provider.label}</span>
                      {providerActive && (
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full"
                          style={{ background: `${provider.accent}20`, color: provider.accent }}>
                          Active
                        </span>
                      )}
                      {providerStatus[provider.id] && (
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">
                          Key configured
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">{provider.description}</p>
                  </div>
                  <div className="text-slate-600 shrink-0">
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t px-5 pb-5 pt-4 space-y-4"
                    style={{ borderColor: `${provider.accent}18` }}>

                    {/* API Key */}
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                        {provider.envKey}
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type={showKeys[provider.id] ? "text" : "password"}
                          placeholder={provider.keyPlaceholder}
                          value={apiKeys[provider.id] || ""}
                          onChange={e => setApiKeys(k => ({ ...k, [provider.id]: e.target.value }))}
                          className="flex-1 text-xs bg-slate-950/60 border border-white/8 rounded-xl px-4 py-2.5 text-slate-200 placeholder:text-slate-600 outline-none focus:border-white/20 transition font-mono"
                        />
                        <button
                          onClick={() => setShowKeys(s => ({ ...s, [provider.id]: !s[provider.id] }))}
                          className="p-2.5 rounded-xl border border-white/8 text-slate-500 hover:text-white hover:border-white/20 transition"
                        >
                          {showKeys[provider.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <p className="text-[9px] text-slate-600">
                        Leave blank to use the server <span className="font-mono text-slate-500">{provider.envKey}</span> environment variable.
                      </p>
                    </div>

                    {/* Model grid */}
                    <div className="grid grid-cols-2 gap-3">
                      {provider.models.map((model) => {
                        const isActive = model.id === activeModelId;
                        return (
                          <button key={model.id}
                            onClick={() => handleSelectModel(model.id, provider.id)}
                            disabled={saving}
                            className="group relative flex flex-col gap-2 p-4 rounded-xl border text-left transition-all duration-150 disabled:opacity-60"
                            style={{
                              borderColor: isActive ? `${provider.accent}55` : "rgba(255,255,255,0.07)",
                              background: isActive ? `${provider.accent}10` : "rgba(255,255,255,0.02)",
                              boxShadow: isActive ? `0 0 20px ${provider.accent}12` : undefined,
                            }}>
                            {isActive && (
                              <CheckCircle2 className="absolute top-3 right-3 h-4 w-4"
                                style={{ color: provider.accent }} />
                            )}
                            <span className="text-sm font-bold text-white pr-6">{model.label}</span>
                            <div className="flex items-center gap-2">
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${TAG_COLORS[model.tag] || "bg-slate-800 text-slate-400 border-slate-700"}`}>
                                {model.tag}
                              </span>
                              <span className="text-[9px] text-slate-600 font-mono">{model.ctx} ctx</span>
                            </div>
                            <p className="text-[9px] font-mono text-slate-600 truncate">{model.id}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Active model status bar */}
        {activeModel && activeProvider && (
          <div className="flex items-center gap-4 p-4 rounded-2xl border"
            style={{ borderColor: `${activeProvider.accent}30`, background: `${activeProvider.accent}08` }}>
            <div className="h-2 w-2 rounded-full animate-pulse" style={{ background: activeProvider.accent }} />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: activeProvider.accent }}>Active Engine</p>
              <p className="text-sm font-bold text-white">{activeProvider.label} · {activeModel.label}</p>
            </div>
            <div className="ml-auto text-[10px] font-mono text-slate-500">{activeModel.id}</div>
            {saving && <RefreshCw className="h-3.5 w-3.5 animate-spin text-slate-500" />}
          </div>
        )}
      </div>
    </div>
  );
}
