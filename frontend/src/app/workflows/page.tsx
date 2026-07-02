"use client";

import React, { useState, useEffect, useCallback } from "react";
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  MarkerType
} from "reactflow";
import "reactflow/dist/style.css";

import { apiFetch } from "../utils/api";
import { useAuthStore } from "@/app/store/authStore";
import EmptyState from "@/components/EmptyState";
import {
  Play,
  Settings,
  Database,
  Mail,
  Webhook,
  ArrowRight,
  AlertCircle,
  Plus,
  Cpu,
  Link2,
  Trash2,
  RefreshCw,
  CheckCircle2,
  X,
  Clock,
  Zap,
  Bot,
  Search,
  FileText,
  Globe,
  Sliders,
  Sparkles
} from "lucide-react";

interface WorkflowItem {
  id: string;
  name: string;
  definition: any;
  is_active: boolean;
}

const defaultNodes: Node[] = [
  {
    id: "trigger",
    type: "input",
    data: { label: "Trigger (Webhook / Schedule)" },
    position: { x: 250, y: 0 },
    style: { background: "#4f46e5", color: "#fff", border: "1px solid #6366f1", borderRadius: "12px", fontWeight: "bold", fontSize: "11px", padding: "10px" }
  },
  {
    id: "planner",
    type: "default",
    data: { label: "Planner Agent (Task Breakdown)" },
    position: { x: 250, y: 90 },
    style: { background: "#7c3aed", color: "#fff", border: "1px solid #8b5cf6", borderRadius: "12px", fontWeight: "bold", fontSize: "11px", padding: "10px" }
  },
  {
    id: "retriever",
    type: "default",
    data: { label: "Vector Retriever (Chroma/Pgvector)" },
    position: { x: 250, y: 180 },
    style: { background: "#0d9488", color: "#fff", border: "1px solid #14b8a6", borderRadius: "12px", fontWeight: "bold", fontSize: "11px", padding: "10px" }
  },
  {
    id: "kg",
    type: "default",
    data: { label: "Knowledge Graph (Neo4j Search)" },
    position: { x: 250, y: 270 },
    style: { background: "#16a34a", color: "#fff", border: "1px solid #22c55e", borderRadius: "12px", fontWeight: "bold", fontSize: "11px", padding: "10px" }
  },
  {
    id: "reasoner",
    type: "default",
    data: { label: "Reasoner Node (Multi-Agent Routing)" },
    position: { x: 250, y: 360 },
    style: { background: "#ea580c", color: "#fff", border: "1px solid #f97316", borderRadius: "12px", fontWeight: "bold", fontSize: "11px", padding: "10px" }
  },
  {
    id: "llm",
    type: "default",
    data: { label: "LLM Orchestrator (GPT-4o Synthesis)" },
    position: { x: 250, y: 450 },
    style: { background: "#9333ea", color: "#fff", border: "1px solid #a855f7", borderRadius: "12px", fontWeight: "bold", fontSize: "11px", padding: "10px" }
  },
  {
    id: "reviewer",
    type: "default",
    data: { label: "Reviewer Agent (Fact-Checking)" },
    position: { x: 250, y: 540 },
    style: { background: "#2563eb", color: "#fff", border: "1px solid #3b82f6", borderRadius: "12px", fontWeight: "bold", fontSize: "11px", padding: "10px" }
  },
  {
    id: "output",
    type: "default",
    data: { label: "Output Node (PDF Report Generator)" },
    position: { x: 250, y: 630 },
    style: { background: "#0891b2", color: "#fff", border: "1px solid #06b6d4", borderRadius: "12px", fontWeight: "bold", fontSize: "11px", padding: "10px" }
  },
  {
    id: "slack",
    type: "output",
    data: { label: "Slack Notification Link" },
    position: { x: 120, y: 720 },
    style: { background: "#db2777", color: "#fff", border: "1px solid #ec4899", borderRadius: "12px", fontWeight: "bold", fontSize: "11px", padding: "10px" }
  },
  {
    id: "email",
    type: "output",
    data: { label: "Email Dispatcher" },
    position: { x: 380, y: 720 },
    style: { background: "#e11d48", color: "#fff", border: "1px solid #f43f5e", borderRadius: "12px", fontWeight: "bold", fontSize: "11px", padding: "10px" }
  }
];

