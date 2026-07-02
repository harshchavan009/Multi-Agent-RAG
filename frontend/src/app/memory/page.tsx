"use client";

import React, { useState, useEffect } from "react";
import { apiFetch } from "@/app/utils/api";
import { useAuthStore } from "@/app/store/authStore";
import {
  Brain,
  Search,
  Trash2,
  Cpu,
  CheckCircle2,
  Calendar,
  MessageSquare,
  Briefcase,
  Sliders,
  Sparkles,
  AlertCircle,
  HelpCircle,
  Loader2,
  ArrowRight
} from "lucide-react";

interface MemoryItem {
  id: string;
  workspace_id: string;
  chat_id: string | null;
  memory_type: string;
  content: string;
  created_at: string;
  similarity?: number;
}

export default function MemoryPage() {
  const { activeWorkspaceId } = useAuthStore();
  const workspaceId = activeWorkspaceId || "8501bde6-222d-42d6-9d75-ae480447a0c0";

  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MemoryItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchMemories();
  }, [workspaceId]);

  const fetchMemories = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/memory/?workspace_id=${workspaceId}`);
      if (res.ok) {
        const data = await res.json();
        setMemories(data);
      }
    } catch (err) {
      console.error("Failed to load workspace memories", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const res = await apiFetch(`/memory/search?workspace_id=${workspaceId}&query=${encodeURIComponent(searchQuery)}&limit=5`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
      }
    } catch (err) {
      console.error("Failed to perform semantic memory lookup", err);
    } finally {
      setSearching(false);
    }
  };

  const handleCompress = async () => {
    setCompressing(true);
    setStatusMessage(null);
    try {
      const res = await apiFetch(`/memory/compress?workspace_id=${workspaceId}`, {
        method: "POST"
      });
      if (res.ok) {
        setStatusMessage({ type: "success", text: "OpenAI consolidation engine successfully consolidated facts." });
        fetchMemories();
      } else {
        const errData = await res.json();
        setStatusMessage({ type: "error", text: errData.detail || "Consolidation failed." });
      }
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Failed to trigger consolidation." });
    } finally {
      setCompressing(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this memory fact?")) return;

    try {
      const res = await apiFetch(`/memory/${id}`, { method: "DELETE" });
      if (res.ok) {
        setMemories((prev) => prev.filter((m) => m.id !== id));
        setSearchResults((prev) => prev.filter((m) => m.id !== id));
      }
    } catch (err) {
      console.error("Failed to delete memory factor", err);
    }
  };

  // Helper to resolve nice icon & colors per memory type
  const getMemoryTypeMeta = (type: string) => {
    switch (type) {
      case "conversation_summary":
        return {
          icon: MessageSquare,
          bg: "bg-indigo-500/10 border-indigo-500/20",
          text: "text-indigo-600 dark:text-indigo-400",
          label: "Chat Summary"
        };
      case "workspace_fact":
        return {
          icon: Briefcase,
          bg: "bg-emerald-500/10 border-emerald-500/20",
          text: "text-emerald-600 dark:text-emerald-400",
          label: "Workspace Constraint"
        };
      case "longterm_preference":
        return {
          icon: Sliders,
          bg: "bg-amber-500/10 border-amber-500/20",
          text: "text-amber-600 dark:text-amber-400",
          label: "User Preference"
        };
      default:
        return {
          icon: Brain,
          bg: "bg-indigo-500/10 border-indigo-500/20",
          text: "text-indigo-600 dark:text-indigo-400",
          label: "Semantic Fact"
        };
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-slate-950/20">
      {/* 1. Header Banner */}
      <header className="p-6 md:p-8 border-b border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-950 shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
                <Brain className="h-6 w-6" />
              </span>
              <h1 className="text-xl md:text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
                Agent Memory Studio
              </h1>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Manage semantic long-term preferences, workspace facts, and chat summaries used during pipeline reasoning.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleCompress}
              disabled={compressing || memories.length === 0}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-600 text-white text-xs px-4 py-2.5 rounded-xl font-bold transition shadow-sm cursor-pointer disabled:cursor-not-allowed shrink-0"
            >
              {compressing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Consolidating...</span>
                </>
              ) : (
                <>
                  <Cpu className="h-3.5 w-3.5" />
                  <span>Consolidate Memory facts</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Grid Content */}
      <main className="max-w-7xl mx-auto p-6 md:p-8 space-y-8">
        {/* Status Notification Alert */}
        {statusMessage && (
          <div className={`p-4 rounded-xl border flex items-center gap-3 animate-fade-in ${
            statusMessage.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
              : "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400"
          }`}>
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span className="text-xs font-semibold">{statusMessage.text}</span>
          </div>
        )}

        {/* 2. Semantic Search and Stats Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Stats Summary cards */}
          <div className="space-y-4">
            <h2 className="text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Memory Statistics</h2>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-900/60 p-4 rounded-2xl shadow-sm text-left">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Workspace Facts</p>
                <p className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">
                  {memories.filter((m) => m.memory_type === "workspace_fact").length}
                </p>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-900/60 p-4 rounded-2xl shadow-sm text-left">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Preferences</p>
                <p className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">
                  {memories.filter((m) => m.memory_type === "longterm_preference").length}
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-900/60 p-5 rounded-2xl shadow-sm flex items-center justify-between">
              <div className="text-left space-y-1">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Total Memories Stored</p>
                <p className="text-3xl font-black text-indigo-650 dark:text-indigo-400">{memories.length}</p>
              </div>
              <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-500">
                <Sparkles className="h-6 w-6 animate-pulse" />
              </div>
            </div>
          </div>

          {/* Interactive Semantic Search Form */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Semantic Query Lookup</h2>
            
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-900/60 p-5 rounded-2xl shadow-sm">
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search matching facts semantically (e.g. 'How does user prefer javascript outputs?')..."
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 pl-10 pr-4 py-2.5 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none text-slate-800 dark:text-slate-200"
                  />
                </div>
                <button
                  type="submit"
                  disabled={searching || !searchQuery.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition cursor-pointer"
                >
                  {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Query Vector"}
                </button>
              </form>

              {/* Semantic Query Results */}
              {searchResults.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-850 space-y-2.5 text-left">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Semantic Search Results</p>
                  <div className="space-y-2">
                    {searchResults.map((res, i) => {
                      const score = Math.round((res.similarity || 0) * 100);
                      const meta = getMemoryTypeMeta(res.memory_type);
                      const Icon = meta.icon;
                      
                      return (
                        <div key={i} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-100 dark:border-slate-900 gap-4">
                          <div className="flex items-center gap-3">
                            <span className={`p-2 rounded-lg ${meta.bg} ${meta.text}`}>
                              <Icon className="h-3.5 w-3.5" />
                            </span>
                            <span className="text-xs font-semibold text-slate-755 dark:text-slate-250 leading-snug">{res.content}</span>
                          </div>
                          
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 font-black px-2.5 py-1 rounded-full">
                              {score}% match
                            </span>
                            <button
                              onClick={() => handleDelete(res.id)}
                              className="text-slate-400 hover:text-red-500 transition cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 3. Stored Memories logs lists */}
        <div className="space-y-4">
          <h2 className="text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Workspace Memory Logs</h2>
          
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
              <p className="text-xs text-slate-400 font-bold animate-pulse">Loading active memory log database...</p>
            </div>
          ) : memories.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-900/60 p-12 rounded-2xl text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 mx-auto">
                <Brain className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-black text-slate-755 dark:text-slate-250">No Learned Memories Yet</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Chat with the Supervisor Agent. Facts, configurations, and user preferences will automatically be learned and displayed here.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {memories.map((mem) => {
                const meta = getMemoryTypeMeta(mem.memory_type);
                const Icon = meta.icon;
                
                return (
                  <div
                    key={mem.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-900/60 p-5 rounded-2xl shadow-sm flex flex-col justify-between hover:border-indigo-500/30 transition-all duration-300 gap-4 text-left relative group"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${meta.bg} ${meta.text}`}>
                          {meta.label}
                        </span>
                        
                        <button
                          onClick={() => handleDelete(mem.id)}
                          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition cursor-pointer"
                          title="Delete memory"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      
                      <p className="text-xs font-semibold text-slate-850 dark:text-slate-200 leading-relaxed pt-1">
                        {mem.content}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 pt-3 border-t border-slate-50 dark:border-slate-850/40">
                      <Calendar className="h-3 w-3" />
                      <span>{new Date(mem.created_at).toLocaleDateString()}</span>
                      {mem.chat_id && (
                        <>
                          <span className="mx-1">•</span>
                          <span className="text-indigo-500 font-medium">Chat-Specific</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
