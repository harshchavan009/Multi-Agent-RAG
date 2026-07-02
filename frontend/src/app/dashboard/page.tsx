"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuthStore } from "@/app/store/authStore";
import { apiFetch } from "@/app/utils/api";
import Link from "next/link";
import { DashboardSkeleton } from "@/components/Skeletons";
import {
  Shield, Brain, Eye, BarChart2, FileText, Network,
  Activity, Zap, CheckCircle2, AlertTriangle, Clock,
  Cpu, Database, Workflow, ArrowRight, Play, Pause,
  TrendingUp, TrendingDown, DollarSign, Radio,
  Layers, MessageSquare, RefreshCw, Circle,
  ChevronRight, Terminal, GitBranch, Box,
  Sparkles, Globe, Lock, Search
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area,
  LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip
} from "recharts";

// ─── Utility ──────────────────────────────────────────────────────────────────
const rand = (min: number, max: number, dp = 0) => {
  const v = Math.random() * (max - min) + min;
  return dp === 0 ? Math.round(v) : parseFloat(v.toFixed(dp));
};
const jitter = (base: number, pct = 0.08) =>
  parseFloat((base * (1 + (Math.random() - 0.5) * pct * 2)).toFixed(2));

// ─── Agent config ─────────────────────────────────────────────────────────────
type AgentState = "running" | "idle" | "queued" | "error";

interface AgentNode {
  id: string; name: string; role: string;
  state: AgentState; task: string;
  tokens: number; latency: number;
  color: string; icon: React.FC<{ className?: string }>;
  progress: number;
}

const makeAgents = (): AgentNode[] => [
  { id: "supervisor",  name: "Supervisor",        role: "Orchestration",    state: "running", task: "Routing query to downstream agents",          tokens: rand(800,1400),  latency: rand(90,180),  color: "#6366f1", icon: Shield,    progress: rand(40,90) },
  { id: "research",    name: "Research Agent",     role: "Web Retrieval",    state: "running", task: "Crawling arxiv.org for recent LLM papers",     tokens: rand(1200,2400), latency: rand(200,500), color: "#8B5CF6", icon: Brain,     progress: rand(20,75) },
  { id: "rag",         name: "RAG Agent",          role: "Vector Search",    state: "running", task: "Semantic search across 14,280 chunks",         tokens: rand(600,1200),  latency: rand(80,200),  color: "#3B82F6", icon: Eye,       progress: rand(50,95) },
  { id: "analytics",   name: "Analytics Agent",    role: "Data Processing",  state: "queued",  task: "Waiting for RAG context output",              tokens: 0,               latency: 0,             color: "#10B981", icon: BarChart2, progress: 0 },
  { id: "compliance",  name: "Compliance Agent",   role: "Guardrails",       state: "idle",    task: "Standby — No guardrail violations detected",   tokens: rand(100,300),   latency: rand(40,80),   color: "#F59E0B", icon: Lock,      progress: 100 },
  { id: "report",      name: "Report Agent",       role: "Output Generation",state: "queued",  task: "Pending analytics completion",                tokens: 0,               latency: 0,             color: "#EC4899", icon: FileText,  progress: 0 },
];

// ─── Workflow config ───────────────────────────────────────────────────────────
interface WorkflowRun {
  id: string; name: string; status: "running" | "completed" | "failed" | "pending";
  progress: number; startedAt: string; duration: string; steps: number; stepsComplete: number;
  color: string;
}

const WORKFLOWS: WorkflowRun[] = [
  { id: "wf-1", name: "Enterprise Q&A Pipeline",    status: "running",   progress: 67, startedAt: "2m ago", duration: "~45s",  steps: 6, stepsComplete: 4, color: "#6366f1" },
  { id: "wf-2", name: "Document Ingestion Batch",   status: "running",   progress: 43, startedAt: "5m ago", duration: "~2m",   steps: 4, stepsComplete: 2, color: "#3B82F6" },
  { id: "wf-3", name: "Research Synthesis Report",  status: "completed", progress: 100,startedAt: "8m ago", duration: "1m 12s",steps: 5, stepsComplete: 5, color: "#10B981" },
  { id: "wf-4", name: "Compliance Audit Scan",      status: "pending",   progress: 0,  startedAt: "—",      duration: "~30s",  steps: 3, stepsComplete: 0, color: "#F59E0B" },
  { id: "wf-5", name: "Knowledge Graph Update",     status: "failed",    progress: 28, startedAt: "12m ago",duration: "—",     steps: 4, stepsComplete: 1, color: "#EF4444" },
];