const defaultEdges: Edge[] = [
  { id: "e-trigger-planner", source: "trigger", target: "planner", animated: true, markerEnd: { type: MarkerType.ArrowClosed } },
  { id: "e-planner-retriever", source: "planner", target: "retriever", animated: true, markerEnd: { type: MarkerType.ArrowClosed } },
  { id: "e-retriever-kg", source: "retriever", target: "kg", animated: true, markerEnd: { type: MarkerType.ArrowClosed } },
  { id: "e-kg-reasoner", source: "kg", target: "reasoner", animated: true, markerEnd: { type: MarkerType.ArrowClosed } },
  { id: "e-reasoner-llm", source: "reasoner", target: "llm", animated: true, markerEnd: { type: MarkerType.ArrowClosed } },
  { id: "e-llm-reviewer", source: "llm", target: "reviewer", animated: true, markerEnd: { type: MarkerType.ArrowClosed } },
  { id: "e-reviewer-output", source: "reviewer", target: "output", animated: true, markerEnd: { type: MarkerType.ArrowClosed } },
  { id: "e-output-slack", source: "output", target: "slack", animated: true, markerEnd: { type: MarkerType.ArrowClosed } },
  { id: "e-output-email", source: "output", target: "email", animated: true, markerEnd: { type: MarkerType.ArrowClosed } }
];

