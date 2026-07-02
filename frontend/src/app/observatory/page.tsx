"use client";

import React, { useState, useEffect } from "react";
import { apiFetch } from "@/app/utils/api";
import { useAuthStore } from "@/app/store/authStore";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cpu,
  Brain,
  Sliders,
  Sparkles,
  Search,
  Database,
  Terminal,
  ExternalLink,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Loader2,
  DollarSign,
  ArrowRight,
  RefreshCw
} from "lucide-react";

interface TraceLog {
  id: string;
  created_at: string;
  query: string;
  prompt: string;
  completion: string;
  tokens_consumed: number;
  cost_usd: number;
  latency_ms: number;
  hallucination_score: number;
  similarity_score: number;
  sources_used: string[];
  tool_calls: string[];
  model: string;
  agent_history: string[];
}

export default function AIObservatory() {
  const { activeWorkspaceId } = useAuthStore();
  const workspaceId = activeWorkspaceId || "8501bde6-222d-42d6-9d75-ae480447a0c0";

  const [traces, setTraces] = useState<TraceLog[]>([]);
  const [activeTrace, setActiveTrace] = useState<TraceLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchTraces();
  }, [workspaceId]);

  const fetchTraces = async () => {
    setRefreshing(true);
    try {
      const res = await apiFetch(`/analytics/observability/traces?workspace_id=${workspaceId}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        setTraces(data);
        if (data.length > 0 && !activeTrace) {
          setActiveTrace(data[0]);
        }
      }
    } catch (err) {
      console.error("Failed to load observability traces", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Derive summary metrics from live traces list
  const totalCost = traces.reduce((s, t) => s + (t.cost_usd || 0), 0);
  const totalTokens = traces.reduce((s, t) => s + (t.tokens_consumed || 0), 0);
  const avgLatency = traces.length > 0 ? Math.round(traces.reduce((s, t) => s + t.latency_ms, 0) / traces.length) : 0;
  const avgHallucination = traces.length > 0 ? parseFloat((traces.reduce((s, t) => s + t.hallucination_score, 0) / traces.length).toFixed(2)) : 0.0;
  const avgSimilarity = traces.length > 0 ? parseFloat((traces.reduce((s, t) => s + t.similarity_score, 0) / traces.length).toFixed(2)) : 0.0;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-slate-950/20">
      {/* 1. Header Banner */}
      <header className="p-6 md:p-8 border-b border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-950 shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
                <Activity className="h-6 w-6" />
              </span>
              <h1 className="text-xl md:text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
                AI Observability & Trace Logs
              </h1>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Audit granular LLM completions, similarity benchmarks, hallucination filters, and token usage in real time.
            </p>
          </div>

          <button
            onClick={fetchTraces}
            disabled={refreshing}
            className="flex items-center gap-2 bg-indigo-650 hover:bg-indigo-600 disabled:bg-slate-100 dark:disabled:bg-slate-900 disabled:text-slate-400 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition shadow-sm cursor-pointer"
          >
            {refreshing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Refreshing...</span>
              </>
            ) : (
              <>
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Sync Trace Audits</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Grid Content */}
      <main className="max-w-7xl mx-auto p-6 md:p-8 space-y-8">
        
        {/* KPI Metrics Dashboard Row */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-900/60 p-4 rounded-2xl shadow-sm text-left">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Avg Latency</p>
            <p className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-1">{avgLatency} ms</p>
            <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold block mt-1">SLA Target: &lt; 900ms</span>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-900/60 p-4 rounded-2xl shadow-sm text-left">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Hallucination Index</p>
            <p className="text-xl font-black text-rose-500 mt-1">{(avgHallucination * 100).toFixed(1)}%</p>
            <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold block mt-1">Guardrail Status: Nominal</span>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-900/60 p-4 rounded-2xl shadow-sm text-left">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Similarity Accuracy</p>
            <p className="text-xl font-black text-emerald-500 mt-1">{(avgSimilarity * 100).toFixed(1)}%</p>
            <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold block mt-1">Vector DB Match Confidence</span>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-900/60 p-4 rounded-2xl shadow-sm text-left">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Accumulated Tokens</p>
            <p className="text-xl font-black text-slate-800 dark:text-slate-100 mt-1">{totalTokens.toLocaleString()}</p>
            <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold block mt-1">Total Model Consumption</span>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-900/60 p-4 rounded-2xl shadow-sm text-left col-span-2 lg:col-span-1">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Total API Cost</p>
            <p className="text-xl font-black text-slate-800 dark:text-slate-100 mt-1">${totalCost.toFixed(5)}</p>
            <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold block mt-1">USD Estimated Incurred</span>
          </div>
        </div>

        {/* Trace List and Detail Inspector Columns Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 min-h-[500px]">
          
          {/* Left Column: Trace List Log */}
          <div className="lg:col-span-5 space-y-4">
            <h2 className="text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider text-left">Trace Audit Logs ({traces.length})</h2>
            
            {loading ? (
              <div className="flex flex-col gap-3 items-center justify-center py-20 text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-2xl">
                <Loader2 className="h-7 w-7 animate-spin text-indigo-500" />
                <span className="text-xs font-bold animate-pulse">Syncing observability logs...</span>
              </div>
            ) : traces.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 p-10 rounded-2xl text-center space-y-3">
                <div className="h-10 w-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto text-slate-450">
                  <Terminal className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-755 dark:text-slate-250">No Pipeline Traces Recorded</h4>
                  <p className="text-[11px] text-slate-500 max-w-xs mx-auto mt-1">
                    Ask queries to compliance, RAG, or code agents to start tracking trace latency, token logs, and hallucination guardrails.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1">
                {traces.map((trace) => {
                  const isActive = activeTrace?.id === trace.id;
                  return (
                    <div
                      key={trace.id}
                      onClick={() => setActiveTrace(trace)}
                      className={`p-4 rounded-2xl border text-left cursor-pointer transition-all duration-300 relative overflow-hidden group ${
                        isActive
                          ? "bg-indigo-500/10 border-indigo-500 shadow-sm"
                          : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-900/60 hover:border-slate-350 dark:hover:border-slate-850"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-[8px] font-black uppercase bg-indigo-500/10 text-indigo-500 border border-indigo-500/25 px-2 py-0.5 rounded">
                          {trace.model}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {new Date(trace.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                      
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate mt-2">
                        {trace.query}
                      </p>
                      
                      <div className="flex items-center gap-4 text-[9px] text-slate-450 dark:text-slate-500 font-bold mt-3.5 pt-2 border-t border-slate-50 dark:border-slate-850/40">
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-indigo-500" /> {trace.latency_ms} ms</span>
                        <span>{trace.tokens_consumed} tokens</span>
                        <span className="text-indigo-500 font-extrabold ml-auto flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                          Audit <ChevronRight className="h-3.5 w-3.5" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Trace Inspector */}
          <div className="lg:col-span-7 space-y-4">
            <h2 className="text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider text-left">Granular Trace Auditor</h2>
            
            {activeTrace ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-900/60 rounded-2xl p-6 space-y-6 text-left shadow-sm">
                {/* 1. Header trace identity */}
                <div className="pb-4.5 border-b border-slate-100 dark:border-slate-850 flex items-center justify-between gap-4 flex-wrap">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase bg-indigo-500/10 text-indigo-500 px-2.5 py-0.5 rounded border border-indigo-500/20">
                        {activeTrace.model}
                      </span>
                      <span className="text-[9px] font-black text-slate-400 font-mono">ID: {activeTrace.id}</span>
                    </div>
                    <p className="text-[10px] text-slate-500">Trace timestamp: {new Date(activeTrace.created_at).toLocaleString()}</p>
                  </div>
                  
                  <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 px-3.5 py-1.5 rounded-full border border-slate-200 dark:border-slate-900 font-mono text-[10px]">
                    <span className="text-slate-400">Execution time:</span>
                    <span className="font-extrabold text-indigo-500">{activeTrace.latency_ms} ms</span>
                  </div>
                </div>

                {/* 2. Numeric Observability Indicators */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-900">
                    <span className="text-[9px] text-slate-450 font-black uppercase block tracking-wider">Hallucination</span>
                    <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100 block mt-1">{(activeTrace.hallucination_score * 100).toFixed(1)}%</span>
                  </div>
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-900">
                    <span className="text-[9px] text-slate-450 font-black uppercase block tracking-wider">Similarity Score</span>
                    <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100 block mt-1">{(activeTrace.similarity_score * 100).toFixed(1)}%</span>
                  </div>
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-900">
                    <span className="text-[9px] text-slate-450 font-black uppercase block tracking-wider">Token Usage</span>
                    <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100 block mt-1">{activeTrace.tokens_consumed} tokens</span>
                  </div>
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-900">
                    <span className="text-[9px] text-slate-450 font-black uppercase block tracking-wider">Estimated Cost</span>
                    <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100 block mt-1">${activeTrace.cost_usd.toFixed(6)}</span>
                  </div>
                </div>

                {/* 3. Text prompt and completions logger */}
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <span className="text-[10px] text-slate-500 uppercase font-black block tracking-wider">Input Prompt Text</span>
                    <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-900 text-xs text-slate-755 dark:text-slate-350 leading-relaxed font-semibold max-h-[100px] overflow-y-auto">
                      {activeTrace.prompt}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[10px] text-slate-500 uppercase font-black block tracking-wider">Completion Response Payload</span>
                    <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-900 text-xs text-slate-755 dark:text-slate-300 leading-relaxed max-h-[220px] overflow-y-auto whitespace-pre-wrap">
                      {activeTrace.completion}
                    </div>
                  </div>
                </div>

                {/* 4. Tapped tool calls & Document Sources Used chips */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100 dark:border-slate-850">
                  <div className="space-y-2">
                    <span className="text-[10px] text-slate-500 uppercase font-black block tracking-wider">Tapped Tool Calls</span>
                    <div className="flex flex-wrap gap-1.5">
                      {activeTrace.tool_calls.map((t, idx) => (
                        <span key={idx} className="flex items-center gap-1.5 text-[10px] bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold px-3 py-1.5 rounded-xl">
                          <Terminal className="h-3 w-3" /> {t}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[10px] text-slate-500 uppercase font-black block tracking-wider">Document Sources Used</span>
                    <div className="flex flex-wrap gap-1.5">
                      {activeTrace.sources_used.length === 0 ? (
                        <span className="text-[10px] text-slate-400 italic">No external document slices retrieved.</span>
                      ) : (
                        activeTrace.sources_used.map((src, idx) => (
                          <span key={idx} className="flex items-center gap-1.5 text-[10px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 text-slate-655 dark:text-slate-400 font-bold px-3 py-1.5 rounded-xl">
                            <Database className="h-3 w-3 text-indigo-500" /> {src}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* 5. Routing trace flow logs */}
                <div className="space-y-2.5 pt-4 border-t border-slate-100 dark:border-slate-850">
                  <span className="text-[10px] text-slate-500 uppercase font-black block tracking-wider">Agent Routing History Trace</span>
                  <div className="flex items-center gap-2 flex-wrap text-[10px] font-extrabold text-slate-650 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 p-3 rounded-xl">
                    {activeTrace.agent_history.map((name, i) => (
                      <React.Fragment key={i}>
                        {i > 0 && <ArrowRight className="h-3 w-3 text-indigo-500 shrink-0" />}
                        <span className="px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 shadow-sm">{name}</span>
                      </React.Fragment>
                    ))}
                  </div>
                </div>

              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-900/60 rounded-2xl p-12 text-center text-xs text-slate-400 font-bold italic">
                Select an LLM event trace from the list to audit its execution details.
              </div>
            )}
          </div>

        </div>

      </main>
    </div>
  );
}
