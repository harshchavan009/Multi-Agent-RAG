"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { BrainCircuit, Play, CheckCircle, Clock, AlertCircle, Loader2, X, Download, Trash2, Globe, Database, FileText, Mail, ChevronRight, Sparkles, Search } from "lucide-react";
import { apiFetch } from "../utils/api";
import { useAuthStore } from "@/app/store/authStore";

const WORKSPACE_ID = "00000000-0000-0000-0000-000000000001";

interface ResearchTask {
  id: string;
  workspace_id: string;
  query: string;
  status: "pending" | "running" | "completed" | "failed";
  result_summary?: string;
  pdf_filename?: string;
  email_to?: string;
  created_at: string;
}

const PIPELINE_STEPS = [
  { id: "research", icon: Globe, label: "Web Research", desc: "Gathering intelligence", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  { id: "kb", icon: Database, label: "KB Search", desc: "Querying knowledge base", color: "text-indigo-400", bg: "bg-indigo-500/10 border-indigo-500/20" },
  { id: "synthesize", icon: BrainCircuit, label: "AI Synthesis", desc: "Generating report", color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20" },
  { id: "pdf", icon: FileText, label: "PDF Generation", desc: "Building document", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
  { id: "email", icon: Mail, label: "Email Delivery", desc: "Sending report", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
];

const EXAMPLE_QUERIES = [
  "Research top AI startups in India. Create comparison report.",
  "Analyze the latest trends in large language models and their enterprise applications.",
  "Compare the top RAG frameworks: LangChain, LlamaIndex, and Haystack.",
  "Research best practices for enterprise knowledge management in 2024.",
];

function PipelineVisualizer({ status, hasEmail }: { status: string; hasEmail: boolean }) {
  const activeSteps = hasEmail ? PIPELINE_STEPS : PIPELINE_STEPS.slice(0, 4);
  const isRunning = status === "running" || status === "pending";
  const isDone = status === "completed";

  return (
    <div className="flex items-start gap-1 flex-wrap">
      {activeSteps.map((step, i) => {
        const Icon = step.icon;
        const isActive = isRunning && i === Math.floor(Date.now() / 1500) % activeSteps.length;
        const isComplete = isDone;

        return (
          <React.Fragment key={step.id}>
            <div className={`flex flex-col items-center gap-1.5 min-w-[68px] transition-all ${isComplete ? "opacity-100" : isRunning && i <= Math.floor(Date.now() / 1500) % activeSteps.length ? "opacity-100" : "opacity-40"}`}>
              <div className={`h-9 w-9 rounded-xl border flex items-center justify-center transition-all ${
                isComplete ? "bg-emerald-500/20 border-emerald-500/30" :
                isActive ? `${step.bg} scale-110 shadow-lg` :
                "bg-slate-800/60 border-slate-700/60"
              }`}>
                {isComplete ? (
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                ) : isActive ? (
                  <Loader2 className={`h-4 w-4 ${step.color} animate-spin`} />
                ) : (
                  <Icon className={`h-4 w-4 ${isComplete ? "text-emerald-400" : "text-slate-500"}`} />
                )}
              </div>
              <span className={`text-[9px] font-bold text-center leading-tight ${isComplete ? "text-emerald-400" : isActive ? step.color : "text-slate-600"}`}>
                {step.label}
              </span>
            </div>
            {i < activeSteps.length - 1 && (
              <div className="flex items-center mt-3">
                <ChevronRight className={`h-4 w-4 ${isComplete ? "text-emerald-500/60" : "text-slate-700"}`} />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function ResearchPage() {
  const [query, setQuery] = useState("");
  const [emailTo, setEmailTo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [tasks, setTasks] = useState<ResearchTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<ResearchTask | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [includeEmail, setIncludeEmail] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const [tick, setTick] = useState(0);

  // Animated tick for pipeline visualizer
  useEffect(() => {
    const t = setInterval(() => setTick(p => p + 1), 800);
    return () => clearInterval(t);
  }, []);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await apiFetch(`/research/?workspace_id=${WORKSPACE_ID}`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data);
        if (selectedTask) {
          const updated = data.find((t: ResearchTask) => t.id === selectedTask.id);
          if (updated) setSelectedTask(updated);
        }
      }
    } catch (e) { console.error(e); }
  }, [selectedTask]);

  useEffect(() => {
    fetchTasks();
    pollingRef.current = setInterval(fetchTasks, 2500);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, []);

  const startResearch = async () => {
    if (!query.trim()) { setError("Please enter a research query."); return; }
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const res = await apiFetch("/research/", {
        method: "POST",
        body: JSON.stringify({
          workspace_id: WORKSPACE_ID,
          query: query.trim(),
          email_to: includeEmail && emailTo ? emailTo : null,
        })
      });

      if (res.ok) {
        const task = await res.json();
        setSuccess("Research task started! The AI agent is working...");
        setSelectedTask(task);
        setQuery("");
        fetchTasks();
      } else {
        const err = await res.json();
        setError(err.detail || "Failed to start research task");
      }
    } catch (e) {
      setError("Failed to start research. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteTask = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiFetch(`/research/${id}`, { method: "DELETE" });
      if (selectedTask?.id === id) setSelectedTask(null);
      fetchTasks();
    } catch (e) { console.error(e); }
  };

  const downloadReport = async (task: ResearchTask) => {
    if (!task.result_summary) return;
    const blob = new Blob([task.result_summary], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `research_report_${task.id.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "completed": return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
      case "running": return "text-violet-400 bg-violet-500/10 border-violet-500/20";
      case "pending": return "text-amber-400 bg-amber-500/10 border-amber-500/20";
      default: return "text-rose-400 bg-rose-500/10 border-rose-500/20";
    }
  };

  const formatDate = (dt: string) => new Date(dt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/20 p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <BrainCircuit className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">Autonomous Research Hub</h1>
            <p className="text-sm text-slate-400">Describe a research task → AI researches, synthesizes, generates PDF & emails you</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-4">
          {[
            { icon: Globe, label: "Web Research", color: "text-blue-400" },
            { icon: BrainCircuit, label: "AI Synthesis", color: "text-violet-400" },
            { icon: FileText, label: "PDF Report", color: "text-orange-400" },
            { icon: Mail, label: "Auto Email", color: "text-emerald-400" },
          ].map(({ icon: Icon, label, color }, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
              <Icon className={`h-3.5 w-3.5 ${color}`} />
              {label}
              {i < 3 && <ChevronRight className="h-3 w-3 text-slate-700" />}
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-3 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">
          <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
          <p className="text-sm text-rose-300">{error}</p>
          <button onClick={() => setError("")} className="ml-auto"><X className="h-4 w-4 text-rose-400" /></button>
        </div>
      )}
      {success && (
        <div className="mb-4 flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
          <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
          <p className="text-sm text-emerald-300">{success}</p>
          <button onClick={() => setSuccess("")} className="ml-auto"><X className="h-4 w-4 text-emerald-400" /></button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Left: Input Panel */}
        <div className="xl:col-span-2 space-y-5">
          {/* Query Input */}
          <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-5 backdrop-blur-sm">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Research Query</label>
            <textarea
              value={query}
              onChange={e => setQuery(e.target.value)}
              rows={5}
              placeholder="Research top AI startups in India. Create a comparison report and email me the findings."
              className="w-full bg-slate-800/60 border border-slate-700 text-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 resize-none placeholder-slate-600 leading-relaxed"
            />
            <p className="text-[11px] text-slate-600 mt-2">{query.length} chars · Be specific for best results</p>
          </div>

          {/* Example Queries */}
          <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-5">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Example Queries</p>
            <div className="space-y-2">
              {EXAMPLE_QUERIES.map((eq, i) => (
                <button
                  key={i}
                  onClick={() => setQuery(eq)}
                  className="w-full text-left px-3 py-2 bg-slate-800/40 hover:bg-slate-700/60 border border-slate-700/60 hover:border-emerald-500/40 rounded-xl text-xs text-slate-400 hover:text-slate-200 transition-all flex items-start gap-2"
                >
                  <Sparkles className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                  <span>{eq}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Email Option */}
          <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-5 space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => setIncludeEmail(!includeEmail)}
                className={`h-5 w-5 rounded border-2 flex items-center justify-center transition shrink-0 ${includeEmail ? "bg-emerald-500 border-emerald-500" : "border-slate-600"}`}
              >
                {includeEmail && <CheckCircle className="h-3 w-3 text-white" />}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-200">Email report when complete</p>
                <p className="text-xs text-slate-500">Requires SMTP configuration in settings</p>
              </div>
              <Mail className="h-4 w-4 text-emerald-400 ml-auto" />
            </label>
            {includeEmail && (
              <input
                type="email"
                value={emailTo}
                onChange={e => setEmailTo(e.target.value)}
                placeholder="your@email.com"
                className="w-full bg-slate-800/60 border border-slate-700 text-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 placeholder-slate-600"
              />
            )}
          </div>

          {/* Run Button */}
          <button
            onClick={startResearch}
            disabled={submitting || !query.trim()}
            className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Starting Research...</>
            ) : (
              <><Play className="h-4 w-4" /> Launch Autonomous Research</>
            )}
          </button>
        </div>

        {/* Right: Tasks + Results */}
        <div className="xl:col-span-3 space-y-5">
          {/* Task History */}
          <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl overflow-hidden backdrop-blur-sm">
            <div className="px-5 py-4 border-b border-slate-800/60 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-200">Research Tasks</h2>
              <span className="text-xs text-slate-500">{tasks.length} tasks</span>
            </div>

            {tasks.length === 0 ? (
              <div className="py-12 flex flex-col items-center gap-3">
                <Search className="h-12 w-12 text-slate-700" />
                <p className="text-sm text-slate-500">No research tasks yet. Start one above!</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/40 max-h-64 overflow-y-auto">
                {tasks.map(task => (
                  <div
                    key={task.id}
                    onClick={() => setSelectedTask(task)}
                    className={`px-5 py-4 flex items-start gap-3 hover:bg-slate-800/30 transition cursor-pointer ${selectedTask?.id === task.id ? "bg-emerald-500/5 border-l-2 border-emerald-500" : ""}`}
                  >
                    <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                      {task.status === "running" || task.status === "pending"
                        ? <Loader2 className="h-4 w-4 text-emerald-400 animate-spin" />
                        : task.status === "completed"
                        ? <CheckCircle className="h-4 w-4 text-emerald-400" />
                        : <AlertCircle className="h-4 w-4 text-rose-400" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-200 font-medium line-clamp-2">{task.query}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-slate-500">{formatDate(task.created_at)}</span>
                        {task.email_to && (
                          <>
                            <span className="text-slate-700">•</span>
                            <Mail className="h-3 w-3 text-slate-600" />
                            <span className="text-xs text-slate-500 truncate">{task.email_to}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${statusColor(task.status)}`}>
                        {task.status}
                      </span>
                      <button onClick={(e) => deleteTask(task.id, e)} className="p-1 text-slate-600 hover:text-rose-400 transition">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Selected Task Detail */}
          {selectedTask && (
            <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl overflow-hidden backdrop-blur-sm">
              <div className="px-5 py-4 border-b border-slate-800/60 flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-200">Task Details</h2>
                <div className="flex items-center gap-2">
                  {selectedTask.status === "completed" && selectedTask.result_summary && (
                    <button
                      onClick={() => downloadReport(selectedTask)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-400 text-xs font-semibold rounded-lg transition"
                    >
                      <Download className="h-3.5 w-3.5" /> Download Report
                    </button>
                  )}
                </div>
              </div>

              <div className="p-5 space-y-5">
                {/* Pipeline Visualizer */}
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Pipeline Status</p>
                  <PipelineVisualizer status={selectedTask.status} hasEmail={!!selectedTask.email_to} />
                </div>

                {/* Query */}
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Research Query</p>
                  <p className="text-sm text-slate-300 bg-slate-800/40 rounded-xl px-4 py-3 leading-relaxed">{selectedTask.query}</p>
                </div>

                {/* Result */}
                {selectedTask.result_summary && (
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Research Report</p>
                    <div className="bg-slate-800/40 rounded-xl p-4 max-h-80 overflow-y-auto">
                      <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{selectedTask.result_summary}</p>
                    </div>
                  </div>
                )}

                {(selectedTask.status === "running" || selectedTask.status === "pending") && (
                  <div className="flex items-center gap-3 bg-violet-500/10 border border-violet-500/20 rounded-xl px-4 py-3">
                    <Loader2 className="h-4 w-4 text-violet-400 animate-spin shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-violet-300">AI Agent Working...</p>
                      <p className="text-xs text-slate-500">Researching, synthesizing and generating your report</p>
                    </div>
                  </div>
                )}

                {selectedTask.status === "completed" && selectedTask.pdf_filename && (
                  <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
                    <FileText className="h-4 w-4 text-emerald-400 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-emerald-300">PDF Report Generated</p>
                      <p className="text-xs text-slate-500">{selectedTask.pdf_filename}</p>
                    </div>
                    {selectedTask.email_to && (
                      <div className="ml-auto flex items-center gap-1.5 text-xs text-emerald-400">
                        <Mail className="h-3.5 w-3.5" />
                        <span>Sent to {selectedTask.email_to}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
