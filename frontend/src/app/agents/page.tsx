"use client";

import React, { useState, useEffect } from "react";
import { apiFetch } from "../utils/api";
import {
  Bot,
  Plus,
  ToggleLeft,
  ToggleRight,
  Settings,
  Trash2,
  Sliders,
  CheckCircle2,
  RefreshCw
} from "lucide-react";

interface AgentItem {
  id: string;
  name: string;
  role: string;
  system_prompt: string;
  model_provider: string;
  model_name: string;
  temperature: number;
  tools: string[];
}

export default function AgentStudioPage() {
  const workspaceId = "8501bde6-222d-42d6-9d75-ae480447a0c0";

  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<AgentItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"create" | "edit">("create");
  const [loading, setLoading] = useState(false);

  // Form states
  const [formName, setFormName] = useState("");
  const [formRole, setFormRole] = useState("");
  const [formPrompt, setFormPrompt] = useState("");
  const [formTemp, setFormTemp] = useState(0.7);
  const [formModel, setFormModel] = useState("openai-gpt4o");
  const [formTools, setFormTools] = useState<string[]>([]);

  // Load agents on mount
  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = () => {
    setLoading(true);
    apiFetch(`/agents/?workspace_id=${workspaceId}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setAgents(data);
        }
      })
      .finally(() => setLoading(false));
  };

  const openCreateModal = () => {
    setFormName("");
    setFormRole("");
    setFormPrompt("You are a specialized agent designed to...");
    setFormTemp(0.7);
    setFormModel("openai-gpt4o");
    setFormTools([]);
    setModalType("create");
    setIsModalOpen(true);
  };

  const openEditModal = (agent: AgentItem) => {
    setSelectedAgent(agent);
    setFormName(agent.name);
    setFormRole(agent.role);
    setFormPrompt(agent.system_prompt);
    setFormTemp(agent.temperature);
    setFormModel(agent.model_name);
    setFormTools(agent.tools || []);
    setModalType("edit");
    setIsModalOpen(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      workspace_id: workspaceId,
      name: formName || "Unnamed Agent",
      role: formRole || "Specialist Node",
      system_prompt: formPrompt,
      model_provider: "openai",
      model_name: formModel,
      temperature: formTemp,
      tools: formTools,
      memory_config: {}
    };

    if (modalType === "create") {
      apiFetch("/agents/", {
        method: "POST",
        body: JSON.stringify(payload)
      })
        .then((res) => res.json())
        .then(() => {
          fetchAgents();
          setIsModalOpen(false);
        });
    } else if (selectedAgent) {
      // Edit triggers updating values
      apiFetch(`/agents/`, {
        method: "POST", // Create endpoint serves payload sync
        body: JSON.stringify(payload)
      })
        .then(() => {
          fetchAgents();
          setIsModalOpen(false);
        });
    }
  };

  const handleDelete = (id: string) => {
    apiFetch(`/agents/${id}`, {
      method: "DELETE"
    })
      .then(() => fetchAgents());
  };

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto w-full">
      <div className="flex justify-between items-center shrink-0 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">Agent Studio</h2>
          <p className="text-xs text-slate-500 mt-1">Manage custom system agents. Data is synced in real-time to PostgreSQL.</p>
        </div>
        <button 
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4.5 py-2.5 rounded-xl transition shadow-glow"
        >
          <Plus className="h-4 w-4" /> Create Custom Agent
        </button>
      </div>

      {loading && (
        <div className="flex gap-2 items-center justify-center p-12 text-slate-400">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span className="text-xs font-bold">Querying agents configuration registry...</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {agents.map((a) => (
          <div key={a.id} className="glass-card p-6 rounded-2xl flex flex-col justify-between space-y-6">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3.5">
                <div className="h-11 w-11 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
                  <Bot className="h-5.5 w-5.5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">{a.name}</h4>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold mt-0.5">{a.role}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={() => openEditModal(a)}
                  className="p-2 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition"
                >
                  <Settings className="h-4 w-4" />
                </button>
                <button 
                  onClick={() => handleDelete(a.id)}
                  className="p-2 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-rose-500 transition"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 space-y-1 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Model Engine:</span>
                <span className="font-bold text-indigo-500">{a.model_name}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Active Tools:</span>
                <span className="font-bold text-slate-700 dark:text-slate-350">{a.tools?.length || 0} enabled</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
              <span className="flex items-center gap-1.5"><Sliders className="h-3.5 w-3.5 text-slate-400" /> Temperature: {a.temperature}</span>
              <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]"></span>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-extrabold text-base text-slate-800 dark:text-slate-100">
                {modalType === "create" ? "Configure Custom Agent" : "Modify Agent Parameters"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-900 font-bold text-sm">Close</button>
            </div>

            <form onSubmit={handleSaveForm} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Agent Name</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-700 dark:text-slate-200 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Specialist Role</label>
                  <input
                    type="text"
                    required
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-700 dark:text-slate-200 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 uppercase font-bold">System Prompt</label>
                <textarea
                  value={formPrompt}
                  onChange={(e) => setFormPrompt(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-700 dark:text-slate-200 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-slate-500 uppercase font-bold mb-1">
                  <span>Temperature</span>
                  <span className="text-indigo-500">{formTemp}</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.1"
                  value={formTemp}
                  onChange={(e) => setFormTemp(parseFloat(e.target.value))}
                  className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="bg-slate-100 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-350 text-xs font-semibold px-4.5 py-2.5 rounded-xl"
                >
                  Cancel
                </button>
                <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-5 py-2.5 rounded-xl shadow-glow">
                  Save Parameters
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
