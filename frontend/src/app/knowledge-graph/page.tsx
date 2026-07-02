"use client";

import React, { useState, useEffect, useMemo } from "react";
import { apiFetch } from "../utils/api";
import {
  Network,
  Search,
  Filter,
  Users,
  FolderGit2,
  Building2,
  Package,
  BookOpen,
  Briefcase,
  Play,
  Terminal,
  Activity,
  ArrowRight,
  Database,
  Info,
  RefreshCw
} from "lucide-react";

import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
  Position,
  NodeProps
} from "reactflow";
import "reactflow/dist/style.css";
import * as d3 from "d3";

interface GraphNode {
  name: string;
  label: string;
  x?: number;
  y?: number;
}

interface GraphRelationship {
  source: string;
  source_label: string;
  target: string;
  target_label: string;
  type: string;
}

interface D3Node extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  label: string;
}

interface D3Link extends d3.SimulationLinkDatum<D3Node> {
  source: string;
  target: string;
  type: string;
}

// Custom Node Component to display entity categories beautifully inside React Flow
const CustomGraphNode = ({ data }: NodeProps) => {
  const { name, label, highlighted, isSelected } = data;

  const getNodeColor = (lbl: string) => {
    switch (lbl) {
      case "Employee": 
        return { bg: "bg-indigo-500/10", border: "border-indigo-500/30", text: "text-indigo-400", shadow: "shadow-[0_0_15px_rgba(99,102,241,0.15)]" };
      case "Department": 
        return { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-400", shadow: "shadow-[0_0_15px_rgba(16,185,129,0.15)]" };
      case "Project": 
        return { bg: "bg-cyan-500/10", border: "border-cyan-500/30", text: "text-cyan-400", shadow: "shadow-[0_0_15px_rgba(6,182,212,0.15)]" };
      case "Policy": 
        return { bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-400", shadow: "shadow-[0_0_15px_rgba(245,158,11,0.15)]" };
      case "Product": 
        return { bg: "bg-rose-500/10", border: "border-rose-500/30", text: "text-rose-400", shadow: "shadow-[0_0_15px_rgba(244,63,94,0.15)]" };
      case "Organization": 
        return { bg: "bg-violet-500/10", border: "border-violet-500/30", text: "text-violet-400", shadow: "shadow-[0_0_15px_rgba(139,92,246,0.15)]" };
      default: 
        return { bg: "bg-slate-500/10", border: "border-slate-500/30", text: "text-slate-400", shadow: "shadow-none" };
    }
  };

  const colors = getNodeColor(label);

  return (
    <div className={`p-3 rounded-2xl border transition-all duration-300 min-w-[130px] text-center bg-slate-900/95 backdrop-blur-md ${colors.border} ${
      highlighted 
        ? "border-amber-500/90 shadow-[0_0_20px_rgba(245,158,11,0.35)] scale-105 ring-1 ring-amber-500/30" 
        : isSelected 
        ? "border-blue-500/90 shadow-[0_0_20px_rgba(59,130,246,0.35)] scale-105 ring-1 ring-blue-500/30" 
        : colors.shadow
    }`}>
      {/* Target/Source handles for lines */}
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
      <Handle type="target" position={Position.Left} className="opacity-0" />
      <Handle type="source" position={Position.Right} className="opacity-0" />

      <div className="flex flex-col items-center gap-1.5">
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border bg-slate-950/40 ${colors.border} ${colors.text}`}>
          {label === "Employee" && <Users className="h-4 w-4" />}
          {label === "Department" && <Building2 className="h-4 w-4" />}
          {label === "Project" && <FolderGit2 className="h-4 w-4" />}
          {label === "Policy" && <BookOpen className="h-4 w-4" />}
          {label === "Product" && <Package className="h-4 w-4" />}
          {label === "Organization" && <Briefcase className="h-4 w-4" />}
          {label !== "Employee" && label !== "Department" && label !== "Project" && label !== "Policy" && label !== "Product" && label !== "Organization" && <Info className="h-4 w-4" />}
        </div>
        <div className="min-w-0 w-full">
          <p className="text-[10px] font-bold text-slate-100 truncate">{name}</p>
          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{label}</p>
        </div>
      </div>
    </div>
  );
};

// D3 Force-directed simulation solver
const runD3ForceLayout = (rawNodes: GraphNode[], rawRelationships: GraphRelationship[]) => {
  const d3Nodes: D3Node[] = rawNodes.map((n) => ({
    id: n.name,
    name: n.name,
    label: n.label,
    x: Math.random() * 400 + 150,
    y: Math.random() * 300 + 80
  }));

  const d3Links: D3Link[] = rawRelationships.map((r) => ({
    source: r.source,
    target: r.target,
    type: r.type
  }));

  const simulation = d3.forceSimulation<D3Node>(d3Nodes)
    .force("charge", d3.forceManyBody().strength(-550))
    .force("link", d3.forceLink<D3Node, D3Link>(d3Links).id(d => d.id).distance(145))
    .force("center", d3.forceCenter(350, 240))
    .force("collision", d3.forceCollide().radius(75));

  // Run solver synchronously
  for (let i = 0; i < 200; i++) {
    simulation.tick();
  }

  return { d3Nodes, d3Links };
};

export default function KnowledgeGraphPage() {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [relationships, setRelationships] = useState<GraphRelationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLabelFilter, setSelectedLabelFilter] = useState("all");
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  
  // React Flow hooks
  const [nodesState, setNodesState, onNodesChange] = useNodesState([]);
  const [edgesState, setEdgesState, onEdgesChange] = useEdgesState([]);

  // Client mounting safety
  const [mounted, setMounted] = useState(false);

  // AI Reasoning Simulator States
  const [aiQuery, setAiQuery] = useState("Who manages Apollo Project?");
  const [aiCypher, setAiCypher] = useState("");
  const [aiOutput, setAiOutput] = useState<any>(null);
  const [aiRunning, setAiRunning] = useState(false);

  const nodeTypes = useMemo(() => ({
    customNode: CustomGraphNode
  }), []);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchGraphData = () => {
    setLoading(true);
    setError(null);
    apiFetch("/documents/knowledge-graph")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load graph data");
        return res.json();
      })
      .then((data) => {
        const rawNodes = data.nodes || [];
        const rawRels = data.relationships || [];
        
        setNodes(rawNodes);
        setRelationships(rawRels);

        // Run force calculations
        const { d3Nodes } = runD3ForceLayout(rawNodes, rawRels);
        
        // Map nodes
        const rfNodes = d3Nodes.map((node) => ({
          id: node.id,
          type: "customNode",
          position: { x: node.x || 0, y: node.y || 0 },
          data: {
            name: node.name,
            label: node.label,
            highlighted: false,
            isSelected: false
          }
        }));

        // Map relationships
        const rfEdges = rawRels.map((rel: GraphRelationship, idx: number) => ({
          id: `edge-${idx}`,
          source: rel.source,
          target: rel.target,
          label: rel.type,
          type: "smoothstep",
          animated: false,
          style: { stroke: "#334155", strokeWidth: 1.5 },
          labelStyle: { fill: "#94a3b8", fontSize: 8, fontWeight: "bold" },
          labelBgStyle: { fill: "#0c0f19", stroke: "#1e293b", strokeWidth: 1, rx: 4, ry: 4 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 14,
            height: 14,
            color: "#475569"
          }
        }));

        setNodesState(rfNodes);
        setEdgesState(rfEdges);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to fetch graph data");
        setLoading(false);
      });
  };

  useEffect(() => {
    if (mounted) {
      fetchGraphData();
    }
  }, [mounted]);

  // Handle Node Search and Filter Categories Hiding
  useEffect(() => {
    setNodesState((nds) =>
      nds.map((node) => {
        const matchesSearch = node.id.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesLabel = selectedLabelFilter === "all" || node.data.label.toLowerCase() === selectedLabelFilter.toLowerCase();
        return {
          ...node,
          hidden: !(matchesSearch && matchesLabel)
        };
      })
    );
  }, [searchQuery, selectedLabelFilter, setNodesState]);

  // React Flow select node logic
  const onNodeClick = (event: React.MouseEvent, node: any) => {
    const matched = nodes.find(n => n.name.toLowerCase() === node.id.toLowerCase());
    if (matched) {
      setSelectedNode(matched);
      setNodesState((nds) =>
        nds.map((n) => ({
          ...n,
          data: {
            ...n.data,
            isSelected: n.id === node.id
          }
        }))
      );
    }
  };

  // Clear previous highlighted paths
  const clearHighlights = () => {
    setNodesState((nds) =>
      nds.map((n) => ({
        ...n,
        data: {
          ...n.data,
          highlighted: false
        }
      }))
    );
    setEdgesState((eds) =>
      eds.map((e) => ({
        ...e,
        animated: false,
        style: { stroke: "#334155", strokeWidth: 1.5 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 14,
          height: 14,
          color: "#475569"
        }
      }))
    );
  };

  // Run actual backend-supported GraphRAG reasoning query
  const runReasoningSimulation = () => {
    if (!aiQuery.trim()) return;
    setAiRunning(true);
    setAiOutput(null);
    setAiCypher("");
    clearHighlights();
    
    apiFetch("/documents/knowledge-graph/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: aiQuery }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to run graph reasoning query");
        return res.json();
      })
      .then((data) => {
        const cypher = data.cypher || "";
        const results = data.results || [];
        const answer = data.answer || "";
        
        setAiCypher(cypher);
        setAiOutput({ answer, results });
        setAiRunning(false);

        // Apply highlighting inside React Flow based on matching node names and relationship edges
        if (results.length > 0) {
          const highlightedNodeNames = new Set<string>();
          const highlightedEdgeIds = new Set<string>();

          results.forEach((resItem: any) => {
            Object.keys(resItem).forEach((k) => {
              const val = resItem[k];
              if (typeof val === "string") {
                highlightedNodeNames.add(val.toLowerCase());
              } else if (val && typeof val === "object" && val.name) {
                highlightedNodeNames.add(val.name.toLowerCase());
              }
            });
          });

          // Match edges that connect highlighted nodes
          edgesState.forEach((edge) => {
            const srcMatch = highlightedNodeNames.has(edge.source.toLowerCase());
            const tgtMatch = highlightedNodeNames.has(edge.target.toLowerCase());
            if (srcMatch && tgtMatch) {
              highlightedEdgeIds.add(edge.id);
            }
          });

          setNodesState((nds) =>
            nds.map((n) => ({
              ...n,
              data: {
                ...n.data,
                highlighted: highlightedNodeNames.has(n.id.toLowerCase())
              }
            }))
          );

          setEdgesState((eds) =>
            eds.map((e) => {
              const isHighlighted = highlightedEdgeIds.has(e.id);
              return {
                ...e,
                animated: isHighlighted,
                style: isHighlighted 
                  ? { stroke: "#f59e0b", strokeWidth: 2.5 }
                  : { stroke: "#334155", strokeWidth: 1.5 },
                markerEnd: {
                  type: MarkerType.ArrowClosed,
                  width: 14,
                  height: 14,
                  color: isHighlighted ? "#f59e0b" : "#475569"
                }
              };
            })
          );
        }
      })
      .catch((err) => {
        console.error(err);
        setAiCypher("Error translating Cypher query.");
        setAiOutput({ error: err.message || "Failed to communicate with API" });
        setAiRunning(false);
      });
  };

  const getNodeColorStroke = (label: string) => {
    switch (label) {
      case "Employee": return "#6366f1";
      case "Department": return "#10b981";
      case "Project": return "#06b6d4";
      case "Policy": return "#f59e0b";
      case "Product": return "#f43f5e";
      case "Organization": return "#8b5cf6";
      default: return "#94a3b8";
    }
  };

  const getNodeColor = (label: string) => {
    switch (label) {
      case "Employee": return { bg: "bg-indigo-500", text: "text-indigo-400", border: "border-indigo-500" };
      case "Department": return { bg: "bg-emerald-500", text: "text-emerald-400", border: "border-emerald-500" };
      case "Project": return { bg: "bg-cyan-500", text: "text-cyan-400", border: "border-cyan-500" };
      case "Policy": return { bg: "bg-amber-500", text: "text-amber-400", border: "border-amber-500" };
      case "Product": return { bg: "bg-rose-500", text: "text-rose-400", border: "border-rose-500" };
      case "Organization": return { bg: "bg-violet-500", text: "text-violet-400", border: "border-violet-500" };
      default: return { bg: "bg-slate-500", text: "text-slate-400", border: "border-slate-500" };
    }
  };

  const getNodeIcon = (label: string) => {
    switch (label) {
      case "Employee": return Users;
      case "Department": return Building2;
      case "Project": return FolderGit2;
      case "Policy": return BookOpen;
      case "Product": return Package;
      case "Organization": return Briefcase;
      default: return Info;
    }
  };

  // Get nodes connected to the selected node
  const connectedRelationships = selectedNode
    ? relationships.filter(
        (r) =>
          r.source.toLowerCase() === selectedNode.name.toLowerCase() ||
          r.target.toLowerCase() === selectedNode.name.toLowerCase()
      )
    : [];

  if (!mounted) {
    return (
      <div className="flex h-64 items-center justify-center bg-slate-950/20 text-slate-400">
        <RefreshCw className="h-6 w-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto w-full">
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <Network className="h-6 w-6 text-indigo-500" />
            <h2 className="text-2xl font-extrabold tracking-tight">Enterprise Knowledge Graph</h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Visualizing extracted entity nodes and relationships stored in Neo4j to reason across organizational boundaries.
          </p>
        </div>
        <button
          onClick={fetchGraphData}
          className="flex items-center gap-2 text-xs font-semibold px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl transition"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Reload Graph
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left pane: Filter and List panel */}
        <div className="space-y-6">
          <div className="glass-card p-5 rounded-2xl space-y-4">
            <h3 className="font-bold text-sm text-slate-700 dark:text-slate-200 flex items-center gap-2">
              <Filter className="h-4 w-4 text-indigo-400" />
              Graph Settings
            </h3>
            
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search nodes by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-2 pl-10 pr-4 text-xs font-semibold focus:outline-none focus:border-indigo-500 transition"
              />
            </div>

            {/* Filter buttons */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Node Category</label>
              <div className="flex flex-wrap gap-2">
                {["all", "Employee", "Department", "Project", "Policy", "Product", "Organization"].map((lbl) => (
                  <button
                    key={lbl}
                    onClick={() => setSelectedLabelFilter(lbl.toLowerCase())}
                    className={`text-[10px] font-bold px-3 py-1.5 rounded-xl border transition ${
                      selectedLabelFilter === lbl.toLowerCase()
                        ? "bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 border-indigo-500"
                        : "bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-slate-300"
                    }`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Node details / drawer */}
          <div className="glass-card p-5 rounded-2xl space-y-4">
            <h3 className="font-bold text-sm text-slate-700 dark:text-slate-200">
              Selected Node Info
            </h3>
            {selectedNode ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-100/60 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                  <div className={`p-2.5 rounded-xl text-white ${getNodeColor(selectedNode.label).bg}`}>
                    {React.createElement(getNodeIcon(selectedNode.label), { className: "h-5 w-5" })}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">{selectedNode.name}</h4>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{selectedNode.label}</span>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Connections ({connectedRelationships.length})</span>
                  {connectedRelationships.length > 0 ? (
                    <div className="space-y-2">
                      {connectedRelationships.map((r, idx) => {
                        const isSource = r.source.toLowerCase() === selectedNode.name.toLowerCase();
                        const otherNodeName = isSource ? r.target : r.source;
                        const otherNodeLabel = isSource ? r.target_label : r.source_label;
                        
                        return (
                          <div key={idx} className="flex justify-between items-center text-xs p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-900">
                            <span className="font-medium text-slate-500">
                              {isSource ? "Outgoing" : "Incoming"} relationship:
                            </span>
                            <div className="flex items-center gap-1.5 font-bold">
                              <span className="px-1.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-500 text-[10px]">{r.type}</span>
                              <ArrowRight className="h-3 w-3 text-slate-400" />
                              <span className={getNodeColor(otherNodeLabel).text}>{otherNodeName}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No direct connections recorded.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-6 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                <Info className="h-5 w-5 text-slate-400 mx-auto mb-2" />
                <p className="text-xs text-slate-400 font-semibold">Click any node in the graph layout to inspect its connections.</p>
              </div>
            )}
          </div>
        </div>

        {/* Center / Right: Interactive Graph and AI Reasoning */}
        <div className="lg:col-span-2 space-y-6">
          {/* Visual Canvas Panel */}
          <div className="glass-card p-4 rounded-2xl relative overflow-hidden flex flex-col justify-between" style={{ minHeight: "560px" }}>
            <div className="absolute top-4 left-4 z-10 flex gap-2">
              <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Active Graph
              </span>
              <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 flex items-center gap-1.5">
                <Database className="h-3 w-3" />
                {nodes.length} Nodes / {relationships.length} Relationships
              </span>
            </div>

            {loading ? (
              <div className="m-auto text-center space-y-3">
                <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin mx-auto" />
                <p className="text-xs text-slate-400 font-bold">Constructing graph map projection...</p>
              </div>
            ) : error ? (
              <div className="m-auto text-center space-y-3 text-rose-500">
                <p className="text-sm font-bold">Failed to load Knowledge Graph data.</p>
                <p className="text-xs text-slate-400 font-semibold">{error}</p>
              </div>
            ) : (
              <div className="w-full h-[480px] bg-slate-950/20 dark:bg-slate-950/60 rounded-xl overflow-hidden border border-slate-900 mt-6 relative">
                <ReactFlow
                  nodes={nodesState}
                  edges={edgesState}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onNodeClick={onNodeClick}
                  nodeTypes={nodeTypes}
                  fitView
                >
                  <Background color="#334155" gap={16} size={1} />
                  <Controls className="bg-slate-900 border border-slate-800 text-slate-200 fill-slate-200 rounded-lg p-1" />
                  <MiniMap 
                    nodeColor={(n) => {
                      return getNodeColorStroke(n.data?.label || "");
                    }}
                    className="bg-slate-900/90 border border-slate-800 rounded-lg overflow-hidden" 
                    maskColor="rgba(0, 0, 0, 0.4)"
                  />
                </ReactFlow>
              </div>
            )}
            
            <div className="flex gap-4 justify-center text-[10px] font-bold mt-3 pb-1 flex-wrap">
              {["Employee", "Department", "Project", "Policy", "Product", "Organization"].map((lbl) => {
                const stroke = getNodeColorStroke(lbl);
                return (
                  <div key={lbl} className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stroke }}></span>
                    <span className="text-slate-400 font-semibold">{lbl}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI Graph Reasoning console */}
          <div className="glass-card p-5 rounded-2xl space-y-4">
            <div className="flex justify-between items-center pb-2.5 border-b border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center gap-2">
                <Terminal className="h-4.5 w-4.5 text-indigo-400" />
                <h3 className="font-bold text-sm text-slate-700 dark:text-slate-200">
                  AI Graph Relational Reasoning Console
                </h3>
              </div>
              <Activity className="h-4 w-4 text-emerald-400" />
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Submit natural language relationship queries. The system automatically converts the question to a Cypher query, runs it over the graph adapter, and highlights matching paths inside React Flow.
            </p>

            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Ask a relationship question (e.g. Who manages Apollo Project?)"
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 px-4 text-xs font-semibold focus:outline-none focus:border-indigo-500 transition text-slate-200"
                />
              </div>
              <button
                onClick={runReasoningSimulation}
                disabled={aiRunning}
                className="flex items-center justify-center gap-2 text-xs font-bold px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition shadow-glow disabled:opacity-55 cursor-pointer"
              >
                <Play className="h-3.5 w-3.5 fill-white" />
                {aiRunning ? "Reasoning..." : "Execute"}
              </button>
            </div>

            {/* Quick sample queries */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Example queries</span>
              <div className="flex flex-wrap gap-2">
                {[
                  "Who manages Apollo Project?",
                  "Which department does Alice belong to?",
                  "Show all nodes in the workspace knowledge graph"
                ].map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => setAiQuery(q)}
                    className="text-[10px] font-semibold px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-550 dark:text-slate-405 border border-slate-250 dark:border-slate-850 transition cursor-pointer"
                  >
                    "{q}"
                  </button>
                ))}
              </div>
            </div>

            {/* Terminal output console */}
            {(aiCypher || aiOutput || aiRunning) && (
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 font-mono text-xs text-indigo-400 space-y-2.5">
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <span>GraphRAG Reasoning Console</span>
                </div>
                
                {aiRunning ? (
                  <div className="flex items-center gap-2 text-slate-400 animate-pulse">
                    <span className="h-2 w-2 rounded-full bg-indigo-500"></span>
                    Running LLM Cypher translator and executing graph search...
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    <div className="space-y-1">
                      <p className="text-slate-500 text-[9px] font-bold uppercase tracking-wider">// 1. Generated Cypher Query</p>
                      <p className="text-cyan-400 break-all bg-slate-900/60 p-2 rounded border border-slate-900">{aiCypher}</p>
                    </div>
                    
                    <div className="space-y-1">
                      <p className="text-slate-500 text-[9px] font-bold uppercase tracking-wider">// 2. Database Graph Results</p>
                      {aiOutput && aiOutput.results && aiOutput.results.length > 0 ? (
                        <pre className="text-indigo-300 bg-slate-900/40 p-2.5 border border-slate-900 rounded-lg overflow-x-auto whitespace-pre-wrap text-[10px]">
                          {JSON.stringify(aiOutput.results, null, 2)}
                        </pre>
                      ) : aiOutput && aiOutput.error ? (
                        <p className="text-rose-405">{aiOutput.error}</p>
                      ) : (
                        <p className="text-slate-400 italic text-[10px]">No direct database matching paths found.</p>
                      )}
                    </div>

                    <div className="space-y-1 border-t border-slate-900 pt-2.5">
                      <p className="text-slate-550 text-[9px] font-bold uppercase tracking-wider">// 3. Synthesized Natural Language Answer</p>
                      <p className="text-emerald-400 font-semibold bg-emerald-950/20 p-2.5 rounded border border-emerald-900/20 leading-relaxed text-[11px]">
                        {aiOutput && aiOutput.answer ? aiOutput.answer : "No answer synthesized."}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