// ─── Document indexing ─────────────────────────────────────────────────────────
interface IndexingDoc { id: string; name: string; size: string; chunks: number; progress: number; status: "indexing" | "done" | "queued"; }
const DOCS: IndexingDoc[] = [
  { id: "d1", name: "sales_q2_2024.pdf",          size: "4.2 MB",  chunks: 142, progress: 100, status: "done" },
  { id: "d2", name: "board_meeting_notes.docx",   size: "1.1 MB",  chunks: 38,  progress: 78,  status: "indexing" },
  { id: "d3", name: "employee_handbook_v4.pdf",   size: "8.9 MB",  chunks: 312, progress: 45,  status: "indexing" },
  { id: "d4", name: "financial_report_2023.xlsx", size: "2.3 MB",  chunks: 86,  progress: 0,   status: "queued" },
  { id: "d5", name: "product_roadmap_q3.pdf",     size: "3.7 MB",  chunks: 124, progress: 0,   status: "queued" },
];

// ─── Metric chart data ─────────────────────────────────────────────────────────
const makeLatencyData = () =>
  Array.from({ length: 20 }, (_, i) => ({
    t: i, v: rand(120, 650)
  }));

const makeThroughputData = () =>
  Array.from({ length: 20 }, (_, i) => ({
    t: i, queries: rand(8, 48), docs: rand(2, 12)
  }));

// ─── Event log ────────────────────────────────────────────────────────────────
type LogLevel = "info" | "success" | "warn" | "error";
interface LogLine { id: number; ts: string; level: LogLevel; msg: string; }

const LOG_POOL: { level: LogLevel; msg: string }[] = [
  { level: "success", msg: "Workflow 'Enterprise Q&A Pipeline' completed in 1.12s" },
  { level: "info",    msg: "RAG Agent: retrieved 8 chunks (score > 0.82) for query" },
  { level: "info",    msg: "Supervisor: routing query → Research + RAG in parallel" },
  { level: "success", msg: "Document 'sales_q2_2024.pdf' indexed — 142 chunks created" },
  { level: "warn",    msg: "Compliance Agent: PII pattern detected, redacting field" },
  { level: "info",    msg: "Knowledge Graph: 3 new entity edges committed to Neo4j" },
  { level: "success", msg: "Analytics Agent: dashboard telemetry snapshot written" },
  { level: "error",   msg: "Workflow 'Knowledge Graph Update' failed: timeout 30s" },
  { level: "info",    msg: "Model GPT-4o selected for reasoning — 4096 ctx window" },
  { level: "success", msg: "Citation groundedness score: 0.97 (above 0.90 threshold)" },
  { level: "warn",    msg: "Redis queue depth: 14 jobs (threshold: 10) — scaling up" },
  { level: "info",    msg: "Embedding model: text-embedding-3-large — 3072 dims" },
  { level: "success", msg: "SLA guardrail: 99.9% queries under 500ms target" },
  { level: "info",    msg: "Qdrant collection 'workspace_default': 14,280 vectors" },
];

const fmtTime = () => new Date().toLocaleTimeString("en-US", { hour12: false });

// ─── Sparkline ─────────────────────────────────────────────────────────────────
function Spark({ data, color, h = 32 }: { data: number[]; color: string; h?: number }) {
  const w = 80;
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * h}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible shrink-0">
      <polyline fill={`${color}20`} stroke="none" points={`0,${h} ${pts} ${w},${h}`} />
      <polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" points={pts} />
    </svg>
  );
}

