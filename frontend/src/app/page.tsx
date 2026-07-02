"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { 
  ArrowRight, 
  BrainCircuit, 
  Network, 
  Shield, 
  Sparkles, 
  Database, 
  FileText, 
  CheckCircle2, 
  ChevronRight, 
  Terminal,
  User,
  Bot,
  Play,
  Cpu,
  Lock,
  AlertTriangle,
  Zap,
  HelpCircle
} from "lucide-react";
import { useAuthStore } from "@/app/store/authStore";
import BrandLogo from "../components/BrandLogo";

// Predefined sandbox threads for visitors to play with
const SANDBOX_DEMOS = [
  {
    tab: "Financial Risk",
    icon: Database,
    query: "Extract Q2 financial liabilities from SEC filings and verify compliance risk factors.",
    steps: [
      { name: "Ingesting SEC PDF filings (sales_q2_2024.pdf)", status: "done" },
      { name: "RAG Agent: Querying Qdrant vectors for semantic matching", status: "done" },
      { name: "Compliance Agent: Verifying values against internal risk frameworks", status: "done" },
      { name: "Supervisor Orchestrator: Synthesizing grounded balance summary", status: "running" }
    ],
    response: "IntelFlow analyzed 14 liabilities clauses in your sales_q2_2024 filings. Identified **$4.2M** in structured maturity liabilities. Grounding score is **99.2%** with zero compliance policy deviations detected."
  },
  {
    tab: "Employee Audit",
    icon: Shield,
    query: "Audit employee handbook leave regulations against state-level regulations.",
    steps: [
      { name: "Retrieving state employment clauses (State_FMLA_v2.docx)", status: "done" },
      { name: "OCR text segmentation on legal contract images", status: "done" },
      { name: "Supervisor: Cross-referencing FMLA compliance regulations", status: "done" },
      { name: "Generating audit validation report output PDF", status: "done" }
    ],
    response: "State regulation mismatch detected: Handbook section **3.4 (Maternity leave)** has a compliance latency. IntelFlow generated a revised policy clause ensuring **100%** alignment with updated FMLA rules."
  },
  {
    tab: "Automated Research",
    icon: BrainCircuit,
    query: "Map recent ArXiv breakthroughs in RAG architectures to model pipelines.",
    steps: [
      { name: "Crawling ArXiv search engine API for 'Agentic RAG' publications", status: "done" },
      { name: "Extracting metadata citation graphs and embedding vectors", status: "done" },
      { name: "DeepSeek-R1 Agent: Analyzing chain-of-thought methodologies", status: "done" },
      { name: "Neo4j Knowledge Graph: Committing new semantic entity nodes", status: "done" }
    ],
    response: "Retrieved **4 recent papers** mapping Self-RAG and Corrective-RAG improvements. Linked **18 new node relationships** in your Neo4j entity graph model. Recommended: deploy text-embedding-3-large pipeline."
  }
];

