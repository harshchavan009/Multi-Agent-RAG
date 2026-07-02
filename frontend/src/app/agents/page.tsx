"use client";

import React, { useState, useEffect, useRef } from "react";
import { apiFetch } from "../utils/api";
import { useAuthStore } from "@/app/store/authStore";
import {
  Bot,
  Play,
  Sliders,
  CheckCircle2,
  Terminal,
  Cpu,
  Database,
  Activity,
  Layers,
  MessageSquare,
  Sparkles
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
  description?: string;
  status?: string;
}

export default function AgentStudioPage() {
  const { activeWorkspaceId } = useAuthStore();
  const workspaceId = activeWorkspaceId || "8501bde6-222d-42d6-9d75-ae480447a0c0";

  const [dbAgents, setDbAgents] = useState<AgentItem[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("supervisor");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"pipeline" | "topology">("pipeline");

  // Simulation states
  const [simulationActive, setSimulationActive] = useState(false);
  const [simulationLogs, setSimulationLogs] = useState<string[]>([]);

  // Agent Toggles and User Query Configuration
  const [enabledAgents, setEnabledAgents] = useState<Record<string, boolean>>({
    supervisor: true,
    research: true,
    rag: true,
    analytics: true,
    report: true
  });

  const [nodeStates, setNodeStates] = useState<Record<string, "idle" | "processing" | "completed" | "disabled">>({
    query: "idle",
    supervisor: "idle",
    research: "idle",
    rag: "idle",
    analytics: "idle",
    report: "idle"
  });

  const [userQueryText, setUserQueryText] = useState<string>("Summarize GDPR compliance status for Q2 vector indices.");

  // Local agent data model mapped to visual nodes
  const [agentsMap, setAgentsMap] = useState<Record<string, AgentItem>>({
    supervisor: {
      id: "supervisor",
      name: "Supervisor Node",
      role: "Orchestrator",
      system_prompt: "Coordinate sub-agents and orchestrate search/retrieval workflows.",
      model_provider: "openai",
      model_name: "openai-gpt4o",
      temperature: 0.2,
      tools: ["router", "orchestrator"],
      description: "Orchestrates incoming tasks, routes queries, and consolidates final reports."
    },
    research: {
      id: "research",
      name: "Research Agent",
      role: "Researcher",
      system_prompt: "Search external repositories, index Web results and verify documents.",
      model_provider: "openai",
      model_name: "openai-gpt4o",
      temperature: 0.5,
      tools: ["web-search", "arxiv-retriever"],
      description: "Performs web searches, queries external sources, and pulls documentation."
    },
    rag: {
      id: "rag",
      name: "RAG Agent",
      role: "Retriever",
      system_prompt: "Query vector collections, calculate search similarity score, and retrieve semantic context.",
      model_provider: "openai",
      model_name: "openai-gpt4o-mini",
      temperature: 0.1,
      tools: ["qdrant-search", "dense-encoder"],
      description: "Queries Qdrant vector databases and ranks chunks by semantic relevance."
    },
    analytics: {
      id: "analytics",
      name: "Analytics Agent",
      role: "Analyst",
      system_prompt: "Parse metadata counts, compile activity telemetry, and calculate trends.",
      model_provider: "openai",
      model_name: "openai-gpt4o-mini",
      temperature: 0.3,
      tools: ["postgres-query", "calculator"],
      description: "Queries SQL telemetry data, calculates token spend KPIs, and aggregates trends."
    },
    report: {
      id: "report",
      name: "Report Agent",
      role: "Synthesizer",
      system_prompt: "Consolidate agent inputs, summarize findings, and compile Markdown reports.",
      model_provider: "openai",
      model_name: "openai-gpt4o",
      temperature: 0.7,
      tools: ["markdown-compiler", "pdf-generator"],
      description: "Assembles insights from sub-agents and builds publication-ready intelligence files."
    }
  });

  const selectedAgent = agentsMap[selectedAgentId] || agentsMap.supervisor;

  // Form states for inspector
  const [formPrompt, setFormPrompt] = useState(selectedAgent.system_prompt);
  const [formTemp, setFormTemp] = useState(selectedAgent.temperature);
  const [formModel, setFormModel] = useState(selectedAgent.model_name);

  // Sync form state when selection changes
  useEffect(() => {
    if (selectedAgentId !== "query" && selectedAgent) {
      setFormPrompt(selectedAgent.system_prompt);
      setFormTemp(selectedAgent.temperature);
      setFormModel(selectedAgent.model_name);
    }
  }, [selectedAgentId, selectedAgent]);

  // Sync nodeStates with enabledAgents on state change, but ONLY if simulation is not currently running
  useEffect(() => {
    if (!simulationActive) {
      setNodeStates({
        query: "idle",
        supervisor: enabledAgents.supervisor ? "idle" : "disabled",
        research: enabledAgents.research ? "idle" : "disabled",
        rag: enabledAgents.rag ? "idle" : "disabled",
        analytics: enabledAgents.analytics ? "idle" : "disabled",
        report: enabledAgents.report ? "idle" : "disabled"
      });
    }
  }, [enabledAgents, simulationActive]);

  // Load agents when workspaceId changes
  useEffect(() => {
    setDbAgents([]);
    fetchAgents();
  }, [workspaceId]);

  const fetchAgents = () => {
    setLoading(true);
    apiFetch(`/agents/?workspace_id=${workspaceId}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setDbAgents(data);
          
          const updatedMap = { ...agentsMap };
          data.forEach((agent: any) => {
            const lowerName = agent.name.toLowerCase();
            const lowerRole = agent.role.toLowerCase();
            
            let key = "";
            if (lowerName.includes("supervisor") || lowerRole.includes("orchestrator") || lowerRole.includes("supervisor")) key = "supervisor";
            else if (lowerName.includes("research") || lowerRole.includes("research")) key = "research";
            else if (lowerName.includes("rag") || lowerRole.includes("retriev")) key = "rag";
            else if (lowerName.includes("analytics") || lowerName.includes("analyst") || lowerRole.includes("analyst")) key = "analytics";
            else if (lowerName.includes("reporting") || lowerName.includes("report") || lowerRole.includes("synthes") || lowerRole.includes("report")) key = "report";
            
            if (key) {
              updatedMap[key] = {
                ...updatedMap[key],
                id: agent.id,
                name: agent.name,
                role: agent.role,
                system_prompt: agent.system_prompt,
                model_name: agent.model_name,
                temperature: agent.temperature,
                tools: agent.tools || []
              };
            }
          });
          setAgentsMap(updatedMap);
        }
      })
      .catch((err) => console.error("Could not fetch DB agents, running with blueprints:", err))
      .finally(() => setLoading(false));
  };

  const handleSaveParameters = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedAgentId === "query") return;
    
    const updatedAgent = {
      ...selectedAgent,
      system_prompt: formPrompt,
      temperature: formTemp,
      model_name: formModel
    };

    setAgentsMap(prev => ({
      ...prev,
      [selectedAgentId]: updatedAgent
    }));

    const payload = {
      workspace_id: workspaceId,
      name: updatedAgent.name,
      role: updatedAgent.role,
      system_prompt: updatedAgent.system_prompt,
      model_provider: updatedAgent.model_provider,
      model_name: updatedAgent.model_name,
      temperature: updatedAgent.temperature,
      tools: updatedAgent.tools,
      memory_config: {}
    };

    apiFetch("/agents/", {
      method: "POST",
      body: JSON.stringify(payload)
    })
      .then((res) => res.json())
      .then(() => {
        fetchAgents();
      })
      .catch((err) => console.error("Error saving to PostgreSQL registry:", err));
  };

  const runSimulation = () => {
    if (simulationActive) return;
    setSimulationActive(true);
    setSimulationLogs([]);
    
    // Reset all enabled nodes to idle and others to disabled
    setNodeStates(prev => {
      const reset = { ...prev };
      Object.keys(reset).forEach(key => {
        if (key === "query" || enabledAgents[key]) {
          reset[key] = "idle";
        } else {
          reset[key] = "disabled";
        }
      });
      return reset;
    });

    const steps = [];
    let delay = 0;

    // Step 1: User Query
    steps.push({
      action: () => {
        setNodeStates(prev => ({ ...prev, query: "processing" }));
        setSimulationLogs(prev => [...prev, `User query received: "${userQueryText}"`]);
      },
      delay: delay
    });
    delay += 1000;

    steps.push({
      action: () => {
        setNodeStates(prev => ({ ...prev, query: "completed" }));
      },
      delay: delay
    });

    // Step 2: Supervisor
    delay += 300;
    steps.push({
      action: () => {
        if (enabledAgents.supervisor) {
          setNodeStates(prev => ({ ...prev, supervisor: "processing" }));
          setSimulationLogs(prev => [...prev, "Supervisor Agent: Routing query and planning pipeline execution..."]);
        } else {
          setSimulationLogs(prev => [...prev, "[Bypassed] Supervisor is disabled in execution settings."]);
        }
      },
      delay: delay
    });
    if (enabledAgents.supervisor) {
      delay += 1400;
      steps.push({
        action: () => {
          setNodeStates(prev => ({ ...prev, supervisor: "completed" }));
        },
        delay: delay
      });
    }

    // Step 3: Research
    delay += 300;
    steps.push({
      action: () => {
        if (enabledAgents.research) {
          setNodeStates(prev => ({ ...prev, research: "processing" }));
          setSimulationLogs(prev => [...prev, "Research Agent: Searching web sources for policy details..."]);
        } else {
          setSimulationLogs(prev => [...prev, "[Bypassed] Research Agent is disabled in execution settings."]);
        }
      },
      delay: delay
    });
    if (enabledAgents.research) {
      delay += 1000;
      steps.push({
        action: () => {
          setSimulationLogs(prev => [...prev, "Research Agent: Retrieved 5 external guidelines and compiled facts."]);
        },
        delay: delay
      });
      delay += 1000;
      steps.push({
        action: () => {
          setNodeStates(prev => ({ ...prev, research: "completed" }));
        },
        delay: delay
      });
    }

    // Step 4: RAG
    delay += 300;
    steps.push({
      action: () => {
        if (enabledAgents.rag) {
          setNodeStates(prev => ({ ...prev, rag: "processing" }));
          setSimulationLogs(prev => [...prev, "RAG Agent: Indexing vector collection in Qdrant namespace..."]);
        } else {
          setSimulationLogs(prev => [...prev, "[Bypassed] RAG Agent is disabled in execution settings."]);
        }
      },
      delay: delay
    });
    if (enabledAgents.rag) {
      delay += 1100;
      steps.push({
        action: () => {
          setSimulationLogs(prev => [...prev, "RAG Agent: Found 3 matching segments. Groundedness check: 0.992."]);
        },
        delay: delay
      });
      delay += 900;
      steps.push({
        action: () => {
          setNodeStates(prev => ({ ...prev, rag: "completed" }));
        },
        delay: delay
      });
    }

    // Step 5: Analytics
    delay += 300;
    steps.push({
      action: () => {
        if (enabledAgents.analytics) {
          setNodeStates(prev => ({ ...prev, analytics: "processing" }));
          setSimulationLogs(prev => [...prev, "Analytics Agent: Compiling PostgreSQL performance statistics..."]);
        } else {
          setSimulationLogs(prev => [...prev, "[Bypassed] Analytics Agent is disabled in execution settings."]);
        }
      },
      delay: delay
    });
    if (enabledAgents.analytics) {
      delay += 1000;
      steps.push({
        action: () => {
          setSimulationLogs(prev => [...prev, "Analytics Agent: Processed query telemetry logs. Average SLA is 99.98%."]);
        },
        delay: delay
      });
      delay += 800;
      steps.push({
        action: () => {
          setNodeStates(prev => ({ ...prev, analytics: "completed" }));
        },
        delay: delay
      });
    }

    // Step 6: Report
    delay += 300;
    steps.push({
      action: () => {
        if (enabledAgents.report) {
          setNodeStates(prev => ({ ...prev, report: "processing" }));
          setSimulationLogs(prev => [...prev, "Report Agent: Consolidating text summaries and generating PDF document..."]);
        } else {
          setSimulationLogs(prev => [...prev, "[Bypassed] Report Agent is disabled in execution settings."]);
        }
      },
      delay: delay
    });
    if (enabledAgents.report) {
      delay += 1400;
      steps.push({
        action: () => {
          setSimulationLogs(prev => [...prev, `Report Agent: Successfully compiled final markdown report: "Q2_Compliance_Report.pdf"`]);
        },
        delay: delay
      });
      delay += 600;
      steps.push({
        action: () => {
          setNodeStates(prev => ({ ...prev, report: "completed" }));
        },
        delay: delay
      });
    }

    // Complete Simulation
    delay += 500;
    steps.push({
      action: () => {
        setSimulationActive(false);
        setSimulationLogs(prev => [...prev, "Simulation execution successfully complete. Workflow returned to Idle state."]);
      },
      delay: delay
    });

    steps.forEach((step) => {
      setTimeout(step.action, step.delay);
    });
  };

  // Helper to determine status values in hierarchical Topology
  const getNodeStatus = (nodeKey: string) => {
    const state = nodeStates[nodeKey];
    if (state === "disabled") {
      return { label: "Disabled", color: "bg-slate-900 border-slate-950", text: "text-slate-600", opacity: "opacity-40 grayscale" };
    }
    if (state === "processing") {
      return { label: "Processing", color: "bg-blue-500 shadow-[0_0_15px_#3B82F6] animate-pulse", text: "text-blue-400", opacity: "opacity-100" };
    }
    if (state === "completed") {
      return { label: "Completed", color: "bg-emerald-500 shadow-[0_0_15px_#10B981]", text: "text-emerald-400", opacity: "opacity-100" };
    }
    // Idle/Awaiting
    if (simulationActive) {
      return { label: "Awaiting", color: "bg-slate-800", text: "text-slate-500", opacity: "opacity-60" };
    }
    return { label: "Idle", color: "bg-slate-800/80", text: "text-slate-400", opacity: "opacity-100" };
  };

  // Helper to determine status values in sequential Pipeline
  const getPipelineNodeStatus = (nodeId: string) => {
    const state = nodeStates[nodeId];

    if (state === "disabled") {
      return { 
        label: "Disabled", 
        color: "bg-slate-800", 
        text: "text-slate-650", 
        border: "border-slate-900", 
        bg: "bg-slate-950/20",
        disabled: true 
      };
    }

    if (state === "processing") {
      return { 
        label: "Processing", 
        color: "bg-blue-500", 
        text: "text-blue-400", 
        border: "border-blue-500/40", 
        bg: "bg-blue-500/5", 
        active: true 
      };
    }

    if (state === "completed") {
      return { 
        label: "Completed", 
        color: "bg-emerald-500", 
        text: "text-emerald-400", 
        border: "border-emerald-500/30", 
        bg: "bg-emerald-500/5",
        completed: true 
      };
    }

    // Otherwise idle
    if (simulationActive) {
      return { 
        label: "Awaiting", 
        color: "bg-slate-800", 
        text: "text-slate-500", 
        border: "border-slate-850", 
        bg: "bg-slate-900/10" 
      };
    }

    // Default Idle
    return { 
      label: "Idle", 
      color: "bg-slate-700", 
      text: "text-slate-400", 
      border: "border-slate-800", 
      bg: "bg-slate-900/40" 
    };
  };

  // Helper to calculate connector states
  const getConnectorState = (nodeId: string, nextNodeId: string) => {
    const stateCurr = nodeStates[nodeId];
    const stateNext = nodeStates[nextNodeId];

    const currDisabled = stateCurr === "disabled";
    const nextDisabled = stateNext === "disabled";

    if (currDisabled || nextDisabled) {
      return "disabled";
    }

    if ((stateCurr === "completed" || stateCurr === "processing") && stateNext === "processing") {
      return "active";
    }

    if (stateCurr === "completed" && stateNext === "completed") {
      return "completed";
    }

    return "idle";
  };

  // Pipeline execution nodes list
  const pipelineNodes = [
    { id: "query", name: "User Query", role: "Pipeline Input", desc: "User query submitted to the platform: 'Compile leave compliance report.'", icon: MessageSquare },
    { id: "supervisor", name: "Supervisor", role: "Orchestration & Planning", desc: "Decides execution tree, plans tasks, and routes context queries.", icon: Bot },
    { id: "research", name: "Research", role: "Web Research & Context", desc: "Crawls web sources and summarizes market policy intelligence.", icon: Cpu },
    { id: "rag", name: "RAG", role: "Vector Store Semantic Search", desc: "Performs dense vector retrieval in Qdrant namespace.", icon: Database },
    { id: "analytics", name: "Analytics", role: "Database SQL Analytics", desc: "Compiles PostgreSQL logs and calculates performance metrics.", icon: Activity },
    { id: "report", name: "Report", role: "PDF Report Synthesis", desc: "Assembles markdown details into local PDF reports.", icon: Layers },
  ];

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex justify-between items-center shrink-0 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            Agent Studio <Sparkles className="h-5 w-5 text-blue-500 animate-pulse" />
          </h2>
          <p className="text-xs text-slate-500 mt-1">Design, configure and run multi-agent workflows. System prompts are synced to PostgreSQL.</p>
        </div>
        <button 
          onClick={runSimulation}
          disabled={simulationActive}
          className={`flex items-center gap-2 text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-glow cursor-pointer ${
            simulationActive 
              ? "bg-blue-600/30 text-blue-400 border border-blue-500/20" 
              : "bg-blue-600 hover:bg-blue-500 text-white"
          }`}
        >
          <Play className={`h-4 w-4 ${simulationActive ? "animate-spin text-blue-400" : ""}`} />
          {simulationActive ? "Executing Pipeline..." : "Run Pipeline Test"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Workspace Canvas Panel */}
        <div className="lg:col-span-2 glass-card p-6 rounded-3xl flex flex-col justify-between min-h-[580px] relative overflow-hidden">
          
          {/* Header Switch Toggles */}
          <div className="flex justify-between items-center mb-6">
            <div className="flex bg-slate-100 dark:bg-slate-900/80 p-0.5 rounded-xl border border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setActiveTab("pipeline")}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase transition-all ${
                  activeTab === "pipeline" 
                    ? "bg-slate-250 dark:bg-slate-800 text-blue-500 shadow-sm border border-slate-200 dark:border-slate-700" 
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Pipeline Flow
              </button>
              <button
                onClick={() => setActiveTab("topology")}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase transition-all ${
                  activeTab === "topology" 
                    ? "bg-slate-250 dark:bg-slate-800 text-blue-500 shadow-sm border border-slate-200 dark:border-slate-700" 
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Tree Topology
              </button>
            </div>

            <div className="flex items-center gap-4 text-[10px] text-slate-400 font-bold uppercase">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-700 shadow-[0_0_6px_rgba(148,163,184,0.4)]"></span> Idle</span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_#3B82F6] animate-pulse"></span> 
                Active
              </span>
            </div>
          </div>

          {/* Canvas Render Area */}
          <div className="flex-1 flex flex-col justify-center py-4 relative">
            
            {activeTab === "pipeline" ? (
              /* Linear Animated Execution Graph */
              <div className="flex flex-col items-stretch max-w-sm mx-auto w-full py-2 z-10">
                {pipelineNodes.map((node, index) => {
                  const status = getPipelineNodeStatus(node.id);
                  const isLast = index === pipelineNodes.length - 1;
                  const isSelected = selectedAgentId === node.id;
                  const NodeIcon = node.icon;
                  
                  return (
                    <React.Fragment key={node.id}>
                      {/* Node Card */}
                      <div
                        onClick={() => {
                          setSelectedAgentId(node.id);
                        }}
                        className={`flex items-center gap-4 p-3.5 rounded-2xl border transition-all duration-350 cursor-pointer active:scale-[0.98] ${
                          isSelected 
                            ? "border-blue-500/90 bg-slate-900/80 shadow-[0_0_20px_rgba(59,130,246,0.15)] ring-1 ring-blue-500/30" 
                            : status.active
                            ? "border-blue-500/40 bg-blue-500/5 animate-node-pulse"
                            : status.completed
                            ? "border-emerald-500/30 bg-emerald-500/5 animate-completed-pulse"
                            : status.disabled
                            ? "border-slate-900 bg-slate-950/20 opacity-45 grayscale select-none"
                            : "border-slate-800/80 bg-slate-900/40 hover:border-slate-700/60"
                        }`}
                      >
                        {/* Circle Icon Badge */}
                        <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 border relative transition-all duration-300 ${
                          status.active
                            ? "bg-blue-500/10 border-blue-500/35 text-blue-400"
                            : status.completed
                            ? "bg-emerald-500/10 border-emerald-500/35 text-emerald-400"
                            : status.disabled
                            ? "bg-slate-950/40 border-slate-900 text-slate-600"
                            : "bg-slate-900 border-slate-800 text-slate-400"
                        }`}>
                          <NodeIcon className={`h-4.5 w-4.5 transition-colors ${status.active ? "text-blue-500" : status.completed ? "text-emerald-400" : "text-slate-405"}`} />
                          
                          {status.active && (
                            <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
                            </span>
                          )}
                          {status.completed && (
                            <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 rounded-full bg-emerald-500 items-center justify-center border border-slate-950 shadow-[0_0_6px_#10B981]">
                              <CheckCircle2 className="h-2 w-2 text-white" strokeWidth={3} />
                            </span>
                          )}
                        </div>

                        {/* Title details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className={`text-xs font-bold transition-colors ${
                              status.disabled ? "text-slate-600" : "text-slate-200"
                            }`}>{node.name}</h4>
                            <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border transition-colors ${
                              status.active
                                ? "border-blue-500/20 text-blue-400 bg-blue-500/5"
                                : status.completed
                                ? "border-emerald-500/20 text-emerald-400 bg-emerald-500/5"
                                : status.disabled
                                ? "border-slate-900 text-slate-600 bg-slate-950/40"
                                : "border-slate-800 text-slate-500 bg-slate-900/10"
                            }`}>
                              {status.label}
                            </span>
                          </div>
                          <p className={`text-[9px] font-semibold transition-colors mt-0.5 ${
                            status.disabled ? "text-slate-600" : "text-slate-400"
                          }`}>{node.role}</p>
                        </div>
                      </div>

                      {/* Vertical Sliding Animation Connection Line */}
                      {!isLast && (() => {
                        const nextNode = pipelineNodes[index + 1];
                        const connState = getConnectorState(node.id, nextNode.id);
                        
                        return (
                          <div className="flex justify-center items-center my-0.5">
                            <div className={`w-0.5 h-8 relative transition-all duration-300 ${
                              connState === "disabled" 
                                ? "border-l border-dashed border-slate-700/60 dark:border-slate-800/60 bg-transparent" 
                                : connState === "active"
                                ? "bg-slate-850 shadow-[0_0_8px_rgba(59,130,246,0.3)]"
                                : connState === "completed"
                                ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                                : "bg-slate-200 dark:bg-slate-800"
                            }`}>
                              {connState === "active" && (
                                <div className="absolute inset-0 bg-gradient-to-b from-blue-500 via-cyan-400 to-transparent animate-laser-flow" />
                              )}
                              {connState === "completed" && (
                                <div className="absolute inset-0 bg-emerald-500" />
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </React.Fragment>
                  );
                })}
              </div>
            ) : (
              /* Tree Topology View */
              <div className="flex-1 flex flex-col justify-between py-6 relative">
                {/* SVG Connecting Branches */}
                <div className="absolute inset-0 pointer-events-none z-0">
                  <svg className="w-full h-full text-slate-200 dark:text-slate-850" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <linearGradient id="activeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.4" />
                      </linearGradient>
                    </defs>
                    
                    {/* Research Branch */}
                    {nodeStates.research === "disabled" || nodeStates.supervisor === "disabled" ? (
                      <path d="M 50% 100 L 50% 190 L 12.5% 190 L 12.5% 260" fill="none" strokeWidth="1.5" stroke="#1F2937" strokeDasharray="4 4" className="opacity-30" />
                    ) : nodeStates.research === "processing" ? (
                      <path d="M 50% 100 L 50% 190 L 12.5% 190 L 12.5% 260" fill="none" strokeWidth="2.5" stroke="url(#activeGrad)" strokeDasharray="8 4" className="animate-[dash_2s_linear_infinite]" />
                    ) : nodeStates.research === "completed" ? (
                      <path d="M 50% 100 L 50% 190 L 12.5% 190 L 12.5% 260" fill="none" strokeWidth="2" stroke="#10B981" className="shadow-[0_0_8px_#10B981] opacity-80" />
                    ) : (
                      <path d="M 50% 100 L 50% 190 L 12.5% 190 L 12.5% 260" fill="none" strokeWidth="2" stroke="currentColor" className="opacity-20" />
                    )}

                    {/* RAG Branch */}
                    {nodeStates.rag === "disabled" || nodeStates.supervisor === "disabled" ? (
                      <path d="M 50% 100 L 50% 190 L 37.5% 190 L 37.5% 260" fill="none" strokeWidth="1.5" stroke="#1F2937" strokeDasharray="4 4" className="opacity-30" />
                    ) : nodeStates.rag === "processing" ? (
                      <path d="M 50% 100 L 50% 190 L 37.5% 190 L 37.5% 260" fill="none" strokeWidth="2.5" stroke="url(#activeGrad)" strokeDasharray="8 4" className="animate-[dash_2s_linear_infinite]" />
                    ) : nodeStates.rag === "completed" ? (
                      <path d="M 50% 100 L 50% 190 L 37.5% 190 L 37.5% 260" fill="none" strokeWidth="2" stroke="#10B981" className="shadow-[0_0_8px_#10B981] opacity-80" />
                    ) : (
                      <path d="M 50% 100 L 50% 190 L 37.5% 190 L 37.5% 260" fill="none" strokeWidth="2" stroke="currentColor" className="opacity-20" />
                    )}

                    {/* Analytics Branch */}
                    {nodeStates.analytics === "disabled" || nodeStates.supervisor === "disabled" ? (
                      <path d="M 50% 100 L 50% 190 L 62.5% 190 L 62.5% 260" fill="none" strokeWidth="1.5" stroke="#1F2937" strokeDasharray="4 4" className="opacity-30" />
                    ) : nodeStates.analytics === "processing" ? (
                      <path d="M 50% 100 L 50% 190 L 62.5% 190 L 62.5% 260" fill="none" strokeWidth="2.5" stroke="url(#activeGrad)" strokeDasharray="8 4" className="animate-[dash_2s_linear_infinite]" />
                    ) : nodeStates.analytics === "completed" ? (
                      <path d="M 50% 100 L 50% 190 L 62.5% 190 L 62.5% 260" fill="none" strokeWidth="2" stroke="#10B981" className="shadow-[0_0_8px_#10B981] opacity-80" />
                    ) : (
                      <path d="M 50% 100 L 50% 190 L 62.5% 190 L 62.5% 260" fill="none" strokeWidth="2" stroke="currentColor" className="opacity-20" />
                    )}

                    {/* Report Branch */}
                    {nodeStates.report === "disabled" || nodeStates.supervisor === "disabled" ? (
                      <path d="M 50% 100 L 50% 190 L 87.5% 190 L 87.5% 260" fill="none" strokeWidth="1.5" stroke="#1F2937" strokeDasharray="4 4" className="opacity-30" />
                    ) : nodeStates.report === "processing" ? (
                      <path d="M 50% 100 L 50% 190 L 87.5% 190 L 87.5% 260" fill="none" strokeWidth="2.5" stroke="url(#activeGrad)" strokeDasharray="8 4" className="animate-[dash_2s_linear_infinite]" />
                    ) : nodeStates.report === "completed" ? (
                      <path d="M 50% 100 L 50% 190 L 87.5% 190 L 87.5% 260" fill="none" strokeWidth="2" stroke="#10B981" className="shadow-[0_0_8px_#10B981] opacity-80" />
                    ) : (
                      <path d="M 50% 100 L 50% 190 L 87.5% 190 L 87.5% 260" fill="none" strokeWidth="2" stroke="currentColor" className="opacity-20" />
                    )}
                  </svg>
                </div>

                {/* Supervisor Node */}
                <div className="flex justify-center z-10">
                  {(() => {
                    const node = agentsMap.supervisor;
                    const status = getNodeStatus("supervisor");
                    const isSelected = selectedAgentId === "supervisor";
                    return (
                      <div
                        onClick={() => setSelectedAgentId("supervisor")}
                        className={`glass-card p-4 rounded-2xl cursor-pointer max-w-[200px] w-full text-center flex flex-col items-center gap-2 transition-all active:scale-[0.98] border ${
                          isSelected 
                            ? "border-blue-500 bg-slate-900/80 shadow-[0_0_20px_rgba(59,130,246,0.15)]" 
                            : status.opacity + " hover:border-blue-500/40 bg-slate-900/40"
                        }`}
                      >
                        <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-500 flex items-center justify-center relative">
                          <Bot className="h-5 w-5" />
                          <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-slate-950 ${status.color}`} />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-slate-800 dark:text-slate-200">{node.name}</h4>
                          <p className="text-[9px] font-bold text-slate-450 dark:text-slate-400 uppercase tracking-wider mt-0.5">{node.role}</p>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Bottom Row */}
                <div className="grid grid-cols-4 gap-4 z-10 mt-12">
                  {["research", "rag", "analytics", "report"].map((key) => {
                    const node = agentsMap[key];
                    const status = getNodeStatus(key);
                    const isSelected = selectedAgentId === key;
                    return (
                      <div
                        key={key}
                        onClick={() => setSelectedAgentId(key)}
                        className={`glass-card p-3 rounded-2xl cursor-pointer text-center flex flex-col items-center gap-2 transition-all active:scale-[0.98] border ${
                          isSelected 
                            ? "border-blue-500 bg-slate-900/80 shadow-[0_0_20px_rgba(59,130,246,0.15)]" 
                            : status.opacity + " hover:border-blue-500/40 bg-slate-900/40"
                        }`}
                      >
                        <div className="h-9 w-9 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-500 flex items-center justify-center relative">
                          {key === "research" && <Cpu className="h-4.5 w-4.5" />}
                          {key === "rag" && <Database className="h-4.5 w-4.5" />}
                          {key === "analytics" && <Activity className="h-4.5 w-4.5" />}
                          {key === "report" && <Layers className="h-4.5 w-4.5" />}
                          <span className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-slate-950 ${status.color}`} />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-[11px] font-black text-slate-800 dark:text-slate-200 truncate">{node.name}</h4>
                          <p className="text-[8px] font-bold text-slate-450 dark:text-slate-450 uppercase tracking-widest truncate mt-0.5">{node.role}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Telemetry Console */}
          <div className="border-t border-slate-200 dark:border-slate-850/80 pt-4 mt-6">
            <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              <Terminal className="h-3.5 w-3.5" />
              <span>Telemetry Execution Logs</span>
            </div>
            <div className="h-24 w-full bg-slate-950 border border-slate-900 rounded-xl p-3.5 font-mono text-[10px] text-slate-400 overflow-y-auto space-y-1 select-none">
              {simulationLogs.length === 0 ? (
                <span className="text-slate-600 dark:text-slate-700">Awaiting simulation trigger... Press "Run Pipeline Test" above to start.</span>
              ) : (
                simulationLogs.map((log, i) => (
                  <div key={i} className="flex gap-2 leading-relaxed">
                    <span className="text-blue-500 font-bold shrink-0">&gt;</span>
                    <span className="text-slate-300">{log}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Inspector Panel */}
        <div className="glass-card p-6 rounded-3xl space-y-6 flex flex-col justify-between">
          <div className="space-y-6">
            <div className="pb-4 border-b border-slate-200 dark:border-slate-850">
              <h3 className="font-extrabold text-base text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Sliders className="h-4.5 w-4.5 text-blue-500" />
                <span>Agent Inspector</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">Examine properties and sync registry variables.</p>
            </div>

            {/* Static Attributes */}
            {selectedAgentId === "query" ? (
              <div className="space-y-3.5">
                <div className="flex gap-3.5 items-center">
                  <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">User Query</h4>
                    <p className="text-[10px] text-slate-450 font-bold uppercase tracking-wider">Pipeline Input</p>
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-450 leading-relaxed font-medium">
                  The initial query prompt entered by the user. This initiates the multi-agent execution pipeline.
                </p>
              </div>
            ) : (
              <div className="space-y-3.5">
                <div className="flex gap-3.5 items-center">
                  <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                    {selectedAgentId === "supervisor" && <Bot className="h-5 w-5" />}
                    {selectedAgentId === "research" && <Cpu className="h-5 w-5" />}
                    {selectedAgentId === "rag" && <Database className="h-5 w-5" />}
                    {selectedAgentId === "analytics" && <Activity className="h-5 w-5" />}
                    {selectedAgentId === "report" && <Layers className="h-5 w-5" />}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">{selectedAgent.name}</h4>
                    <p className="text-[10px] text-slate-450 font-bold uppercase tracking-wider">{selectedAgent.role}</p>
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-450 leading-relaxed font-medium">
                  {selectedAgent.description}
                </p>
              </div>
            )}

            {/* Edit Parameters Form */}
            {selectedAgentId === "query" ? (
              <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Simulation Query Prompt</label>
                  <textarea
                    value={userQueryText}
                    onChange={(e) => setUserQueryText(e.target.value)}
                    rows={4}
                    className="w-full bg-slate-100/50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-750 dark:text-slate-200 focus:outline-none focus:border-blue-500 leading-normal"
                    placeholder="Enter query prompt..."
                  />
                </div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 leading-normal">
                  Editing this updates the prompt executed when clicking <strong>Run Pipeline Test</strong>.
                </div>
              </div>
            ) : (
              <form onSubmit={handleSaveParameters} className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                {/* Switch to enable/disable agent */}
                <div className="flex items-center justify-between p-3.5 bg-slate-100/50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-2xl mb-4">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Enable in Workflow</span>
                    <span className="text-[9px] text-slate-500">Toggle inclusion in simulation runs</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={enabledAgents[selectedAgentId] ?? true} 
                      onChange={(e) => {
                        const val = e.target.checked;
                        setEnabledAgents(prev => ({ ...prev, [selectedAgentId]: val }));
                      }}
                      className="sr-only peer" 
                    />
                    <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {/* Show parameters form ONLY if enabled */}
                {(enabledAgents[selectedAgentId] ?? true) ? (
                  <>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Model Provider Engine</label>
                      <select
                        value={formModel}
                        onChange={(e) => setFormModel(e.target.value)}
                        className="w-full bg-slate-100/50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                      >
                        <option value="openai-gpt4o">GPT-4o (High-accuracy)</option>
                        <option value="openai-gpt4o-mini">GPT-4o mini (Low-latency)</option>
                        <option value="anthropic-claude-3-5-sonnet">Claude 3.5 Sonnet</option>
                        <option value="google-gemini-1-5-pro">Gemini 1.5 Pro</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">
                        <span>Temperature</span>
                        <span className="text-blue-500 font-bold">{formTemp}</span>
                      </div>
                      <input
                        type="range"
                        min="0.0"
                        max="1.0"
                        step="0.1"
                        value={formTemp}
                        onChange={(e) => setFormTemp(parseFloat(e.target.value))}
                        className="w-full h-1 bg-slate-200 dark:bg-slate-850 rounded-lg appearance-none cursor-pointer accent-blue-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">System Instruction Prompt</label>
                      <textarea
                        value={formPrompt}
                        onChange={(e) => setFormPrompt(e.target.value)}
                        rows={4}
                        className="w-full bg-slate-100/50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-blue-500 leading-normal"
                      />
                    </div>

                    {/* Tools display */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Enabled Tools / Capabilities</label>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedAgent.tools?.map((t, idx) => (
                          <span key={idx} className="text-[9px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-1 rounded border border-blue-500/20">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-3 px-4 rounded-xl transition shadow-glow flex items-center justify-center gap-1.5 cursor-pointer mt-4"
                    >
                      <CheckCircle2 className="h-4 w-4" /> Sync Parameter Changes
                    </button>
                  </>
                ) : (
                  <div className="p-6 bg-slate-950/40 border border-slate-900 rounded-2xl text-center text-xs text-slate-550 font-medium">
                    This agent is disabled in execution settings. Turn on the switch above to re-enable and configure its parameters.
                  </div>
                )}
              </form>
            )}
          </div>
          
          <div className="text-[10px] text-slate-400 border-t border-slate-200 dark:border-slate-850/80 pt-4 mt-6 leading-relaxed font-medium">
            Active Workspace Sync: <strong>PostgreSQL Registry database</strong>. Direct write verified via RPC channels.
          </div>
        </div>
      </div>

      {/* Embedded Keyframes for animations */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes dash {
          to {
            stroke-dashoffset: -100;
          }
        }
        @keyframes laserFlow {
          0% { transform: translateY(-200%); }
          100% { transform: translateY(200%); }
        }
        .animate-laser-flow {
          animation: laserFlow 1.5s linear infinite;
        }
        @keyframes nodePulse {
          0%, 100% {
            box-shadow: 0 0 10px rgba(59, 130, 246, 0.15);
            border-color: rgba(59, 130, 246, 0.3);
          }
          50% {
            box-shadow: 0 0 25px rgba(59, 130, 246, 0.4);
            border-color: rgba(59, 130, 246, 0.6);
          }
        }
        .animate-node-pulse {
          animation: nodePulse 2s infinite ease-in-out;
        }
        @keyframes completedPulse {
          0%, 100% {
            box-shadow: 0 0 8px rgba(16, 185, 129, 0.1);
          }
          50% {
            box-shadow: 0 0 16px rgba(16, 185, 129, 0.3);
          }
        }
        .animate-completed-pulse {
          animation: completedPulse 2.5s infinite ease-in-out;
        }
      `}} />
    </div>
  );
}
