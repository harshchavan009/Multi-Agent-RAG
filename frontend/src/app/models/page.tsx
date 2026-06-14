"use client";

import React, { useState, useEffect } from "react";
import { apiFetch } from "../utils/api";
import { Cpu, CheckCircle, Percent, Clock, Zap, Plus, Trash2, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";

interface LLMModelItem {
  id: string;
  workspace_id: string;
  name: string;
  provider: string;
  model_name: string;
  latency: string;
  cost: string;
  is_active: boolean;
}

export default function ModelsPage() {
  const workspaceId = "8501bde6-222d-42d6-9d75-ae480447a0c0";
  
  const [models, setModels] = useState<LLMModelItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  
  // Form state for creating a new model
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState("");
  const [provider, setProvider] = useState("OpenAI");
  const [modelName, setModelName] = useState("");
  const [latency, setLatency] = useState("180ms");
  const [cost, setCost] = useState("$2.00 / M");

  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = () => {
    setLoading(true);
    apiFetch(`/models/?workspace_id=${workspaceId}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setModels(data);
        }
      })
      .finally(() => setLoading(false));
  };

  const handleToggleActive = async (model: LLMModelItem) => {
    setUpdatingId(model.id);
    try {
      const res = await apiFetch(`/models/${model.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: model.name,
          provider: model.provider,
          model_name: model.model_name,
          latency: model.latency,
          cost: model.cost,
          is_active: !model.is_active
        })
      });
      if (res.ok) {
        fetchModels();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCreateModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !modelName) return;

    setLoading(true);
    try {
      const res = await apiFetch("/models/", {
        method: "POST",
        body: JSON.stringify({
          workspace_id: workspaceId,
          name,
          provider,
          model_name: modelName,
          latency,
          cost,
          is_active: true
        })
      });
      if (res.ok) {
        setName("");
        setModelName("");
        setShowAddForm(false);
        fetchModels();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteModel = async (id: string) => {
    if (!confirm("Are you sure you want to remove this model from the registry?")) return;
    setUpdatingId(id);
    try {
      const res = await apiFetch(`/models/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        fetchModels();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto w-full">
      <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">Model Registry</h2>
          <p className="text-xs text-slate-500 mt-1">Configure active LLM engines and monitor pricing telemetry.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4.5 py-2.5 rounded-xl transition shadow-glow"
          >
            <Plus className="h-4 w-4" /> Add Model Engine
          </button>
        </div>
      </div>

      {showAddForm && (
        <form onSubmit={handleCreateModel} className="glass-card p-6 rounded-2xl space-y-4 max-w-xl">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Register New LLM Engine</h3>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-slate-400">Display Name</label>
              <input
                type="text"
                placeholder="e.g. GPT-4o Mini"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-200"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-400">Provider</label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-200"
              >
                <option value="OpenAI">OpenAI</option>
                <option value="Anthropic">Anthropic</option>
                <option value="DeepSeek">DeepSeek</option>
                <option value="Gemini">Gemini</option>
                <option value="HuggingFace">HuggingFace</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-400">Model Name ID</label>
              <input
                type="text"
                placeholder="e.g. gpt-4o-mini"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-200"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-400">Latency Estimate</label>
              <input
                type="text"
                value={latency}
                onChange={(e) => setLatency(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-200"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-400">Pricing Cost (per M tokens)</label>
              <input
                type="text"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-200"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 text-xs text-slate-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold"
            >
              Register Model
            </button>
          </div>
        </form>
      )}

      {loading && (
        <div className="flex gap-2 items-center justify-center p-12 text-slate-400">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span className="text-xs font-bold">Querying Model Registry database...</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {models.map((model) => (
          <div key={model.id} className="glass-card p-6 rounded-2xl space-y-4 relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <Cpu className="h-5.5 w-5.5 text-indigo-500" />
                <div>
                  <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">{model.name}</h4>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase mt-0.5">{model.provider}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {updatingId === model.id ? (
                  <RefreshCw className="h-4 w-4 animate-spin text-slate-400" />
                ) : (
                  <>
                    <button
                      onClick={() => handleToggleActive(model)}
                      className={`text-[10px] border px-2.5 py-1 rounded-full font-bold transition ${
                        model.is_active
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-800"
                      }`}
                    >
                      {model.is_active ? "Active" : "Disabled"}
                    </button>
                    <button
                      onClick={() => handleDeleteModel(model.id)}
                      className="text-slate-400 hover:text-rose-500 p-1 rounded transition"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
              <div>
                <p className="text-[9px] text-slate-400 font-bold uppercase">Average Latency</p>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{model.latency}</span>
              </div>
              <div>
                <p className="text-[9px] text-slate-400 font-bold uppercase">Pricing Cost</p>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{model.cost}</span>
              </div>
            </div>
            <div className="text-[9px] text-slate-450 dark:text-slate-500 pt-1 font-bold">
              Model ID: {model.model_name}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