export default function LandingPage() {
  const { accessToken } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  
  // Interactive Sandbox state
  const [activeDemoIdx, setActiveDemoIdx] = useState(0);
  const [sandboxSteps, setSandboxSteps] = useState<any[]>([]);
  const [sandboxResponse, setSandboxResponse] = useState("");
  const [sandboxResponseVisible, setSandboxResponseVisible] = useState(false);
  const [sandboxRunning, setSandboxRunning] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Trigger simulated chatbot response animation
  const triggerSandboxSim = (idx: number) => {
    setActiveDemoIdx(idx);
    setSandboxRunning(true);
    setSandboxResponseVisible(false);
    setSandboxResponse("");
    
    const demo = SANDBOX_DEMOS[idx];
    setSandboxSteps(demo.steps.map(s => ({ ...s, status: s.status === "running" ? "running" : "done" })));

    // Simulating thinking loop
    const t1 = setTimeout(() => {
      // Complete all steps
      setSandboxSteps(prev => prev.map(s => ({ ...s, status: "done" })));
      
      // Reveal message
      let charIdx = 0;
      setSandboxResponseVisible(true);
      const text = demo.response;
      
      const interval = setInterval(() => {
        setSandboxResponse(prev => prev + text.charAt(charIdx));
        charIdx++;
        if (charIdx >= text.length) {
          clearInterval(interval);
          setSandboxRunning(false);
        }
      }, 15);

      return () => clearInterval(interval);
    }, 1800);

    return () => clearTimeout(t1);
  };

  useEffect(() => {
    if (mounted) {
      triggerSandboxSim(0);
    }
  }, [mounted]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 overflow-hidden relative selection:bg-indigo-500/30">
      
      {/* Background Effects */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 -left-1/4 w-[150%] h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/30 via-slate-950/80 to-slate-950"></div>
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-3/4 h-3/4 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-cyan-900/10 via-transparent to-transparent blur-3xl"></div>
        
        {/* Animated Grid overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f46e50b_1px,transparent_1px),linear-gradient(to_bottom,#4f46e50b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>
      </div>

      {/* Navigation */}
      <nav className="relative z-50 flex items-center justify-between px-6 py-4 max-w-7xl mx-auto border-b border-white/5 backdrop-blur-md bg-slate-950/20">
        <BrandLogo size="lg" lightText={true} />
        <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-350">
          <a href="#features" className="hover:text-white transition">Features</a>
          <a href="#sandbox" className="hover:text-white transition">Interactive Sandbox</a>
          <a href="#architecture" className="hover:text-white transition">RAG Topology</a>
        </div>
        <div>
          {mounted && accessToken ? (
            <Link href="/dashboard" className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-white text-sm font-bold transition backdrop-blur-md flex items-center gap-1.5 shadow-sm">
              Go to Dashboard <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <div className="flex items-center gap-3">
              <Link href="/login" className="px-4 py-2 text-slate-300 hover:text-white text-sm font-bold transition">
                Sign In
              </Link>
              <Link href="/register" className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition shadow-[0_0_20px_rgba(99,102,241,0.4)]">
                Get Started
              </Link>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 flex flex-col items-center text-center px-4 pt-20 pb-16 max-w-5xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold mb-8 animate-fade-in-up">
          <Sparkles className="h-3.5 w-3.5 text-indigo-400 animate-pulse" />
          <span>IntelFlow Multi-Agent OS is Now Available</span>
        </div>
        
        <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-[1.1] mb-6">
          Enterprise Multi-Agent <br className="hidden md:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-cyan-400 to-emerald-400">
            Intelligence Operating System
          </span>
        </h1>
        
        <p className="text-lg md:text-xl text-slate-400 max-w-3xl mx-auto mb-10 leading-relaxed">
          Transform legal filings, workspace guidelines, database clusters, and web research into autonomous AI agent pipelines. Safe, compliant, and integrated.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Link href="/register" className="w-full sm:w-auto px-8 py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-all shadow-[0_0_30px_rgba(99,102,241,0.4)] hover:scale-[1.01] flex items-center justify-center gap-2 cursor-pointer">
            Deploy Free Node <ArrowRight className="h-4 w-4" />
          </Link>
          <a href="#sandbox" className="w-full sm:w-auto px-8 py-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 backdrop-blur-md hover:scale-[1.01] cursor-pointer">
            Explore Demo Sandbox
          </a>
        </div>

        {/* Brand Metrics Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 w-full max-w-4xl mt-16 p-6 rounded-2xl border border-white/5 bg-slate-900/40 backdrop-blur-sm">
          {[
            { metric: "1.4s", label: "Average Response SLA" },
            { metric: "99.9%", label: "Compliance Redaction" },
            { metric: "3M+", label: "Daily Vector Indices" },
            { metric: "24+", label: "Data Source Integrations" },
          ].map((item, idx) => (
            <div key={idx} className="space-y-1">
              <p className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-350">{item.metric}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">{item.label}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Section 1: Interactive Sandbox Playground */}
      <section id="sandbox" className="relative z-10 py-16 px-6 max-w-7xl mx-auto border-t border-white/5">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl font-black tracking-tight text-white">Interactive Sandbox</h2>
          <p className="text-sm text-slate-400 mt-2">Interact with the Orchestrator workspace. Watch legal RAG operations and agent chains execute live.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Controls list (Left side) */}
          <div className="lg:col-span-4 flex flex-col justify-center space-y-3.5">
            {SANDBOX_DEMOS.map((demo, idx) => {
              const Icon = demo.icon;
              const isActive = activeDemoIdx === idx;
              return (
                <button
                  key={idx}
                  onClick={() => triggerSandboxSim(idx)}
                  disabled={sandboxRunning}
                  className={`p-5 rounded-2xl border transition text-left cursor-pointer flex items-start gap-4 ${
                    isActive
                      ? "bg-indigo-500/10 border-indigo-500/30 text-white shadow-glow"
                      : "bg-slate-900/40 border-white/5 text-slate-400 hover:border-white/10 hover:text-white"
                  } disabled:opacity-50`}
                >
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isActive ? "bg-indigo-500/20 text-indigo-400" : "bg-slate-800 text-slate-500"
                  }`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-200">{demo.tab} Demo</h3>
                    <p className="text-[11px] text-slate-400 mt-1 truncate max-w-[200px]">{demo.query}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Interactive Chat Console (Right side) */}
          <div className="lg:col-span-8 border border-white/10 bg-slate-900/40 backdrop-blur-2xl rounded-3xl overflow-hidden flex flex-col min-h-[400px] shadow-2xl relative">
            
            {/* Header controls overlay */}
            <div className="px-5 py-3.5 bg-slate-950/60 border-b border-white/5 flex justify-between items-center text-xs">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-indigo-400 animate-pulse" />
                <span className="font-mono text-slate-400 uppercase tracking-widest text-[10px] font-black">SUPERVISOR OS LOGS</span>
              </div>
              <div className="flex items-center gap-2 font-mono text-[10px] text-slate-500">
                <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                <span>STATUS: NOMINAL</span>
              </div>
            </div>

            {/* Sandbox Chat Content Area */}
            <div className="p-6 flex-1 flex flex-col space-y-6 overflow-y-auto">
              
              {/* User request */}
              <div className="flex justify-end gap-3 items-start">
                <div className="bg-indigo-600 px-4 py-3 rounded-2xl rounded-br-none text-xs leading-relaxed max-w-md shadow-lg">
                  {SANDBOX_DEMOS[activeDemoIdx].query}
                </div>
                <div className="h-8 w-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 text-slate-400" />
                </div>
              </div>

              {/* Agent execution path timeline */}
              <div className="bg-slate-950/50 border border-white/5 rounded-2xl p-4 space-y-3">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <Cpu className="h-3 w-3 text-indigo-400" /> Supervisor Agent Chain Execution
                </p>
                
                <div className="space-y-2 pt-2 border-t border-white/5">
                  {sandboxSteps.map((step, sIdx) => {
                    const isRunning = step.status === "running";
                    return (
                      <div key={sIdx} className="flex items-center gap-2.5 text-[11px] text-slate-350">
                        {step.status === "done" ? (
                          <div className="h-4 w-4 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 text-[9px] font-black shrink-0">
                            ✓
                          </div>
                        ) : isRunning ? (
                          <div className="h-4 w-4 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
                            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-ping"></span>
                          </div>
                        ) : (
                          <div className="h-4 w-4 rounded-full bg-slate-800 border border-white/5 flex items-center justify-center text-slate-600 text-[9px] shrink-0">
                            ○
                          </div>
                        )}
                        <span className={`${isRunning ? "text-indigo-400 font-bold animate-pulse" : "text-slate-400"}`}>
                          {step.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* AI output result */}
              {sandboxResponseVisible && (
                <div className="flex justify-start gap-3 items-start animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="bg-slate-950/60 border border-white/5 p-4 rounded-2xl rounded-bl-none text-xs leading-relaxed text-slate-200 max-w-lg">
                    {sandboxResponse || <span className="inline-block h-3 w-1 bg-indigo-400 animate-pulse" />}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Premium RAG Topology Ingestion Flow */}
      <section id="architecture" className="relative z-10 py-16 px-6 max-w-7xl mx-auto border-t border-white/5">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl font-black tracking-tight text-white">Ingestion Flow Topology</h2>
          <p className="text-sm text-slate-400 mt-2">How IntelFlow processes raw document shards, parses text hierarchies, indexes vectors into Qdrant, and runs LLM synthesis.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Animated SVG schema */}
          <div className="aspect-video relative rounded-3xl border border-white/10 bg-slate-900/50 backdrop-blur-2xl shadow-2xl overflow-hidden flex items-center justify-center">
            <svg viewBox="0 0 500 250" className="w-full h-full p-4" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="glowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>
                <filter id="svgGlow" x="-25%" y="-25%" width="150%" height="150%">
                  <feGaussianBlur stdDeviation="3.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Connections (Path traces) */}
              <g stroke="rgba(99, 102, 241, 0.15)" strokeWidth="2" fill="none">
                <path d="M 80 125 L 180 125" />
                <path d="M 180 125 L 280 75" />
                <path d="M 180 125 L 280 175" />
                <path d="M 280 75 L 420 125" />
                <path d="M 280 175 L 420 125" />
              </g>

              {/* Moving data packets */}
              <circle r="3" fill="#6366f1" filter="url(#svgGlow)">
                <animateMotion dur="2.8s" repeatCount="indefinite" path="M 80 125 L 180 125" />
              </circle>
              <circle r="3" fill="#06b6d4" filter="url(#svgGlow)">
                <animateMotion dur="3.5s" repeatCount="indefinite" path="M 180 125 L 280 75" />
              </circle>
              <circle r="3" fill="#a855f7" filter="url(#svgGlow)">
                <animateMotion dur="3.1s" repeatCount="indefinite" path="M 180 125 L 280 175" />
              </circle>

              {/* Nodes */}
              {/* Document Source */}
              <g transform="translate(40, 105)">
                <rect x="0" y="0" width="80" height="40" rx="8" fill="#1e1b4b" stroke="#6366f1" strokeWidth="1.5" />
                <text x="40" y="24" fill="#c7d2fe" fontSize="8" fontWeight="bold" textAnchor="middle">RAW DOCS</text>
              </g>

              {/* Vector Sharder */}
              <g transform="translate(140, 105)">
                <rect x="0" y="0" width="80" height="40" rx="8" fill="#0c1d2e" stroke="#0891b2" strokeWidth="1.5" />
                <text x="40" y="24" fill="#a5f3fc" fontSize="8" fontWeight="bold" textAnchor="middle">TEXT SPLITTER</text>
              </g>

              {/* VectorDB Qdrant */}
              <g transform="translate(240, 55)">
                <rect x="0" y="0" width="80" height="40" rx="8" fill="#1b2a1a" stroke="#10b981" strokeWidth="1.5" />
                <text x="40" y="24" fill="#a7f3d0" fontSize="8" fontWeight="bold" textAnchor="middle">QDRANT VECTORS</text>
              </g>

              {/* PostgreSQL Metastore */}
              <g transform="translate(240, 155)">
                <rect x="0" y="0" width="80" height="40" rx="8" fill="#2c1a30" stroke="#a855f7" strokeWidth="1.5" />
                <text x="40" y="24" fill="#f3e8ff" fontSize="8" fontWeight="bold" textAnchor="middle">POSTGRES DB</text>
              </g>

              {/* LLM Synthesis Router */}
              <g transform="translate(380, 105)">
                <rect x="0" y="0" width="80" height="40" rx="8" fill="#300d1d" stroke="#f43f5e" strokeWidth="1.5" />
                <text x="40" y="24" fill="#ffe4e6" fontSize="8" fontWeight="bold" textAnchor="middle">SUPERVISOR OS</text>
              </g>
            </svg>
          </div>

          {/* Description list */}
          <div className="space-y-6 text-left">
            <div className="flex gap-4">
              <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">1. Hierarchy Parsing & Layout Splitting</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Documents uploaded to collections are decomposed using intelligent markdown segmentation, formatting titles, tables, and page headers.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">2. Vector Search Retrieval & Context Mapping</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Fast embedding matches populate Qdrant vector databases in less than 40ms, mapping key references back to PostgreSQL metadata anchors.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="h-10 w-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">3. Supervisor Orchestration & Compliance Redactions</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  A supervisor agent coordinates task routing. Redaction models scan for PII, financial leaks, or hallucinated claims before releasing responses.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Premium Features Grid */}
      <section id="features" className="relative z-10 py-16 px-6 max-w-7xl mx-auto border-t border-white/5">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl font-black tracking-tight text-white font-sans">Enterprise Platform Highlights</h2>
          <p className="text-sm text-slate-400 mt-2">All features are designed to integrate seamlessly into compliance pipelines, custom model clusters, and enterprise workspaces.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              title: "Autonomous Agent Orchestrator",
              desc: "Supervisor model maps complex natural language inputs into parallel RAG lookups, sandbox executions, and auditing verification tasks.",
              icon: BrainCircuit,
              color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20"
            },
            {
              title: "Multi-Source File Ingestion",
              desc: "Extract text hierarchies, layouts, OCR image text, and tables from PDFs, DOCX, XLSX, and audio streams in real-time.",
              icon: Database,
              color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20"
            },
            {
              title: "Real-Time Guardrails & Redaction",
              desc: "Identify and obscure security threats, PII patterns, and proprietary data using real-time local compliance scanners.",
              icon: Shield,
              color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
            },
            {
              title: "Langflow Visual Canvas",
              desc: "Design logic nodes and triggers directly on a visual mapping board connected to manual, webhook, or cron database scheduler pipelines.",
              icon: Network,
              color: "text-violet-400 bg-violet-500/10 border-violet-500/20"
            },
            {
              title: "LLMOps & Model Registry",
              desc: "Dynamically register API endpoints, local open-source models, or enterprise weights under a secure, access-controlled proxy catalog.",
              icon: Sparkles,
              color: "text-amber-400 bg-amber-500/10 border-amber-500/20"
            },
            {
              title: "Live Observatory Telemetry",
              desc: "Track rolling SLA latency statistics, token counts, cost today, grounding scores, and celery task queues from one screen.",
              icon: Terminal,
              color: "text-rose-400 bg-rose-500/10 border-rose-500/20"
            }
          ].map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <div 
                key={idx}
                className="glass-card rounded-2xl p-6 border border-white/5 hover:border-white/10 bg-slate-900/30 flex flex-col justify-between space-y-4 hover:translate-y-[-2px] transition duration-300"
              >
                <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 border ${feat.color.split(" ").slice(1).join(" ")}`}>
                  <Icon className={`h-5 w-5 ${feat.color.split(" ")[0]}`} />
                </div>
                <div className="space-y-1.5 text-left">
                  <h3 className="text-sm font-bold text-slate-100">{feat.title}</h3>
                  <p className="text-xs text-slate-450 dark:text-slate-400 leading-relaxed font-semibold">{feat.desc}</p>
                </div>
                <div className="pt-2 text-left">
                  <span className="text-[10px] text-indigo-400 font-bold hover:text-indigo-300 transition flex items-center gap-1 cursor-pointer">
                    Read Documentation <ChevronRight className="h-3 w-3" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA Bottom Banner */}
      <section className="relative z-10 py-24 px-6 max-w-5xl mx-auto text-center">
        <div className="absolute -inset-10 bg-gradient-to-r from-indigo-500/10 via-cyan-500/10 to-purple-500/10 blur-3xl rounded-[3rem] opacity-60 -z-10" />
        
        <div className="space-y-6">
          <h2 className="text-4xl md:text-5xl font-black tracking-tight text-white leading-tight">
            Deploy IntelFlow in Your <br /> Secure Environment Today
          </h2>
          <p className="text-sm text-slate-400 max-w-xl mx-auto leading-relaxed">
            Take full control of document partitioning, vector databases, and multi-agent loops. Compliant with HIPAA, GDPR, and enterprise security frameworks.
          </p>
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register" className="px-8 py-3.5 rounded-xl bg-white text-slate-950 font-bold text-xs hover:bg-slate-100 transition shadow-lg shadow-white/5 cursor-pointer">
              Create Enterprise Account
            </Link>
            <button className="px-8 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-xs hover:bg-white/10 transition cursor-pointer">
              Speak to AI Architects
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-10 border-t border-white/5 px-6 max-w-7xl mx-auto text-xs text-slate-500 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded bg-gradient-to-tr from-indigo-600 to-cyan-400 flex items-center justify-center text-white font-bold text-[10px]">
            I
          </div>
          <span className="font-bold text-slate-400">IntelFlow OS</span>
        </div>
        <p className="font-semibold text-center sm:text-left">© 2026 IntelFlow Systems Inc. All rights reserved. Registered under standard corporate policies.</p>
      </footer>
    </div>
  );
}