// ─── Mini Knowledge Graph SVG ─────────────────────────────────────────────────
function KnowledgeGraphMini() {
  const nodes = [
    { id: 0, x: 88,  y: 60,  label: "GPT-4o",       color: "#6366f1", r: 18 },
    { id: 1, x: 200, y: 30,  label: "Research",      color: "#8B5CF6", r: 14 },
    { id: 2, x: 200, y: 100, label: "RAG",           color: "#3B82F6", r: 14 },
    { id: 3, x: 310, y: 20,  label: "arxiv",         color: "#10B981", r: 11 },
    { id: 4, x: 310, y: 60,  label: "Qdrant",        color: "#F59E0B", r: 11 },
    { id: 5, x: 310, y: 95,  label: "Postgres",      color: "#EC4899", r: 11 },
    { id: 6, x: 390, y: 40,  label: "Citation",      color: "#06B6D4", r: 9  },
    { id: 7, x: 390, y: 80,  label: "Embedding",     color: "#8B5CF6", r: 9  },
  ];
  const edges = [
    [0,1],[0,2],[1,3],[1,4],[2,4],[2,5],[3,6],[4,6],[4,7],[5,7]
  ];
  return (
    <svg width="100%" height="130" viewBox="0 0 440 130" className="overflow-visible">
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      {/* Edges */}
      {edges.map(([a, b], i) => {
        const na = nodes[a], nb = nodes[b];
        return (
          <line key={i} x1={na.x} y1={na.y} x2={nb.x} y2={nb.y}
            stroke="#334155" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.7" />
        );
      })}
      {/* Nodes */}
      {nodes.map(n => (
        <g key={n.id} filter="url(#glow)">
          <circle cx={n.x} cy={n.y} r={n.r} fill={`${n.color}20`} stroke={n.color} strokeWidth="1.5" />
          <text x={n.x} y={n.y + 4} textAnchor="middle" fontSize="7" fill={n.color} fontWeight="700">
            {n.label}
          </text>
        </g>
      ))}
      {/* Animated pulse on center node */}
      <circle cx={88} cy={60} r={22} fill="none" stroke="#6366f1" strokeWidth="1" opacity="0.4">
        <animate attributeName="r" values="22;30;22" dur="3s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.4;0;0.4" dur="3s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: AgentState | WorkflowRun["status"] | "indexing" | "done" }) {
  const map = {
    running:   "bg-blue-500/10 text-blue-400 border-blue-500/20",
    idle:      "bg-slate-500/10 text-slate-500 border-slate-500/20",
    queued:    "bg-amber-500/10 text-amber-400 border-amber-500/20",
    error:     "bg-rose-500/10 text-rose-400 border-rose-500/20",
    completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    failed:    "bg-rose-500/10 text-rose-400 border-rose-500/20",
    pending:   "bg-slate-500/10 text-slate-400 border-slate-500/20",
    indexing:  "bg-blue-500/10 text-blue-400 border-blue-500/20",
    done:      "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  } as Record<string, string>;
  const pulseMap: Record<string, boolean> = { running: true, indexing: true };
  return (
    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black border uppercase tracking-wide ${map[status] ?? map.idle}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${pulseMap[status] ? "animate-pulse" : ""}`}
        style={{ background: "currentColor" }} />
      {status}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function OperationsCenter() {
  const { user } = useAuthStore();

  // Live agent state
  const [agents, setAgents] = useState<AgentNode[]>(makeAgents);
  const [workflows, setWorkflows] = useState<WorkflowRun[]>(WORKFLOWS);
  const [docs, setDocs] = useState<IndexingDoc[]>(DOCS);
  const [queueDepth, setQueueDepth] = useState(0);
  const [logs, setLogs] = useState<LogLine[]>(() =>
    Array.from({ length: 8 }, (_, i) => ({
      id: i, ts: fmtTime(),
      level: LOG_POOL[i].level,
      msg: LOG_POOL[i].msg,
    }))
  );
  const logCounter = useRef(8);

  // Chart data
  const [latencyData, setLatencyData] = useState(makeLatencyData);
  const [throughputData, setThroughputData] = useState(makeThroughputData);
  const [latencySparkMap, setLatencySparkMap] = useState<Record<string, number[]>>(() =>
    Object.fromEntries(makeAgents().map(a => [a.id, Array.from({length:10}, () => rand(80,600))]))
  );

  // KPIs
  const [kpis, setKpis] = useState({
    queries: 324800, tokens: 14320000, cost: 342.10,
    accuracy: 99.4, latency: 185, activeAgents: 3,
  });

  const { activeWorkspaceId } = useAuthStore();
  const [tick, setTick] = useState(0);
  const [isLive, setIsLive] = useState(true);
  const [loading, setLoading] = useState(true);
  const logRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState("");

  useEffect(() => {
    setNow(new Date().toLocaleTimeString());
    
    const workspaceId = activeWorkspaceId || "8501bde6-222d-42d6-9d75-ae480447a0c0";
    Promise.all([
      apiFetch(`/analytics/dashboard?workspace_id=${workspaceId}`),
      apiFetch(`/analytics/enterprise?workspace_id=${workspaceId}`)
    ])
      .then(async ([dashRes, entRes]) => {
        if (dashRes.ok && entRes.ok) {
          const dashData = await dashRes.json();
          const entData = await entRes.json();
          
          setKpis({
            queries: parseInt(dashData.kpis?.monthly_queries) || 0,
            tokens: entData.llm?.total_tokens || 0,
            cost: entData.llm?.total_cost || 0.0,
            accuracy: parseFloat(dashData.kpis?.accuracy?.replace('%', '')) || 96.8,
            latency: Math.round(entData.llm?.avg_latency) || 320,
            activeAgents: parseInt(dashData.kpis?.agents_active) || 5
          });

          if (dashData.activity_feed && Array.isArray(dashData.activity_feed)) {
            const mappedLogs = dashData.activity_feed.map((act: any, idx: number) => ({
              id: idx,
              ts: act.time === "Just now" ? fmtTime() : act.time || fmtTime(),
              level: (act.type === "success" || act.type === "info" || act.type === "warn" || act.type === "error") ? act.type : "info" as LogLevel,
              msg: `${act.event}: ${act.details}`
            }));
            setLogs(mappedLogs);
          }
        }
      })
      .catch((err) => console.error("Telemetry query failed:", err))
      .finally(() => setLoading(false));
  }, [activeWorkspaceId]);

  const isLiveRef = useRef(isLive);
  useEffect(() => {
    isLiveRef.current = isLive;
  }, [isLive]);

  // Real-time WebSocket Telemetry
  useEffect(() => {
    if (typeof window === "undefined" || loading) return;

    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let pingInterval: NodeJS.Timeout | null = null;

    const connect = () => {
      const host = window.location.hostname;
      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      const port = window.location.port === "3000" ? ":8000" : (window.location.port ? `:${window.location.port}` : "");
      const wsUrl = `${protocol}://${host}${port}/ws`;
      console.log(`[Dashboard] Connecting to telemetry WS: ${wsUrl}`);
      
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("[Dashboard] Telemetry WebSocket connected.");
        pingInterval = setInterval(() => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send("ping");
          }
        }, 15000);
      };

      ws.onmessage = (event) => {
        if (event.data === "pong") return;
        try {
          const data = JSON.parse(event.data);
          if (data.type === "dashboard_telemetry") {
            if (!isLiveRef.current) return;

            setKpis({
              queries: data.kpis.queries,
              tokens: data.kpis.tokens,
              cost: data.kpis.cost,
              accuracy: data.kpis.accuracy,
              latency: data.kpis.latency,
              activeAgents: data.kpis.activeAgents
            });

            setQueueDepth(data.queue_depth || 0);

            if (data.agents && Array.isArray(data.agents)) {
              setAgents(prev => prev.map(a => {
                const match = data.agents.find((ia: any) => ia.id === a.id);
                if (match) {
                  return {
                    ...a,
                    state: match.state,
                    task: match.task,
                    progress: match.progress,
                    tokens: match.tokens || a.tokens,
                    latency: match.latency || a.latency
                  };
                }
                return a;
              }));
              
              setLatencySparkMap(prev => {
                const out = { ...prev };
                data.agents.forEach((ia: any) => {
                  if (out[ia.id]) {
                    out[ia.id] = [...out[ia.id].slice(-9), ia.latency || rand(80, 200)];
                  } else {
                    out[ia.id] = Array.from({length: 10}, () => ia.latency || rand(80, 200));
                  }
                });
                return out;
              });
            }

            if (data.docs && Array.isArray(data.docs)) {
              setDocs(data.docs);
            }

            if (data.workflows && Array.isArray(data.workflows)) {
              setWorkflows(prev => {
                return prev.map(w => {
                  const match = data.workflows.find((iw: any) => iw.name === w.name || iw.id === w.id);
                  if (match) {
                    return {
                      ...w,
                      status: match.status,
                      progress: match.progress,
                      stepsComplete: match.stepsComplete,
                      duration: match.duration || w.duration,
                      startedAt: match.startedAt || w.startedAt
                    };
                  }
                  return w;
                });
              });
            }

            if (data.logs && Array.isArray(data.logs)) {
              setLogs(data.logs);
            }

            setLatencyData(prev => [...prev.slice(-19), { t: prev.length, v: data.kpis.latency }]);
            setThroughputData(prev => {
              return [...prev.slice(-19), {
                t: prev.length,
                queries: data.kpis.activeAgents * 2 + (data.kpis.queries % 5),
                docs: data.docs.filter((d: any) => d.status === "indexing").length * 3 + (data.docs.filter((d: any) => d.status === "done").length % 4)
              }];
            });

            setTick(t => t + 1);
            setNow(new Date().toLocaleTimeString());
          }
        } catch (err) {
          console.error("[Dashboard] Error parsing telemetry data:", err);
        }
      };

      ws.onclose = () => {
        console.log("[Dashboard] Telemetry WebSocket closed. Reconnecting...");
        if (pingInterval) clearInterval(pingInterval);
        reconnectTimeout = setTimeout(connect, 3500);
      };

      ws.onerror = (err) => {
        console.warn("[Dashboard] Telemetry WebSocket error:", err);
        if (ws) ws.close();
      };
    };

    connect();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (pingInterval) clearInterval(pingInterval);
    };
  }, [loading]);

  const logColor: Record<LogLevel, string> = {
    info:    "text-slate-400 dark:text-slate-500",
    success: "text-emerald-600 dark:text-emerald-400",
    warn:    "text-amber-600 dark:text-amber-400",
    error:   "text-rose-600 dark:text-rose-400",
  };
  const logPrefix: Record<LogLevel, string> = {
    info:    "[INFO ]",
    success: "[OK   ]",
    warn:    "[WARN ]",
    error:   "[ERROR]",
  };

  const wfColor = { running: "#3B82F6", completed: "#10B981", failed: "#EF4444", pending: "#64748b" } as Record<string, string>;

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground transition-colors duration-200">

      {/* ══════════════ MISSION CONTROL HEADER ══════════════ */}
      <div className="border-b border-border px-6 py-3 flex items-center justify-between bg-card shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-[0_0_16px_rgba(99,102,241,0.4)]">
              <Radio className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-xs font-black text-slate-800 dark:text-white tracking-tight">AI Operations Center</p>
              <p className="text-[9px] text-slate-500 font-mono">INTELFLOW ENTERPRISE · MISSION CONTROL</p>
            </div>
          </div>

          {/* System status ticker */}
          <div className="hidden md:flex items-center gap-3 ml-4 pl-4 border-l border-border">
            {[
              { label: "Agents", value: `${kpis.activeAgents} active`, color: "#6366f1" },
              { label: "Queue", value: `${queueDepth} jobs`, color: queueDepth > 0 ? "#F59E0B" : "#10B981" },
              { label: "Latency", value: `${kpis.latency}ms`, color: "#10B981" },
              { label: "Accuracy", value: `${kpis.accuracy}%`, color: "#10B981" },
              { label: "Cost today", value: `$${kpis.cost.toFixed(2)}`, color: "#F59E0B" },
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[10px] font-bold">
                <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: s.color }} />
                <span className="text-slate-500">{s.label}:</span>
                <span style={{ color: s.color }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-2 text-[10px] font-mono text-slate-500">
            <span className="text-emerald-500">●</span> ALL SYSTEMS NOMINAL
            <span className="ml-2 text-slate-600">{now} IST</span>
          </div>

          <button
            onClick={() => setIsLive(l => !l)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black border transition ${
              isLive
                ? "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400"
                : "bg-card border-border text-slate-500 dark:text-slate-400"
            }`}
          >
            {isLive ? <><span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" /> LIVE</> 
                    : <><Circle className="h-3 w-3" /> PAUSED</>}
          </button>

          <div className="text-[9px] font-mono text-slate-700 hidden sm:block">tick #{tick.toString().padStart(5,"0")}</div>
        </div>
      </div>

      {/* ══════════════ MAIN GRID ══════════════ */}
      <div className="flex-1 grid grid-cols-12 grid-rows-[auto_auto_auto_auto] gap-0 overflow-hidden">

        {/* ── ROW 1: Top KPI rail ── */}
        <div className="col-span-12 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 border-b border-border">
          {[
            { label: "Total Queries", value: kpis.queries.toLocaleString(), delta: "+1.8%",  icon: MessageSquare, color: "#6366f1", spark: Array.from({length:10},()=>rand(200,500)) },
            { label: "Tokens Used",   value: `${(kpis.tokens/1e6).toFixed(1)}M`, delta: "+12.4%", icon: Layers,       color: "#8B5CF6", spark: Array.from({length:10},()=>rand(8,15))  },
            { label: "Avg Latency",   value: `${kpis.latency}ms`, delta: "-8ms",   icon: Clock,        color: "#10B981", spark: Array.from({length:10},()=>rand(140,250)) },
            { label: "RAG Accuracy",  value: `${kpis.accuracy}%`, delta: "+0.3%",  icon: CheckCircle2, color: "#10B981", spark: Array.from({length:10},()=>rand(98,100)) },
            { label: "AI Cost",       value: `$${kpis.cost.toFixed(2)}`, delta: "-5.2%", icon: DollarSign, color: "#F59E0B", spark: Array.from({length:10},()=>rand(300,400)) },
            { label: "Active Agents", value: `${kpis.activeAgents}/6`, delta: "live",  icon: Cpu,          color: "#EC4899", spark: Array.from({length:10},()=>rand(2,6))  },
          ].map((k, i) => {
            const Icon = k.icon;
            return (
              <div key={i} className="flex items-center justify-between px-4 py-3 border-r border-border last:border-r-0 hover:bg-card-hover/30 transition">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${k.color}15` }}>
                    <div style={{ color: k.color }}><Icon className="h-3.5 w-3.5" /></div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider truncate">{k.label}</p>
                    <p className="text-sm font-black text-slate-800 dark:text-white leading-tight">{k.value}</p>
                    <p className="text-[9px] font-bold" style={{ color: k.delta.startsWith("-") && k.label !== "Avg Latency" ? "#EF4444" : "#10B981" }}>{k.delta}</p>
                  </div>
                </div>
                <Spark data={k.spark} color={k.color} h={28} />
              </div>
            );
          })}
        </div>

        {/* ── ROW 2 + 3: Main panels ── */}

        {/* LEFT: Agent Execution Panel */}
        <div className="col-span-12 lg:col-span-4 border-r border-border flex flex-col">
          <div className="px-4 py-2.5 border-b border-border flex items-center justify-between bg-card-hover/20">
            <div className="flex items-center gap-2">
              <Cpu className="h-3.5 w-3.5 text-indigo-400" />
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-350">Agent Execution</span>
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse ml-1" />
            </div>
            <span className="text-[9px] text-slate-500 font-mono">6 nodes registered</span>
          </div>

          <div className="flex-1 divide-y divide-border/40 overflow-y-auto">
            {agents.map(agent => {
              const Icon = agent.icon;
              return (
                <div key={agent.id} className="px-4 py-3 hover:bg-card-hover/30 transition group">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: `${agent.color}18`, border: `1px solid ${agent.color}30` }}>
                        <div style={{ color: agent.color }}><Icon className="h-3.5 w-3.5" /></div>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{agent.name}</p>
                        <p className="text-[9px] text-slate-400 dark:text-slate-500">{agent.role}</p>
                      </div>
                    </div>
                    <StatusBadge status={agent.state} />
                  </div>

                  {/* Current task */}
                  <p className="text-[10px] text-slate-500 mb-2 leading-relaxed pl-9 truncate">{agent.task}</p>

                  {/* Progress bar */}
                  {(agent.state === "running" || agent.state === "queued") && (
                    <div className="pl-9">
                      <div className="flex items-center justify-between mb-1">
                        <div className="h-1 flex-1 bg-slate-800 rounded-full overflow-hidden mr-2">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${agent.progress}%`,
                              background: agent.state === "queued" ? "#475569" : agent.color,
                            }}
                          />
                        </div>
                        <span className="text-[9px] font-mono text-slate-600">{agent.progress}%</span>
                      </div>
                    </div>
                  )}

                  {/* Mini metrics */}
                  <div className="flex items-center gap-3 pl-9 mt-1">
                    {agent.tokens > 0 && (
                      <span className="text-[9px] text-slate-600 font-mono">{agent.tokens.toLocaleString()} tkns</span>
                    )}
                    {agent.latency > 0 && (
                      <span className="text-[9px] text-slate-600 font-mono">{agent.latency}ms</span>
                    )}
                    <Spark data={latencySparkMap[agent.id] ?? [0]} color={agent.color} h={16} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CENTRE-LEFT: Workflow Executions + Live Charts */}
        <div className="col-span-12 lg:col-span-5 border-r border-border flex flex-col">

          {/* Workflow tracker */}
          <div className="px-4 py-2.5 border-b border-border flex items-center justify-between bg-card-hover/20">
            <div className="flex items-center gap-2">
              <GitBranch className="h-3.5 w-3.5 text-violet-500" />
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Workflow Executions</span>
            </div>
            <Link href="/workflows" className="text-[9px] text-indigo-650 dark:text-indigo-400 hover:text-indigo-500 flex items-center gap-0.5 transition font-semibold">
              View all <ChevronRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="divide-y divide-border/40">
            {workflows.map(wf => (
              <div key={wf.id} className="px-4 py-3 hover:bg-card-hover/30 transition">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <Workflow className="h-3.5 w-3.5 shrink-0" style={{ color: wfColor[wf.status] }} />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{wf.name}</span>
                  </div>
                  <StatusBadge status={wf.status} />
                </div>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${wf.progress}%`, background: wfColor[wf.status] }}
                    />
                  </div>
                  <span className="text-[9px] font-mono text-slate-500 dark:text-slate-655 w-7 text-right">{wf.progress}%</span>
                </div>
                <div className="flex items-center gap-4 text-[9px] text-slate-500 font-mono">
                  <span>Started {wf.startedAt}</span>
                  <span>ETA {wf.duration}</span>
                  <span>{wf.stepsComplete}/{wf.steps} steps</span>
                </div>
              </div>
            ))}
          </div>

          {/* Live Latency Chart */}
          <div className="border-t border-border px-4 py-2.5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Activity className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-350">Live Latency — Rolling 40s</span>
              </div>
              <span className="text-[9px] font-mono text-slate-550 dark:text-slate-500">{latencyData[latencyData.length-1]?.v ?? 0}ms</span>
            </div>
            <ResponsiveContainer width="100%" height={80}>
              <AreaChart data={latencyData} margin={{ top: 2, right: 0, left: -30, bottom: 0 }}>
                <defs>
                  <linearGradient id="latG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
                <YAxis stroke="#64748b" fontSize={8} tickLine={false} axisLine={false} tickFormatter={v => `${v}`} />
                <Tooltip
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 10 }}
                  labelFormatter={() => ""}
                  formatter={(v: any) => [`${v}ms`, "Latency"]}
                />
                <Area type="monotone" dataKey="v" name="Latency" stroke="#6366f1" strokeWidth={1.5} fill="url(#latG)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Throughput chart */}
          <div className="border-t border-border px-4 py-2.5 flex-1">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-3.5 w-3.5 text-cyan-500" />
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-350">Throughput — Queries &amp; Docs/min</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={80}>
              <LineChart data={throughputData} margin={{ top: 2, right: 0, left: -30, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
                <YAxis stroke="#64748b" fontSize={8} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 10 }}
                  labelFormatter={() => ""}
                />
                <Line type="monotone" dataKey="queries" name="Queries" stroke="#3B82F6" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="docs"    name="Docs"    stroke="#10B981" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* RIGHT: Knowledge Graph + Document Indexing */}
        <div className="col-span-12 lg:col-span-3 flex flex-col">

          {/* Knowledge Graph Mini */}
          <div className="px-4 py-2.5 border-b border-border flex items-center justify-between bg-card-hover/20">
            <div className="flex items-center gap-2">
              <Network className="h-3.5 w-3.5 text-cyan-500" />
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-350">Knowledge Graph</span>
            </div>
            <Link href="/knowledge-graph" className="text-[9px] text-indigo-650 dark:text-indigo-400 hover:text-indigo-500 flex items-center gap-0.5 transition font-semibold">
              Expand <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="px-4 py-3 border-b border-border bg-[#0a0a12]/5 dark:bg-[#0a0a12]/30">
            <KnowledgeGraphMini />
            <div className="flex items-center justify-between mt-2 text-[9px] font-mono text-slate-500 dark:text-slate-655">
              <span>14,280 vectors</span>
              <span>8 entity types</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">● synced</span>
            </div>
          </div>

          {/* Document Indexing Pipeline */}
          <div className="px-4 py-2.5 border-b border-border flex items-center justify-between bg-card-hover/20">
            <div className="flex items-center gap-2">
              <Database className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-350">Document Pipeline</span>
              {queueDepth > 0 && (
                <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded text-[8px] font-bold font-mono tracking-wide uppercase">
                  {queueDepth} QUEUED
                </span>
              )}
            </div>
            <Link href="/documents" className="text-[9px] text-indigo-650 dark:text-indigo-400 hover:text-indigo-500 flex items-center gap-0.5 transition font-semibold">
              Manage <ChevronRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="flex-1 divide-y divide-border/40 overflow-y-auto">
            {docs.map(doc => (
              <div key={doc.id} className="px-4 py-2.5 hover:bg-card-hover/30 transition">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate max-w-[140px]">{doc.name}</p>
                  <StatusBadge status={doc.status} />
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex-1 h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${doc.progress}%`,
                        background: doc.status === "done" ? "#10B981" : doc.status === "indexing" ? "#3B82F6" : "#475569",
                      }}
                    />
                  </div>
                  <span className="text-[9px] font-mono text-slate-500 dark:text-slate-655 w-6 text-right">{doc.progress}%</span>
                </div>
                <div className="flex items-center gap-3 text-[9px] text-slate-500 dark:text-slate-655 font-mono">
                  <span>{doc.size}</span>
                  {doc.status === "done" && <span>{doc.chunks} chunks</span>}
                </div>
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="border-t border-border p-3 space-y-1.5 bg-card/10">
            {[
              { label: "Open Chat Studio",    href: "/chat",           icon: MessageSquare, color: "#6366f1" },
              { label: "View Agent Studio",   href: "/agents",         icon: Shield,        color: "#8B5CF6" },
              { label: "Observatory",         href: "/observatory",    icon: Radio,         color: "#10B981" },
              { label: "Cost & Billing",      href: "/cost",           icon: DollarSign,    color: "#F59E0B" },
            ].map((a, i) => {
              const Icon = a.icon;
              return (
                <Link key={i} href={a.href}
                  className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-card-hover/40 transition group">
                  <div className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: a.color }} />
                    <span className="text-[10px] font-bold text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition">{a.label}</span>
                  </div>
                  <ArrowRight className="h-3 w-3 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-400 transition" />
                </Link>
              );
            })}
          </div>
        </div>

        {/* ── ROW 4: Terminal Log ── */}
        <div className="col-span-12 border-t border-border">
          <div className="flex items-center justify-between px-4 py-2 bg-card-hover/20 border-b border-border">
            <div className="flex items-center gap-2">
              <Terminal className="h-3.5 w-3.5 text-slate-500" />
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-455 font-mono">SYSTEM EVENT STREAM</span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <div className="flex items-center gap-4 text-[9px] font-mono">
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">● OK</span>
              <span className="text-amber-600 dark:text-amber-400 font-semibold">● WARN</span>
              <span className="text-rose-600 dark:text-rose-400 font-semibold">● ERR</span>
              <span className="text-slate-500 dark:text-slate-455">{logs.length} events</span>
            </div>
          </div>

          <div ref={logRef} className="h-28 overflow-y-auto bg-background text-foreground font-mono text-[10px] flex flex-col">
            {logs.map((l, i) => (
              <div key={l.id}
                className={`flex items-start gap-3 px-4 py-1 border-b border-border/20 ${i === 0 ? "bg-card-hover/20" : ""}`}>
                <span className="text-slate-500 dark:text-slate-455 shrink-0">{l.ts}</span>
                <span className={`shrink-0 font-black ${logColor[l.level]}`}>{logPrefix[l.level]}</span>
                <span className={`${logColor[l.level]} opacity-90`}>{l.msg}</span>
              </div>
            ))}
          </div>
        </div>

      </div>{/* end main grid */}
    </div>
  );
}
