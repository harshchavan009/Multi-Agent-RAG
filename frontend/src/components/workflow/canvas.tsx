"use client";

import React, { useState } from "react";
import { Play, Settings, Database, Mail, Webhook, ArrowRight, Server, AlertCircle } from "lucide-react";

interface Node {
  id: string;
  name: string;
  type: string;
  x: number;
  y: number;
  icon: any;
  status?: string;
}

export default function WorkflowCanvas() {
  const [nodes, setNodes] = useState<Node[]>([
    { id: "1", name: "Document Uploaded Trigger", type: "trigger", x: 80, y: 150, icon: Webhook, status: "active" },
    { id: "2", name: "Policy Evaluation Node", type: "agent", x: 340, y: 80, icon: Server, status: "active" },
    { id: "3", name: "Database Store Metadata", type: "database", x: 340, y: 220, icon: Database, status: "pending" },
    { id: "4", name: "Slack Warning Alert", type: "email", x: 600, y: 150, icon: Mail, status: "idle" },
  ]);

  const [activeNode, setActiveNode] = useState<Node | null>(nodes[0]);

  // Handle simple node clicking and movement emulations
  const selectNode = (node: Node) => {
    setActiveNode(node);
  };

  return (
    <div className="flex-1 flex overflow-hidden border border-slate-800/80 rounded-2xl bg-slate-950/40 relative">
      {/* Visual Canvas Board Grid */}
      <div className="flex-1 relative overflow-hidden bg-[radial-gradient(rgba(255,255,255,0.03)_1.5px,transparent_1.5px)] bg-[size:24px_24px] p-6 min-h-[480px]">
        {/* Draw Connection Paths using SVG lines */}
        <svg className="absolute inset-0 h-full w-full pointer-events-none">
          {/* Path 1 -> 2 */}
          <path d="M 230 190 Q 285 190 285 120 T 340 120" fill="none" stroke="#6366f1" strokeWidth="2" strokeDasharray="4" className="animate-[dash_10s_linear_infinite]" />
          {/* Path 1 -> 3 */}
          <path d="M 230 190 Q 285 190 285 260 T 340 260" fill="none" stroke="#6366f1" strokeWidth="2" />
          {/* Path 2 -> 4 */}
          <path d="M 490 120 Q 545 120 545 190 T 600 190" fill="none" stroke="#10b981" strokeWidth="2" />
          {/* Path 3 -> 4 */}
          <path d="M 490 260 Q 545 260 545 190 T 600 190" fill="none" stroke="#10b981" strokeWidth="2" />
        </svg>

        {/* Nodes layer */}
        {nodes.map((node) => {
          const Icon = node.icon;
          const isActive = activeNode?.id === node.id;
          
          return (
            <div
              key={node.id}
              onClick={() => selectNode(node)}
              style={{ left: `${node.x}px`, top: `${node.y}px` }}
              className={`absolute p-4 rounded-xl border w-52 cursor-pointer transition select-none glass-card ${
                isActive 
                  ? "border-indigo-500/80 shadow-glow" 
                  : "border-slate-800/80 hover:border-slate-700"
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <span className={`text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold ${
                  node.type === "trigger" 
                    ? "bg-indigo-500/10 text-indigo-400" 
                    : node.type === "agent" 
                    ? "bg-purple-500/10 text-purple-400"
                    : "bg-emerald-500/10 text-emerald-400"
                }`}>
                  {node.type}
                </span>
                
                <span className={`h-2 w-2 rounded-full ${
                  node.status === "active" 
                    ? "bg-emerald-400" 
                    : node.status === "pending" 
                    ? "bg-amber-400" 
                    : "bg-slate-600"
                }`} />
              </div>

              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-slate-800/80 flex items-center justify-center text-slate-300">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-[11px] font-bold text-slate-200 line-clamp-1">{node.name}</h4>
                  <p className="text-[9px] text-slate-500">ID: {node.id}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Side Details Inspector Panel */}
      {activeNode && (
        <aside className="w-80 border-l border-slate-800 bg-slate-900/15 p-6 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-6">
            <div className="pb-3 border-b border-slate-800 flex justify-between items-center">
              <h3 className="font-bold text-sm text-slate-200">Node Configuration</h3>
              <Settings className="h-4 w-4 text-slate-500" />
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Node Name</span>
                <input
                  type="text"
                  value={activeNode.name}
                  onChange={(e) => {
                    const newNodes = nodes.map(n => n.id === activeNode.id ? { ...n, name: e.target.value } : n);
                    setNodes(newNodes);
                    setActiveNode({ ...activeNode, name: e.target.value });
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:border-indigo-500/50 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Routing Trigger URL</span>
                <input
                  type="text"
                  disabled
                  value={activeNode.type === "trigger" ? "https://api.platform.net/v1/webhooks/document" : "http://localhost:8000/api/v1/workflows/"}
                  className="w-full bg-slate-900/60 border border-slate-800/80 rounded-lg px-3 py-2 text-[10px] text-slate-500 focus:outline-none"
                />
              </div>

              <div className="space-y-2">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Metadata Fields</span>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 space-y-1.5">
                  <div className="flex justify-between text-[9px] text-slate-400">
                    <span>Retry Limit</span>
                    <span>3 times</span>
                  </div>
                  <div className="flex justify-between text-[9px] text-slate-400">
                    <span>Timeout SLA</span>
                    <span>5000ms</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-800/80 space-y-3">
            <button className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold py-2.5 rounded-xl transition shadow-glow">
              <Play className="h-4 w-4" /> Run Live Node
            </button>
            <div className="flex items-start gap-2 text-[9px] text-slate-500">
              <AlertCircle className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
              <span>Canvas nodes are synchronized in real-time with the local FastAPI workflow executor service.</span>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