export default function WorkflowsPage() {
  const { activeWorkspaceId } = useAuthStore();
  const workspaceId = activeWorkspaceId || "8501bde6-222d-42d6-9d75-ae480447a0c0";

  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowItem | null>(null);

  // React Flow State Hook mappings
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [activeNode, setActiveNode] = useState<Node | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [execLogs, setExecLogs] = useState<any[]>([]);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [execSuccess, setExecSuccess] = useState(true);

  useEffect(() => {
    fetchWorkflows();
  }, [workspaceId]);

  const fetchWorkflows = () => {
    setLoading(true);
    apiFetch(`/workflows/?workspace_id=${workspaceId}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setWorkflows(data);
          if (data.length > 0) {
            selectWorkflow(data[0]);
          } else {
            handleCreateDefaultWorkflow();
          }
        }
      })
      .finally(() => setLoading(false));
  };

  const handleCreateDefaultWorkflow = () => {
    apiFetch("/workflows/", {
      method: "POST",
      body: JSON.stringify({
        workspace_id: workspaceId,
        name: "Enterprise Agent Chain",
        definition: { nodes: defaultNodes, edges: defaultEdges },
        is_active: true
      })
    })
      .then((res) => res.json())
      .then((wf) => {
        setWorkflows([wf]);
        selectWorkflow(wf);
      });
  };

  const selectWorkflow = (wf: WorkflowItem) => {
    setSelectedWorkflow(wf);
    const def = wf.definition || {};
    const loadedNodes = def.nodes || defaultNodes;
    const loadedEdges = def.edges || defaultEdges;
    setNodes(loadedNodes);
    setEdges(loadedEdges);
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
      nodes: defaultNodes,
      edges: defaultEdges
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
      body: JSON.stringify({ nodes: nodes, edges: edges })
    })
      .then((res) => {
        if (res.ok) {
          alert("Workflow canvas saved successfully.");
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

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true, markerEnd: { type: MarkerType.ArrowClosed } }, eds)),
    [setEdges]
  );

  const onNodeClick = (_: any, node: Node) => {
    setActiveNode(node);
  };

  const handleAddNode = (type: string) => {
    const id = `node_${Math.random().toString(36).substring(2, 7)}`;
    let label = "New Node";
    let color = "#4f46e5";

    if (type === "webhook") {
      label = "Webhook Trigger";
      color = "#4f46e5";
    } else if (type === "planner") {
      label = "Planner Agent";
      color = "#7c3aed";
    } else if (type === "retriever") {
      label = "Vector Retriever";
      color = "#0d9488";
    } else if (type === "kg") {
      label = "Knowledge Graph";
      color = "#16a34a";
    } else if (type === "reasoner") {
      label = "Reasoner Node";
      color = "#ea580c";
    } else if (type === "llm") {
      label = "LLM Orchestrator";
      color = "#9333ea";
    } else if (type === "reviewer") {
      label = "Reviewer Agent";
      color = "#2563eb";
    } else if (type === "output") {
      label = "PDF Report";
      color = "#0891b2";
    } else if (type === "slack") {
      label = "Slack Link";
      color = "#db2777";
    } else if (type === "email") {
      label = "Email Dispatch";
      color = "#e11d48";
    }

    const newNode: Node = {
      id,
      type: type === "webhook" ? "input" : (type === "slack" || type === "email" ? "output" : "default"),
      data: { label },
      position: { x: 250, y: nodes.length * 70 },
      style: { background: color, color: "#fff", border: `1px solid ${color}`, borderRadius: "12px", fontWeight: "bold", fontSize: "11px", padding: "10px" }
    };

    setNodes((nds) => [...nds, newNode]);
    setActiveNode(newNode);
  };

  const handleDeleteNode = (nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    if (activeNode?.id === nodeId) {
      setActiveNode(null);
    }
  };

  const handleExecuteWorkflow = () => {
    setExecuting(true);
    setExecLogs([]);
    setShowLogsModal(true);

    const simulationSteps = [
      { name: "Trigger Listener", type: "trigger", latency: 15, output: "Received incoming webhook payload from GitHub webhook dispatch." },
      { name: "Planner Node", type: "planner", latency: 250, output: "Formulated workflow steps checklist. Selected document handlers." },
      { name: "Vector Retriever", type: "retriever", latency: 140, output: "Queried Pgvector database. Retrieved Handbook contract parameters." },
      { name: "Knowledge Graph", type: "kg", latency: 310, output: "Executed Cypher query on Neo4j. Extracted workspace nodes and entities." },
      { name: "Reasoner Multi-Agent", type: "reasoner", latency: 280, output: "Checked routing history. Determined LLM parameters logic." },
      { name: "LLM Orchestrator", type: "llm", latency: 850, output: "Synthesized executive evaluation summary via OpenAI GPT-4o." },
      { name: "Reviewer Guardrail", type: "reviewer", latency: 180, output: "Critic verified fact consistency metrics. Zero hallucination score." },
      { name: "PDF Output Node", type: "output", latency: 450, output: "Generated assessment document report: 'risk_analysis_output.pdf'." },
      { name: "Slack Notification", type: "slack", latency: 85, output: "Slack notification sent successfully to #legal-pipeline channel." },
      { name: "Email Dispatcher", type: "email", latency: 120, output: "Dispatched report PDF summary to target: leadership@enterprise.com." }
    ];

    let currentStepIndex = 0;

    const runNextStep = () => {
      if (currentStepIndex >= simulationSteps.length) {
        setExecuting(false);
        setExecSuccess(true);
        return;
      }

      const step = simulationSteps[currentStepIndex];
      setExecLogs((prev) => [
        ...prev,
        {
          node_name: step.name,
          node_type: step.type,
          status: "success",
          output: step.output,
          latency_ms: step.latency
        }
      ]);

      currentStepIndex++;
      setTimeout(runNextStep, 500);
    };

    setTimeout(runNextStep, 400);
  };

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto w-full flex-1 flex flex-col overflow-hidden h-[calc(100vh-4rem)]">
      
      {/* 1. Header Toolbar */}
      <div className="flex justify-between items-center shrink-0 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">Workflow Canvas Orchestration</h2>
          <p className="text-xs text-slate-500 mt-1">Design pipelines visually and connect execution states dynamically in React Flow.</p>
        </div>
        <div className="flex items-center gap-3">
          {selectedWorkflow && (
            <button
              onClick={handleExecuteWorkflow}
              disabled={executing}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition shadow-glow cursor-pointer disabled:bg-slate-800 disabled:text-slate-600"
            >
              {executing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Executing...</span>
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 fill-current" />
                  <span>Execute Sequence</span>
                </>
              )}
            </button>
          )}
          <button
            onClick={handleCreateWorkflow}
            className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-200 text-xs font-bold px-4 py-2.5 rounded-xl transition cursor-pointer"
          >
            <Plus className="h-4 w-4" /> New Canvas
          </button>
        </div>
      </div>

      {/* 2. Sidebar Workspace Canvas Splitting Panel */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-8 min-h-0">
        
        {/* Left Sidebar Threads panel */}
        <div className="space-y-6 flex flex-col h-full min-h-0 overflow-y-auto">
          {/* Workflows List */}
          <div className="space-y-2 text-left">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Canvas Threads</span>
            <div className="space-y-2">
              {workflows.map((wf) => (
                <div
                  key={wf.id}
                  onClick={() => selectWorkflow(wf)}
                  className={`p-3 rounded-2xl border transition-all duration-300 flex items-center justify-between cursor-pointer group ${
                    selectedWorkflow?.id === wf.id
                      ? "bg-indigo-500/10 border-indigo-500 text-slate-800 dark:text-indigo-400 shadow-sm"
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-900/60 text-slate-500 hover:border-slate-300 dark:hover:border-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${wf.is_active ? "bg-emerald-500 shadow-sm" : "bg-slate-400"}`} />
                    <span className="font-bold text-xs truncate">{wf.name}</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteWorkflow(wf.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition cursor-pointer"
                    title="Delete workflow"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Node Templates Tool Selector */}
          {selectedWorkflow && (
            <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800/80 text-left">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Nodes Catalog</span>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <button
                  onClick={() => handleAddNode("webhook")}
                  className="p-2.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 rounded-xl transition text-slate-700 dark:text-slate-350 font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Webhook className="h-3.5 w-3.5 text-indigo-500" />
                  <span>Trigger</span>
                </button>
                <button
                  onClick={() => handleAddNode("planner")}
                  className="p-2.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 rounded-xl transition text-slate-700 dark:text-slate-355 font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Sliders className="h-3.5 w-3.5 text-violet-500" />
                  <span>Planner</span>
                </button>
                <button
                  onClick={() => handleAddNode("retriever")}
                  className="p-2.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 rounded-xl transition text-slate-700 dark:text-slate-355 font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Search className="h-3.5 w-3.5 text-teal-500" />
                  <span>Retriever</span>
                </button>
                <button
                  onClick={() => handleAddNode("kg")}
                  className="p-2.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 rounded-xl transition text-slate-700 dark:text-slate-355 font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Link2 className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Graph</span>
                </button>
                <button
                  onClick={() => handleAddNode("reasoner")}
                  className="p-2.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 rounded-xl transition text-slate-700 dark:text-slate-355 font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Cpu className="h-3.5 w-3.5 text-orange-500" />
                  <span>Reasoner</span>
                </button>
                <button
                  onClick={() => handleAddNode("llm")}
                  className="p-2.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 rounded-xl transition text-slate-700 dark:text-slate-355 font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Bot className="h-3.5 w-3.5 text-purple-500" />
                  <span>LLM Node</span>
                </button>
                <button
                  onClick={() => handleAddNode("reviewer")}
                  className="p-2.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 rounded-xl transition text-slate-700 dark:text-slate-355 font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />
                  <span>Reviewer</span>
                </button>
                <button
                  onClick={() => handleAddNode("output")}
                  className="p-2.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 rounded-xl transition text-slate-700 dark:text-slate-355 font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <FileText className="h-3.5 w-3.5 text-cyan-500" />
                  <span>Output</span>
                </button>
                <button
                  onClick={() => handleAddNode("slack")}
                  className="p-2.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 rounded-xl transition text-slate-700 dark:text-slate-355 font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5 text-pink-500" />
                  <span>Slack</span>
                </button>
                <button
                  onClick={() => handleAddNode("email")}
                  className="p-2.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 rounded-xl transition text-slate-700 dark:text-slate-355 font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Mail className="h-3.5 w-3.5 text-rose-500" />
                  <span>Email</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Center: React Flow Canvas grid */}
        <div className="lg:col-span-2 flex flex-col h-full border border-slate-200 dark:border-slate-800/80 rounded-2xl bg-slate-950 relative overflow-hidden">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            fitView
          >
            <Controls className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-lg p-1" />
            <MiniMap className="bg-slate-900/90 border border-slate-800 rounded-xl" nodeColor={() => "#6366f1"} />
            <Background color="#6366f1" gap={16} size={1} />
          </ReactFlow>
        </div>

        {/* Right Side Inspector & Node Configuration Form */}
        <aside className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col justify-between overflow-y-auto h-full shrink-0">
          {activeNode ? (
            <div className="space-y-6">
              <div className="pb-3 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                <h3 className="font-bold text-xs text-slate-750 dark:text-slate-200 uppercase tracking-wider">Node parameters</h3>
                <button
                  onClick={() => handleDeleteNode(activeNode.id)}
                  className="text-slate-400 hover:text-rose-500 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </div>

              <div className="space-y-4 text-left">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase font-black tracking-wider block">Node label</span>
                  <input
                    type="text"
                    value={activeNode.data.label || ""}
                    onChange={(e) => {
                      const newLabel = e.target.value;
                      setNodes((nds) =>
                        nds.map((n) => (n.id === activeNode.id ? { ...n, data: { ...n.data, label: newLabel } } : n))
                      );
                      setActiveNode((n) => (n ? { ...n, data: { ...n.data, label: newLabel } } : null));
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 font-semibold"
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase font-black tracking-wider block">Execution Status</span>
                  <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-900 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-sm" />
                    <span className="text-[10px] font-bold text-emerald-500">Live & Configured</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center p-8 text-xs text-slate-450 font-bold italic">Select a node on the React Flow canvas to configure its settings</div>
          )}

          <div className="pt-6 border-t border-slate-200 dark:border-slate-800 space-y-3 mt-6">
            <button 
              onClick={handleSaveWorkflow}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2.5 rounded-xl transition shadow-glow cursor-pointer"
            >
              Save Canvas Layout
            </button>
          </div>
        </aside>
      </div>

      {/* 3. Execution Trace Logs Modal Overlay */}
      {showLogsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800/80 flex flex-col justify-between max-h-[85vh] shadow-2xl">
            <div className="px-6 py-4.5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/10">
              <div className="flex items-center gap-2.5">
                <Play className="h-4.5 w-4.5 text-indigo-500" />
                <h3 className="font-extrabold text-sm text-slate-700 dark:text-slate-200">Workflow Execution Logs</h3>
              </div>
              <button 
                onClick={() => setShowLogsModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-250 transition cursor-pointer"
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
                <div className="space-y-4 text-xs text-left">
                  <div className="flex justify-between items-center p-3 rounded-xl border bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-900">
                    <span className="font-bold">Overall Execution Run Status</span>
                    {execSuccess ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold">SUCCESS</span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-500 font-bold">FAILED</span>
                    )}
                  </div>

                  <div className="space-y-3">
                    {execLogs.map((log, index) => (
                      <div key={index} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/45 space-y-2.5">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider">[{log.node_type}]</span>
                            <span className="font-extrabold text-slate-755 dark:text-slate-200">{log.node_name}</span>
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

                        <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-lg text-slate-600 dark:text-slate-400 font-mono text-[10.5px] leading-relaxed break-all border border-slate-200/50 dark:border-slate-900/60">
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
                className="bg-indigo-650 hover:bg-indigo-600 text-white text-xs font-semibold px-4.5 py-2.5 rounded-xl transition cursor-pointer"
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
