"use client";

import React, { useState, useEffect } from "react";
import { apiFetch } from "../utils/api";
import {
  Play,
  Settings,
  Database,
  Mail,
  Webhook,
  ArrowRight,
  AlertCircle,
  Plus,
  ZoomIn,
  ZoomOut,
  Map,
  Cpu,
  Link2,
  Trash2,
  RefreshCw,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  X
} from "lucide-react";

interface WorkflowItem {
  id: string;
  name: string;
  definition: any;
  is_active: boolean;
}

interface WorkflowNode {
  id: string;
  name: string;
  type: "webhook" | "agent" | "api" | "database";
  icon: string;
  x: number;
  y: number;
  config: Record<string, any>;
}

export default function WorkflowsPage() {
  const workspaceId = "8501bde6-222d-42d6-9d75-ae480447a0c0";

  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowItem | null>(null);
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [activeNode, setActiveNode] = useState<WorkflowNode | null>(null);
  const [zoom, setZoom] = useState(100);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [execLogs, setExecLogs] = useState<any[]>([]);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [execSuccess, setExecSuccess] = useState(true);

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const fetchWorkflows = () => {
    setLoading(true);
    apiFetch(`/workflows/?workspace_id=${workspaceId}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setWorkflows(data);
          if (data.length > 0) {
            selectWorkflow(data[0]);
          }
        }
      })
      .finally(() => setLoading(false));
  };

  const selectWorkflow = (wf: WorkflowItem) => {
    setSelectedWorkflow(wf);
    const def = wf.definition || {};
    const loadedNodes = def.nodes || [];
    setNodes(loadedNodes);
    if (loadedNodes.length > 0) {
      setActiveNode(loadedNodes[0]);
    } else {
      setActiveNode(null);
    }
  };

  const handleCreateWorkflow = () => {
    const name = prompt("Enter workflow name:");
    if (!name) return;

    const defaultDef = {
      nodes: [
        { id: "n1", name: "Doc Ingestion Trigger", type: "webhook", x: 60, y: 140, icon: "Webhook", config: { source: "Webhook" } }
      ]
    };

    apiFetch("/workflows/", {
      method: "POST",
      body: JSON.stringify({
        workspace_id: workspaceId,
        name: name,
        definition: defaultDef,
        is_active: true
      })
    })
      .then((res) => res.json())
      .then(() => fetchWorkflows());
  };

  const handleSaveWorkflow = () => {
    if (!selectedWorkflow) return;
    
    const url = `/workflows/${selectedWorkflow.id}?name=${encodeURIComponent(selectedWorkflow.name)}&is_active=${selectedWorkflow.is_active}`;
    
    apiFetch(url, {
      method: "PUT",
      body: JSON.stringify({ nodes: nodes })
    })
      .then((res) => {
        if (res.ok) {
          alert("Workflow saved to database successfully.");
          fetchWorkflows();
        } else {
          alert("Failed to save workflow changes.");
        }
      });
  };

  const handleDeleteWorkflow = (id: string) => {
    if (!confirm("Are you sure you want to delete this workflow?")) return;
    apiFetch(`/workflows/${id}`, {
      method: "DELETE"
    })
      .then(() => fetchWorkflows());
  };

  const handleAddNode = (type: "webhook" | "agent" | "api" | "database") => {
    if (!selectedWorkflow) return;

    const id = `node_${Math.random().toString(36).substring(2, 7)}`;
    let name = "New Node";
    let icon = "AlertCircle";
    let defaultConfig = {};

    if (type === "webhook") {
      name = "Webhook Trigger";
      icon = "Webhook";
      defaultConfig = { source: "http://localhost:8000/webhook" };
    } else if (type === "agent") {
      name = "AI RAG Node";
      icon = "Cpu";
      defaultConfig = { agent: "rag", prompt: "Explain row level security" };
    } else if (type === "api") {
      name = "HTTP API request";
      icon = "Mail";
      defaultConfig = { url: "https://api.github.com", method: "GET" };
    } else if (type === "database") {
      name = "SQL Statement";
      icon = "Database";
      defaultConfig = { query: "SELECT * FROM users LIMIT 3;" };
    }

    const newNode: WorkflowNode = {
      id,
      name,
      type,
      icon,
      x: 60 + nodes.length * 40,
      y: 100 + nodes.length * 30,
      config: defaultConfig
    };

    const updated = [...nodes, newNode];
    setNodes(updated);
    setActiveNode(newNode);
  };

  const handleDeleteNode = (nodeId: string) => {
    const updated = nodes.filter(n => n.id !== nodeId);
    setNodes(updated);
    if (activeNode?.id === nodeId) {
      setActiveNode(updated.length > 0 ? updated[0] : null);
    }
  };

  const isNodeValid = (node: WorkflowNode) => {
    const config = node.config || {};
    if (node.type === "webhook") {
      return !!config.source;
    }
    if (node.type === "agent") {
      return !!config.agent && !!config.prompt;
    }
    if (node.type === "api") {
      return !!config.url;
    }
    if (node.type === "database") {
      return !!config.query;
    }
    return false;
  };

  const handleExecuteWorkflow = async () => {
    if (!selectedWorkflow) return;
    
    // Validate all nodes before executing
    const invalidNodes = nodes.filter(n => !isNodeValid(n));
    if (invalidNodes.length > 0) {
      alert(`Validation error: Some nodes lack mandatory configuration parameters. (${invalidNodes.map(n => n.name).join(", ")})`);
      return;
    }

    setExecuting(true);
    setExecLogs([]);
    setShowLogsModal(true);

    try {
      const res = await apiFetch(`/workflows/${selectedWorkflow.id}/execute`, {
        method: "POST"
      });
      const data = await res.json();
      setExecLogs(data.logs || []);
      setExecSuccess(data.success);
    } catch (e: any) {
      console.error(e);
      setExecSuccess(false);
      setExecLogs([{
        node_name: "Workflow Runner",
        node_type: "engine",
        validation: "Passed",
        status: "failed",
        output: `Runner failed: ${e.message || e}`,
        latency_ms: 0
      }]);
    } finally {
      setExecuting(false);
    }
  };

  const resolveIcon = (name: string) => {
    if (name === "Webhook") return Webhook;
    if (name === "Cpu") return Cpu;
    if (name === "Database") return Database;
    if (name === "Mail") return Mail;
    return AlertCircle;
  };

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto w-full flex-1 flex flex-col overflow-hidden h-[calc(100vh-4rem)]">
      {/* 1. Header Toolbar */}
      <div className="flex justify-between items-center shrink-0 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">Workflow Orchestration</h2>
          <p className="text-xs text-slate-500 mt-1">Design pipelines connected directly to the PostgreSQL persistence layer.</p>
        </div>
        <div className="flex items-center gap-3">
          {selectedWorkflow && (
            <button
              onClick={handleExecuteWorkflow}
              disabled={executing || nodes.length === 0}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4.5 py-2.5 rounded-xl transition shadow-glow disabled:opacity-50"
            >
              <Play className="h-4 w-4" /> Run Execution
            </button>
          )}
          <button 
            onClick={handleCreateWorkflow}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4.5 py-2.5 rounded-xl transition shadow-glow"
          >
            <Plus className="h-4 w-4" /> Create Workflow
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex gap-2 items-center justify-center p-12 text-slate-400">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span className="text-xs font-bold">Querying workflow schemas...</span>
        </div>
      )}

      {/* 2. Central Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 overflow-hidden min-h-[500px]">
        {/* Left Side: Workflows list switcher and node creators */}
        <div className="glass-card rounded-2xl p-6 flex flex-col justify-between h-full overflow-y-auto shrink-0 space-y-6">
          <div className="space-y-4">
            <div>
              <h3 className="font-bold text-xs text-slate-700 dark:text-slate-200 uppercase tracking-wider">Active Workflows</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Toggle active schemas.</p>
            </div>

            <div className="space-y-3 pt-2">
              {workflows.map((wf) => (
                <div
                  key={wf.id}
                  onClick={() => selectWorkflow(wf)}
                  className={`p-4 rounded-xl border cursor-pointer transition flex justify-between items-center ${
                    selectedWorkflow?.id === wf.id
                      ? "bg-indigo-500/10 border-indigo-500/40"
                      : "bg-slate-50 dark:bg-slate-900/45 border-slate-200 dark:border-slate-800/80 hover:border-slate-300"
                  }`}
                >
                  <div className="overflow-hidden">
                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{wf.name}</h4>
                    <p className="text-[9px] text-slate-400 mt-0.5">Status: {wf.is_active ? "Live" : "Inactive"}</p>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDeleteWorkflow(wf.id); }}
                    className="p-1 rounded text-slate-400 hover:text-rose-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {selectedWorkflow && (
            <div className="space-y-3 border-t border-slate-200 dark:border-slate-800 pt-4">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Add Node to Canvas</span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  onClick={() => handleAddNode("webhook")}
                  className="p-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 rounded-xl transition text-slate-700 dark:text-slate-300 font-bold"
                >
                  + Webhook
                </button>
                <button
                  onClick={() => handleAddNode("agent")}
                  className="p-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 rounded-xl transition text-slate-700 dark:text-slate-300 font-bold"
                >
                  + AI Agent
                </button>
                <button
                  onClick={() => handleAddNode("api")}
                  className="p-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 rounded-xl transition text-slate-700 dark:text-slate-300 font-bold"
                >
                  + HTTP API
                </button>
                <button
                  onClick={() => handleAddNode("database")}
                  className="p-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 rounded-xl transition text-slate-700 dark:text-slate-300 font-bold"
                >
                  + SQL DB
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Center: Canvas grid */}
        <div className="lg:col-span-2 flex flex-col h-full border border-slate-200 dark:border-slate-800/80 rounded-2xl bg-slate-100/30 dark:bg-slate-950/20 relative overflow-hidden">
          <div className="absolute top-4 left-4 z-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1.5 flex items-center gap-1 shadow-md">
            <button onClick={() => setZoom(Math.max(50, zoom - 10))} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><ZoomOut className="h-4 w-4" /></button>
            <span className="text-[10px] font-bold text-slate-500 px-1">{zoom}%</span>
            <button onClick={() => setZoom(Math.min(150, zoom + 10))} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><ZoomIn className="h-4 w-4" /></button>
          </div>

          <div 
            style={{ transform: `scale(${zoom / 100})` }}
            className="flex-1 relative overflow-hidden bg-[radial-gradient(var(--border)_1px,transparent_1.5px)] bg-[size:24px_24px]"
          >
            {nodes.map((node, idx) => {
              const Icon = resolveIcon(node.icon);
              const isActive = activeNode?.id === node.id;
              const isValid = isNodeValid(node);
              
              return (
                <div
                  key={node.id || idx}
                  onClick={() => setActiveNode(node)}
                  style={{ left: `${node.x || 100}px`, top: `${node.y || 140}px` }}
                  className={`absolute p-4 rounded-xl border w-48 bg-white dark:bg-slate-900 shadow-sm cursor-pointer transition ${
                    isActive ? "border-indigo-500 shadow-glow" : "border-slate-200 dark:border-slate-800/80"
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold bg-indigo-500/10 text-indigo-500">{node.type}</span>
                    <div className="flex items-center gap-1.5">
                      {!isValid && (
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" title="Config missing required parameters" />
                      )}
                      <span className={`h-2.5 w-2.5 rounded-full ${isValid ? "bg-emerald-500" : "bg-amber-500"}`} />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500"><Icon className="h-4.5 w-4.5" /></div>
                    <h4 className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate">{node.name}</h4>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side Inspector & Node Configuration Form */}
        <aside className="glass-card rounded-2xl p-6 flex flex-col justify-between overflow-y-auto h-full shrink-0">
          {activeNode ? (
            <div className="space-y-6">
              <div className="pb-3 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                <h3 className="font-bold text-xs text-slate-700 dark:text-slate-200 uppercase tracking-wider">Node parameters</h3>
                <button
                  onClick={() => handleDeleteNode(activeNode.id)}
                  className="text-slate-400 hover:text-rose-500 text-xs font-semibold flex items-center gap-1"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase font-bold">Node Label</span>
                  <input
                    type="text"
                    value={activeNode.name}
                    onChange={(e) => {
                      const newNodes = nodes.map(n => n.id === activeNode.id ? { ...n, name: e.target.value } : n);
                      setNodes(newNodes);
                      setActiveNode({ ...activeNode, name: e.target.value });
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-slate-350 focus:outline-none"
                  />
                </div>

                {/* Webhook Configuration fields */}
                {activeNode.type === "webhook" && (
                  <div className="space-y-2">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Webhook Config</span>
                    <input
                      type="text"
                      placeholder="Webhook Trigger Source Name/Topic"
                      value={activeNode.config?.source || ""}
                      onChange={(e) => {
                        const newConfig = { ...activeNode.config, source: e.target.value };
                        const newNodes = nodes.map(n => n.id === activeNode.id ? { ...n, config: newConfig } : n);
                        setNodes(newNodes);
                        setActiveNode({ ...activeNode, config: newConfig });
                      }}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-slate-350 focus:outline-none"
                    />
                  </div>
                )}

                {/* AI Agent Configuration fields */}
                {activeNode.type === "agent" && (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 uppercase font-bold">Target Agent Node</span>
                      <select
                        value={activeNode.config?.agent || "rag"}
                        onChange={(e) => {
                          const newConfig = { ...activeNode.config, agent: e.target.value };
                          const newNodes = nodes.map(n => n.id === activeNode.id ? { ...n, config: newConfig } : n);
                          setNodes(newNodes);
                          setActiveNode({ ...activeNode, config: newConfig });
                        }}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-slate-350 focus:outline-none cursor-pointer"
                      >
                        <option value="supervisor">Supervisor Orchestrator</option>
                        <option value="rag">RAG Search Agent</option>
                        <option value="research">Web Research Agent</option>
                        <option value="code">Python Sandbox Agent</option>
                        <option value="analytics">Telemetry Agent</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 uppercase font-bold">Instruction Prompt</span>
                      <textarea
                        rows={3}
                        placeholder="What query or task instructions should the agent receive?"
                        value={activeNode.config?.prompt || ""}
                        onChange={(e) => {
                          const newConfig = { ...activeNode.config, prompt: e.target.value };
                          const newNodes = nodes.map(n => n.id === activeNode.id ? { ...n, config: newConfig } : n);
                          setNodes(newNodes);
                          setActiveNode({ ...activeNode, config: newConfig });
                        }}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-slate-355 resize-none focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* HTTP API Configuration fields */}
                {activeNode.type === "api" && (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 uppercase font-bold">Request Method</span>
                      <select
                        value={activeNode.config?.method || "GET"}
                        onChange={(e) => {
                          const newConfig = { ...activeNode.config, method: e.target.value };
                          const newNodes = nodes.map(n => n.id === activeNode.id ? { ...n, config: newConfig } : n);
                          setNodes(newNodes);
                          setActiveNode({ ...activeNode, config: newConfig });
                        }}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-slate-350 focus:outline-none cursor-pointer"
                      >
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                        <option value="DELETE">DELETE</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 uppercase font-bold">API Endpoint URL</span>
                      <input
                        type="text"
                        placeholder="https://api.example.com/data"
                        value={activeNode.config?.url || ""}
                        onChange={(e) => {
                          const newConfig = { ...activeNode.config, url: e.target.value };
                          const newNodes = nodes.map(n => n.id === activeNode.id ? { ...n, config: newConfig } : n);
                          setNodes(newNodes);
                          setActiveNode({ ...activeNode, config: newConfig });
                        }}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-slate-350 focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* SQL Database Query fields */}
                {activeNode.type === "database" && (
                  <div className="space-y-2">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">SQL Statement Query</span>
                    <textarea
                      rows={5}
                      placeholder="SELECT * FROM table LIMIT 3;"
                      value={activeNode.config?.query || ""}
                      onChange={(e) => {
                        const newConfig = { ...activeNode.config, query: e.target.value };
                        const newNodes = nodes.map(n => n.id === activeNode.id ? { ...n, config: newConfig } : n);
                        setNodes(newNodes);
                        setActiveNode({ ...activeNode, config: newConfig });
                      }}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-slate-355 font-mono resize-none focus:outline-none"
                    />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center p-8 text-xs text-slate-400 font-semibold">Select node to inspect</div>
          )}

          <div className="pt-6 border-t border-slate-200 dark:border-slate-800 space-y-3 mt-6">
            <button 
              onClick={handleSaveWorkflow}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold py-2.5 rounded-xl transition shadow-glow"
            >
              Save Workflow Changes
            </button>
          </div>
        </aside>
      </div>

      {/* 3. Execution Trace Logs Modal Overlay */}
      {showLogsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="glass-panel w-full max-w-2xl rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800/80 flex flex-col justify-between max-h-[85vh] shadow-2xl">
            <div className="px-6 py-4.5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/60 dark:bg-slate-900/10">
              <div className="flex items-center gap-2.5">
                <Play className="h-4.5 w-4.5 text-indigo-500" />
                <h3 className="font-extrabold text-sm text-slate-700 dark:text-slate-200">Workflow Execution logs</h3>
              </div>
              <button 
                onClick={() => setShowLogsModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {executing ? (
                <div className="flex flex-col gap-3 items-center justify-center py-12 text-slate-400">
                  <RefreshCw className="h-7 w-7 animate-spin text-indigo-500" />
                  <span className="text-xs font-bold uppercase tracking-wider animate-pulse">Running sequence executor...</span>
                </div>
              ) : (
                <div className="space-y-4 text-xs">
                  <div className="flex justify-between items-center p-3 rounded-xl border bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800">
                    <span className="font-bold">Overall Execution Run Status</span>
                    {execSuccess ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold">SUCCESS</span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-500 font-bold">FAILED</span>
                    )}
                  </div>

                  <div className="space-y-3">
                    {execLogs.map((log, index) => (
                      <div key={index} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 space-y-2.5">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">[{log.node_type}]</span>
                            <span className="font-bold text-slate-700 dark:text-slate-200">{log.node_name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-450 dark:text-slate-500 font-semibold">{log.latency_ms} ms</span>
                            {log.status === "success" ? (
                              <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            ) : (
                              <span className="h-2 w-2 rounded-full bg-rose-500" />
                            )}
                          </div>
                        </div>

                        <div className="p-3 bg-slate-50 dark:bg-slate-900/80 rounded-lg text-slate-600 dark:text-slate-400 font-mono text-[11px] leading-relaxed break-all border border-slate-200/50 dark:border-slate-800/80">
                          {log.output || "No output returned."}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/10 flex justify-end">
              <button
                onClick={() => setShowLogsModal(false)}
                className="bg-indigo-650 hover:bg-indigo-600 text-white text-xs font-semibold px-4.5 py-2.5 rounded-xl transition"
              >
                Close Trace Logs
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
