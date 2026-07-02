"use client";

import React, { useState, useEffect } from "react";
import { apiFetch } from "../utils/api";
import { 
  Sparkles, RefreshCw, Play, Square, Plus, Trash2, 
  Layers, Settings, AlertCircle, Coins, Activity, 
  FileText, Sliders, CheckCircle2, CheckCircle, Info
} from "lucide-react";

import { useAuthStore } from "@/app/store/authStore";

interface PromptItem {
  id: string;
  workspace_id: string;
  name: string;
  version: number;
  content: string;
  is_active: boolean;
  created_at: string;
}

interface LLMModelItem {
  id: string;
  name: string;
  provider: string;
  model_name: string;
  is_active: boolean;
}

interface ExperimentItem {
  id: string;
  workspace_id: string;
  name: string;
  status: string; // 'draft', 'active', 'ended'
  model_a: string;
  model_b: string;
  prompt_a_id: string | null;
  prompt_b_id: string | null;
  traffic_split_a: number;
  created_at: string;
}

interface VariantMetrics {
  calls: number;
  avg_latency_ms: number;
  total_tokens: number;
  total_cost_usd: number;
  groundedness: number;
  faithfulness: number;
  hallucination: number;
}

interface ExperimentMetricsResponse {
  variant_a: VariantMetrics;
  variant_b: VariantMetrics;
}

export default function LLMOpsPage() {
  const { activeWorkspaceId } = useAuthStore();
  const workspaceId = activeWorkspaceId || "8501bde6-222d-42d6-9d75-ae480447a0c0";
  
  const [activeTab, setActiveTab] = useState<"prompts" | "experiments" | "metrics">("prompts");
  
  // Data States
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [models, setModels] = useState<LLMModelItem[]>([]);
  const [experiments, setExperiments] = useState<ExperimentItem[]>([]);
  const [selectedExperiment, setSelectedExperiment] = useState<ExperimentItem | null>(null);
  const [metrics, setMetrics] = useState<ExperimentMetricsResponse | null>(null);
  
  // Status/Loading States
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  
  // Form States (New Prompt)
  const [showAddPrompt, setShowAddPrompt] = useState(false);
  const [promptName, setPromptName] = useState("");
  const [promptContent, setPromptContent] = useState("");
  const [promptIsActive, setPromptIsActive] = useState(true);
  
  // Form States (New Experiment)
  const [showAddExperiment, setShowAddExperiment] = useState(false);
  const [expName, setExpName] = useState("");
  const [expModelA, setExpModelA] = useState("");
  const [expModelB, setExpModelB] = useState("");
  const [expPromptA, setExpPromptA] = useState("");
  const [expPromptB, setExpPromptB] = useState("");
  const [expTrafficSplit, setExpTrafficSplit] = useState(50); // % for Variant A

  useEffect(() => {
    fetchPrompts();
    fetchModels();
    fetchExperiments();
  }, [workspaceId]);

  useEffect(() => {
    if (selectedExperiment) {
      fetchExperimentMetrics(selectedExperiment.id);
    } else {
      setMetrics(null);
    }
  }, [selectedExperiment]);

  // Fetch functions
  const fetchPrompts = () => {
    setLoading(true);
    apiFetch(`/llmops/prompts?workspace_id=${workspaceId}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setPrompts(data);
      })
      .finally(() => setLoading(false));
  };

  const fetchModels = () => {
    apiFetch(`/models/?workspace_id=${workspaceId}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setModels(data.filter(m => m.is_active));
        }
      });
  };

  const fetchExperiments = () => {
    apiFetch(`/llmops/experiments?workspace_id=${workspaceId}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setExperiments(data);
          // Set first active or latest experiment as default selection
          const active = data.find(e => e.status === "active") || data[0];
          if (active) setSelectedExperiment(active);
        }
      });
  };

  const fetchExperimentMetrics = (id: string) => {
    apiFetch(`/llmops/experiments/${id}/metrics`)
      .then((res) => res.json())
      .then((data) => {
        if (data && data.variant_a) {
          setMetrics(data);
        }
      });
  };

  // Sync prompts from Langfuse
  const handleSyncLangfuse = async () => {
    setSyncing(true);
    try {
      const res = await apiFetch(`/llmops/prompts/sync?workspace_id=${workspaceId}`, {
        method: "POST"
      });
      const data = await res.json();
      if (data.success) {
        alert(`Successfully synced prompts from Langfuse Registry! Synced: ${data.synced.join(", ")}`);
        fetchPrompts();
      } else {
        alert(`Langfuse sync failed: ${data.message || data.errors.join(", ")}. Using offline templates.`);
        fetchPrompts();
      }
    } catch (err) {
      console.error(err);
      alert("Error invoking Langfuse sync. Running in local fallback mode.");
      fetchPrompts();
    } finally {
      setSyncing(false);
    }
  };

  // Create Prompt Version
  const handleCreatePrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptName || !promptContent) return;
    
    setLoading(true);
    try {
      const res = await apiFetch("/llmops/prompts", {
        method: "POST",
        body: JSON.stringify({
          workspace_id: workspaceId,
          name: promptName,
          content: promptContent,
          is_active: promptIsActive
        })
      });
      if (res.ok) {
        setPromptContent("");
        setShowAddPrompt(false);
        fetchPrompts();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Activate prompt version
  const handleActivatePrompt = async (name: string, version: number) => {
    setActionLoadingId(`${name}-${version}`);
    try {
      const res = await apiFetch(`/llmops/prompts/${name}/activate?workspace_id=${workspaceId}&version=${version}`, {
        method: "POST"
      });
      if (res.ok) {
        fetchPrompts();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Delete prompt version
  const handleDeletePrompt = async (name: string, version: number) => {
    if (!confirm(`Are you sure you want to delete ${name} v${version}?`)) return;
    setActionLoadingId(`del-${name}-${version}`);
    try {
      const res = await apiFetch(`/llmops/prompts/${name}/version/${version}?workspace_id=${workspaceId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        fetchPrompts();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Create Experiment
  const handleCreateExperiment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expName || !expModelA || !expModelB) return;
    
    setLoading(true);
    try {
      const res = await apiFetch("/llmops/experiments", {
        method: "POST",
        body: JSON.stringify({
          workspace_id: workspaceId,
          name: expName,
          model_a: expModelA,
          model_b: expModelB,
          prompt_a_id: expPromptA || null,
          prompt_b_id: expPromptB || null,
          traffic_split_a: Number(expTrafficSplit) / 100
        })
      });
      if (res.ok) {
        setExpName("");
        setShowAddExperiment(false);
        fetchExperiments();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Toggle Experiment Status
  const handleToggleExperimentStatus = async (exp: ExperimentItem, targetStatus: string) => {
    setActionLoadingId(exp.id);
    try {
      const res = await apiFetch(`/llmops/experiments/${exp.id}`, {
        method: "PUT",
        body: JSON.stringify({
          workspace_id: workspaceId,
          name: exp.name,
          status: targetStatus,
          model_a: exp.model_a,
          model_b: exp.model_b,
          prompt_a_id: exp.prompt_a_id,
          prompt_b_id: exp.prompt_b_id,
          traffic_split_a: exp.traffic_split_a
        })
      });
      if (res.ok) {
        fetchExperiments();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Delete Experiment
  const handleDeleteExperiment = async (id: string) => {
    if (!confirm("Remove this experiment configuration?")) return;
    setActionLoadingId(`del-${id}`);
    try {
      const res = await apiFetch(`/llmops/experiments/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        fetchExperiments();
        if (selectedExperiment?.id === id) setSelectedExperiment(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto w-full">
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-indigo-500" />
            LLMOps Dashboard
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Prompt versioning, Langfuse integration, model comparisons, and A/B test experiments.
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncLangfuse}
            disabled={syncing}
            className="flex items-center gap-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-850 px-4 py-2.5 rounded-xl text-xs font-semibold transition"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin text-indigo-500" : "text-slate-500"}`} />
            Sync Langfuse Registry
          </button>
        </div>
      </div>

      {/* Tabs list */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6 text-sm font-semibold">
        <button
          onClick={() => setActiveTab("prompts")}
          className={`pb-3 border-b-2 transition ${
            activeTab === "prompts" 
              ? "border-indigo-500 text-indigo-600 dark:text-indigo-400" 
              : "border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-700"
          }`}
        >
          Prompt Registry
        </button>
        <button
          onClick={() => setActiveTab("experiments")}
          className={`pb-3 border-b-2 transition ${
            activeTab === "experiments" 
              ? "border-indigo-500 text-indigo-600 dark:text-indigo-400" 
              : "border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-700"
          }`}
        >
          A/B Testing Config
        </button>
        <button
          onClick={() => setActiveTab("metrics")}
          className={`pb-3 border-b-2 transition ${
            activeTab === "metrics" 
              ? "border-indigo-500 text-indigo-600 dark:text-indigo-400" 
              : "border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-700"
          }`}
        >
          Variant Performance Metrics
        </button>
      </div>

      {/* 1. PROMPT REGISTRY TAB */}
      {activeTab === "prompts" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold text-slate-700 dark:text-slate-200">System Prompt Registry</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500">Manage template definitions cached locally and synced with Langfuse.</p>
            </div>
            <button
              onClick={() => setShowAddPrompt(!showAddPrompt)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition shadow-glow"
            >
              <Plus className="h-4 w-4" /> New Version
            </button>
          </div>

          {showAddPrompt && (
            <form onSubmit={handleCreatePrompt} className="glass-card p-6 rounded-2xl space-y-4 max-w-2xl border border-slate-200 dark:border-slate-800">
              <h4 className="text-sm font-bold text-slate-750 dark:text-slate-200">Create New Prompt Template Version</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-slate-400 uppercase">Prompt Key/Name</label>
                  <select
                    value={promptName}
                    onChange={(e) => setPromptName(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 font-semibold text-slate-700 dark:text-slate-200"
                  >
                    <option value="">Select Prompt Name...</option>
                    <option value="rag_synthesis">rag_synthesis (RAG Node Synthesis)</option>
                    <option value="kg_translation">kg_translation (Knowledge Graph Cypher Translation)</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="isActiveCheckbox"
                    checked={promptIsActive}
                    onChange={(e) => setPromptIsActive(e.target.checked)}
                    className="h-4 w-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                  />
                  <label htmlFor="isActiveCheckbox" className="text-xs font-bold text-slate-500">Set Immediately Active</label>
                </div>
              </div>
              <div className="space-y-1 text-xs">
                <label className="font-bold text-slate-400 uppercase">System Prompt Content</label>
                <textarea
                  placeholder="Enter system prompt instruction template..."
                  value={promptContent}
                  onChange={(e) => setPromptContent(e.target.value)}
                  rows={6}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 font-mono text-slate-700 dark:text-slate-200"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2 text-xs">
                <button
                  type="button"
                  onClick={() => setShowAddPrompt(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-500 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold"
                >
                  Save Version
                </button>
              </div>
            </form>
          )}

          {loading && (
            <div className="flex gap-2 items-center justify-center p-12 text-slate-400">
              <RefreshCw className="h-5 w-5 animate-spin text-indigo-500" />
              <span className="text-xs font-bold">Querying Prompts DB...</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6">
            {/* Group prompts by name */}
            {Array.from(new Set(prompts.map(p => p.name))).map((name) => {
              const versions = prompts.filter(p => p.name === name);
              const activePrompt = versions.find(v => v.is_active);
              
              return (
                <div key={name} className="glass-card rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <div className="p-6 bg-slate-50/50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-700 dark:text-slate-250 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-indigo-400" />
                        {name}
                      </h4>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Active version: {activePrompt ? `v${activePrompt.version}` : "None"}</p>
                    </div>
                  </div>

                  <div className="p-6 space-y-4">
                    {/* Active Prompt display */}
                    {activePrompt && (
                      <div className="bg-slate-100/60 dark:bg-slate-950/50 rounded-xl p-4 border border-slate-250/20 dark:border-slate-850 font-mono text-[11px] leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap text-slate-600 dark:text-slate-350">
                        {activePrompt.content}
                      </div>
                    )}

                    {/* Versions table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                            <th className="py-2">Revision</th>
                            <th className="py-2">Created At</th>
                            <th className="py-2">Snippet</th>
                            <th className="py-2 text-right">Status / Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {versions.map((ver) => (
                            <tr key={ver.id} className="border-b border-slate-100 dark:border-slate-850/40 hover:bg-slate-50/40 dark:hover:bg-slate-900/10">
                              <td className="py-3 font-extrabold text-slate-700 dark:text-slate-350">v{ver.version}</td>
                              <td className="py-3 text-slate-400 dark:text-slate-500">{new Date(ver.created_at).toLocaleString()}</td>
                              <td className="py-3 text-slate-550 dark:text-slate-400 truncate max-w-xs font-mono text-[10px]">
                                {ver.content.slice(0, 60)}...
                              </td>
                              <td className="py-3 text-right flex justify-end items-center gap-3">
                                {ver.is_active ? (
                                  <span className="flex items-center gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded border border-emerald-550/20 font-bold text-[10px]">
                                    <CheckCircle className="h-3 w-3" /> Active
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => handleActivatePrompt(ver.name, ver.version)}
                                    disabled={actionLoadingId === `${ver.name}-${ver.version}`}
                                    className="border border-slate-200 dark:border-slate-800 hover:bg-indigo-600 hover:text-white px-2.5 py-1 rounded text-[10px] font-bold transition flex items-center gap-1"
                                  >
                                    {actionLoadingId === `${ver.name}-${ver.version}` ? (
                                      <RefreshCw className="h-3 w-3 animate-spin text-slate-400" />
                                    ) : (
                                      "Activate"
                                    )}
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeletePrompt(ver.name, ver.version)}
                                  disabled={actionLoadingId === `del-${ver.name}-${ver.version}`}
                                  className="text-slate-405 hover:text-rose-500 transition p-1"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. A/B TESTING EXPERIMENTS CONFIG */}
      {activeTab === "experiments" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold text-slate-700 dark:text-slate-200">A/B Testing Experiments</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500">Configure experiments to route queries across models and prompt variations.</p>
            </div>
            <button
              onClick={() => setShowAddExperiment(!showAddExperiment)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition shadow-glow"
            >
              <Plus className="h-4 w-4" /> New Experiment
            </button>
          </div>

          {showAddExperiment && (
            <form onSubmit={handleCreateExperiment} className="glass-card p-6 rounded-2xl space-y-4 max-w-2xl border border-slate-200 dark:border-slate-800">
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">Create New A/B Experiment</h4>
              
              <div className="space-y-1 text-xs">
                <label className="font-bold text-slate-400 uppercase">Experiment Name</label>
                <input
                  type="text"
                  placeholder="e.g. GPT-4o vs Claude RAG Synthesis Synthesis Study"
                  value={expName}
                  onChange={(e) => setExpName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-slate-750 dark:text-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                {/* Model A */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-400 uppercase">Variant A Model Engine</label>
                  <select
                    value={expModelA}
                    onChange={(e) => setExpModelA(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 font-semibold text-slate-700 dark:text-slate-200"
                  >
                    <option value="">Select Engine...</option>
                    {models.map(m => (
                      <option key={m.id} value={m.model_name}>{m.name} ({m.model_name})</option>
                    ))}
                  </select>
                </div>
                
                {/* Model B */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-400 uppercase">Variant B Model Engine</label>
                  <select
                    value={expModelB}
                    onChange={(e) => setExpModelB(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 font-semibold text-slate-700 dark:text-slate-200"
                  >
                    <option value="">Select Engine...</option>
                    {models.map(m => (
                      <option key={m.id} value={m.model_name}>{m.name} ({m.model_name})</option>
                    ))}
                  </select>
                </div>

                {/* Prompt A */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-400 uppercase">Variant A Prompt Revision</label>
                  <select
                    value={expPromptA}
                    onChange={(e) => setExpPromptA(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 font-semibold text-slate-700 dark:text-slate-200"
                  >
                    <option value="">Use Workspace Active Prompt</option>
                    {prompts.map(p => (
                      <option key={p.id} value={p.id}>{p.name} v{p.version}</option>
                    ))}
                  </select>
                </div>

                {/* Prompt B */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-400 uppercase">Variant B Prompt Revision</label>
                  <select
                    value={expPromptB}
                    onChange={(e) => setExpPromptB(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 font-semibold text-slate-700 dark:text-slate-200"
                  >
                    <option value="">Use Workspace Active Prompt</option>
                    {prompts.map(p => (
                      <option key={p.id} value={p.id}>{p.name} v{p.version}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Split Slider */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between font-bold">
                  <span className="text-slate-450 uppercase">Traffic Routing Splits</span>
                  <span className="text-indigo-550 dark:text-indigo-400">Variant A: {expTrafficSplit}% | Variant B: {100 - expTrafficSplit}%</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[10px] font-bold text-slate-400">Variant A</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={expTrafficSplit}
                    onChange={(e) => setExpTrafficSplit(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 dark:bg-slate-850 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                  <span className="text-[10px] font-bold text-slate-400">Variant B</span>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2 text-xs">
                <button
                  type="button"
                  onClick={() => setShowAddExperiment(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-500 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold"
                >
                  Build Experiment
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {experiments.map((exp) => (
              <div key={exp.id} className="glass-card p-6 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-start">
                    <h4 className="font-extrabold text-sm text-slate-700 dark:text-slate-250">{exp.name}</h4>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[9px] font-bold uppercase border px-2 py-0.5 rounded-full ${
                        exp.status === "active"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                          : exp.status === "ended"
                            ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                            : "bg-slate-100 dark:bg-slate-850 text-slate-450 border-slate-200 dark:border-slate-800"
                      }`}>
                        {exp.status}
                      </span>
                      <button
                        onClick={() => handleDeleteExperiment(exp.id)}
                        className="text-slate-400 hover:text-rose-500 transition p-0.5"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-150 dark:border-slate-850 text-xs">
                    <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Variant A ({(exp.traffic_split_a * 100).toFixed(0)}%)</p>
                      <p className="font-bold text-slate-700 dark:text-slate-300 mt-0.5 truncate">{exp.model_a}</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                        {exp.prompt_a_id ? `Custom Prompt ID` : "Active prompt"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Variant B ({((1 - exp.traffic_split_a) * 100).toFixed(0)}%)</p>
                      <p className="font-bold text-slate-700 dark:text-slate-300 mt-0.5 truncate">{exp.model_b}</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                        {exp.prompt_b_id ? `Custom Prompt ID` : "Active prompt"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <button
                    onClick={() => {
                      setSelectedExperiment(exp);
                      setActiveTab("metrics");
                    }}
                    className="text-indigo-600 dark:text-indigo-400 hover:underline text-xs font-bold flex items-center gap-1"
                  >
                    <Activity className="h-3.5 w-3.5" /> Compare Analytics
                  </button>
                  
                  {exp.status === "active" ? (
                    <button
                      onClick={() => handleToggleExperimentStatus(exp, "ended")}
                      disabled={actionLoadingId === exp.id}
                      className="flex items-center gap-1.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 px-3.5 py-1.5 rounded-xl text-xs font-bold hover:bg-rose-500 hover:text-white transition"
                    >
                      <Square className="h-3.5 w-3.5" /> End Run
                    </button>
                  ) : (
                    <button
                      onClick={() => handleToggleExperimentStatus(exp, "active")}
                      disabled={actionLoadingId === exp.id}
                      className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-550/20 px-3.5 py-1.5 rounded-xl text-xs font-bold hover:bg-emerald-500 hover:text-white transition shadow-glow"
                    >
                      <Play className="h-3.5 w-3.5" /> Activate Study
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. PERFORMANCE METRICS COMPARISONS */}
      {activeTab === "metrics" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold text-slate-700 dark:text-slate-200 font-bold flex items-center gap-2">
                <Activity className="h-5 w-5 text-indigo-500" />
                Variant Performance Observability
              </h3>
              <p className="text-xs text-slate-400 dark:text-slate-500">Compare metrics side-by-side between Variant A and Variant B in real-time.</p>
            </div>
            
            {/* Select study dropdown */}
            <div className="flex items-center gap-2 text-xs font-bold">
              <span className="text-slate-400 uppercase">Selected Study:</span>
              <select
                value={selectedExperiment?.id || ""}
                onChange={(e) => {
                  const target = experiments.find(x => x.id === e.target.value);
                  if (target) setSelectedExperiment(target);
                }}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-750 dark:text-slate-250 font-bold"
              >
                <option value="">No Experiment Selected...</option>
                {experiments.map(e => (
                  <option key={e.id} value={e.id}>{e.name} ({e.status})</option>
                ))}
              </select>
            </div>
          </div>

          {!selectedExperiment ? (
            <div className="glass-card p-12 text-center rounded-2xl space-y-3 text-slate-400">
              <Info className="h-8 w-8 text-indigo-400 mx-auto" />
              <h4 className="text-sm font-bold text-slate-600 dark:text-slate-300">No active experiment found</h4>
              <p className="text-xs max-w-sm mx-auto">Please create and run an experiment under the A/B Testing Config tab, then select it above to view live metrics comparisons.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Telemetry Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-xs">
                <div className="glass-card p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <span className="font-bold text-slate-400 uppercase">Total Runs / Calls</span>
                  <div className="flex justify-between items-baseline pt-1">
                    <span className="text-lg font-extrabold text-slate-700 dark:text-slate-200">
                      {metrics ? metrics.variant_a.calls + metrics.variant_b.calls : 0} runs
                    </span>
                    <span className="text-[10px] text-slate-400">
                      A: {metrics?.variant_a.calls} | B: {metrics?.variant_b.calls}
                    </span>
                  </div>
                </div>
                
                <div className="glass-card p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <span className="font-bold text-slate-400 uppercase">Average Latency</span>
                  <div className="flex justify-between items-baseline pt-1">
                    <span className="text-lg font-extrabold text-slate-700 dark:text-slate-200">
                      {metrics ? Math.round((metrics.variant_a.avg_latency_ms + metrics.variant_b.avg_latency_ms) / 2) : 0} ms
                    </span>
                    <span className="text-[10px] text-indigo-500">
                      A: {metrics?.variant_a.avg_latency_ms}ms | B: {metrics?.variant_b.avg_latency_ms}ms
                    </span>
                  </div>
                </div>

                <div className="glass-card p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <span className="font-bold text-slate-400 uppercase flex items-center gap-1">
                    <Coins className="h-4 w-4 text-emerald-500" />
                    Total Cost (USD)
                  </span>
                  <div className="flex justify-between items-baseline pt-1">
                    <span className="text-lg font-extrabold text-slate-700 dark:text-slate-200">
                      ${metrics ? (metrics.variant_a.total_cost_usd + metrics.variant_b.total_cost_usd).toFixed(4) : "0.00"}
                    </span>
                    <span className="text-[10px] text-emerald-550">
                      A: ${metrics?.variant_a.total_cost_usd.toFixed(4)} | B: ${metrics?.variant_b.total_cost_usd.toFixed(4)}
                    </span>
                  </div>
                </div>

                <div className="glass-card p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <span className="font-bold text-slate-400 uppercase flex items-center gap-1">
                    <Sliders className="h-4 w-4 text-indigo-500" />
                    Variant Split
                  </span>
                  <div className="flex justify-between items-baseline pt-1">
                    <span className="text-lg font-extrabold text-slate-700 dark:text-slate-200">
                      {(selectedExperiment.traffic_split_a * 100).toFixed(0)}% / {((1 - selectedExperiment.traffic_split_a) * 100).toFixed(0)}%
                    </span>
                    <span className="text-[10px] text-slate-450">Variant A Split Ratio</span>
                  </div>
                </div>
              </div>

              {/* Variant A vs B detailed cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Variant A */}
                <div className="glass-card p-6 rounded-2xl border border-indigo-500/20 dark:border-indigo-550/20 bg-indigo-500/[0.01] relative overflow-hidden">
                  <div className="absolute top-0 right-0 bg-indigo-500 text-white font-extrabold px-4 py-1 text-[10px] rounded-bl-xl uppercase tracking-wider">
                    Variant A ({(selectedExperiment.traffic_split_a * 100).toFixed(0)}%)
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-700 dark:text-slate-200">Engine / Prompt Setup</h4>
                      <p className="text-xs text-slate-450 dark:text-slate-450 font-bold mt-1 uppercase">{selectedExperiment.model_a}</p>
                    </div>

                    <hr className="border-slate-150 dark:border-slate-850" />

                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl">
                        <p className="text-[9px] text-slate-400 font-bold uppercase">Average Latency</p>
                        <span className="text-base font-extrabold text-slate-750 dark:text-slate-205">{metrics?.variant_a.avg_latency_ms || 0} ms</span>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl">
                        <p className="text-[9px] text-slate-400 font-bold uppercase">Accumulated Tokens</p>
                        <span className="text-base font-extrabold text-slate-750 dark:text-slate-205">{metrics?.variant_a.total_tokens || 0}</span>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl">
                        <p className="text-[9px] text-slate-400 font-bold uppercase">Accumulated Cost</p>
                        <span className="text-base font-extrabold text-slate-750 dark:text-slate-205">${metrics?.variant_a.total_cost_usd.toFixed(5) || "0.00"}</span>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl">
                        <p className="text-[9px] text-slate-400 font-bold uppercase">Total calls</p>
                        <span className="text-base font-extrabold text-slate-750 dark:text-slate-205">{metrics?.variant_a.calls || 0} queries</span>
                      </div>
                    </div>

                    <hr className="border-slate-150 dark:border-slate-850" />

                    {/* LLM Metrics */}
                    <div className="space-y-3">
                      <h4 className="font-extrabold text-xs text-slate-700 dark:text-slate-200 uppercase tracking-wider">Evaluation Scores</h4>
                      <div className="space-y-2.5 text-xs">
                        <div>
                          <div className="flex justify-between font-bold text-slate-450 text-[10px] uppercase mb-1">
                            <span>Groundedness (Factual accuracy)</span>
                            <span className="text-slate-700 dark:text-slate-350">{metrics ? (metrics.variant_a.groundedness * 100).toFixed(1) : "0"}%</span>
                          </div>
                          <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5">
                            <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${(metrics?.variant_a.groundedness || 0) * 100}%` }}></div>
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between font-bold text-slate-450 text-[10px] uppercase mb-1">
                            <span>Faithfulness (Answer intent matches)</span>
                            <span className="text-slate-700 dark:text-slate-350">{metrics ? (metrics.variant_a.faithfulness * 100).toFixed(1) : "0"}%</span>
                          </div>
                          <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5">
                            <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${(metrics?.variant_a.faithfulness || 0) * 100}%` }}></div>
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between font-bold text-slate-450 text-[10px] uppercase mb-1">
                            <span>Hallucination Index</span>
                            <span className="text-slate-700 dark:text-slate-350">{metrics ? (metrics.variant_a.hallucination * 100).toFixed(1) : "0"}%</span>
                          </div>
                          <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5">
                            <div className="bg-rose-500 h-1.5 rounded-full" style={{ width: `${(metrics?.variant_a.hallucination || 0) * 100}%` }}></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Variant B */}
                <div className="glass-card p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/10 dark:bg-slate-900/10 relative overflow-hidden">
                  <div className="absolute top-0 right-0 bg-slate-500 dark:bg-slate-800 text-white font-extrabold px-4 py-1 text-[10px] rounded-bl-xl uppercase tracking-wider">
                    Variant B ({((1 - selectedExperiment.traffic_split_a) * 100).toFixed(0)}%)
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-700 dark:text-slate-200">Engine / Prompt Setup</h4>
                      <p className="text-xs text-slate-455 dark:text-slate-450 font-bold mt-1 uppercase">{selectedExperiment.model_b}</p>
                    </div>

                    <hr className="border-slate-150 dark:border-slate-850" />

                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl">
                        <p className="text-[9px] text-slate-400 font-bold uppercase">Average Latency</p>
                        <span className="text-base font-extrabold text-slate-750 dark:text-slate-205">{metrics?.variant_b.avg_latency_ms || 0} ms</span>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl">
                        <p className="text-[9px] text-slate-400 font-bold uppercase">Accumulated Tokens</p>
                        <span className="text-base font-extrabold text-slate-750 dark:text-slate-205">{metrics?.variant_b.total_tokens || 0}</span>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl">
                        <p className="text-[9px] text-slate-400 font-bold uppercase">Accumulated Cost</p>
                        <span className="text-base font-extrabold text-slate-750 dark:text-slate-205">${metrics?.variant_b.total_cost_usd.toFixed(5) || "0.00"}</span>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl">
                        <p className="text-[9px] text-slate-400 font-bold uppercase">Total calls</p>
                        <span className="text-base font-extrabold text-slate-750 dark:text-slate-205">{metrics?.variant_b.calls || 0} queries</span>
                      </div>
                    </div>

                    <hr className="border-slate-150 dark:border-slate-850" />

                    {/* LLM Metrics */}
                    <div className="space-y-3">
                      <h4 className="font-extrabold text-xs text-slate-700 dark:text-slate-200 uppercase tracking-wider">Evaluation Scores</h4>
                      <div className="space-y-2.5 text-xs">
                        <div>
                          <div className="flex justify-between font-bold text-slate-450 text-[10px] uppercase mb-1">
                            <span>Groundedness (Factual accuracy)</span>
                            <span className="text-slate-700 dark:text-slate-350">{metrics ? (metrics.variant_b.groundedness * 100).toFixed(1) : "0"}%</span>
                          </div>
                          <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5">
                            <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${(metrics?.variant_b.groundedness || 0) * 100}%` }}></div>
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between font-bold text-slate-450 text-[10px] uppercase mb-1">
                            <span>Faithfulness (Answer intent matches)</span>
                            <span className="text-slate-700 dark:text-slate-350">{metrics ? (metrics.variant_b.faithfulness * 100).toFixed(1) : "0"}%</span>
                          </div>
                          <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5">
                            <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${(metrics?.variant_b.faithfulness || 0) * 100}%` }}></div>
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between font-bold text-slate-450 text-[10px] uppercase mb-1">
                            <span>Hallucination Index</span>
                            <span className="text-slate-700 dark:text-slate-350">{metrics ? (metrics.variant_b.hallucination * 100).toFixed(1) : "0"}%</span>
                          </div>
                          <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5">
                            <div className="bg-rose-500 h-1.5 rounded-full" style={{ width: `${(metrics?.variant_b.hallucination || 0) * 100}%` }}></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
