"use client";

import React, { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { 
  Cpu, 
  Database, 
  Workflow, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Zap, 
  RefreshCw 
} from "lucide-react";

interface Toast {
  id: string;
  type: "agent" | "document" | "workflow";
  title: string;
  message: string;
  status: "running" | "completed" | "failed" | "processing";
  timestamp: Date;
}

export default function RealTimeNotifier() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const connectWs = () => {
    if (typeof window === "undefined") return;

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (e) {}
    }

    const host = window.location.hostname;
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const port = window.location.port === "3000" ? ":8000" : (window.location.port ? `:${window.location.port}` : "");
    const wsUrl = `${protocol}://${host}${port}/ws`;
    
    console.log(`[RealTimeNotifier] Connecting to WS: ${wsUrl}`);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[RealTimeNotifier] WebSocket connected.");
      setWsConnected(true);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("[RealTimeNotifier] Received WS event:", data);

        const id = `${data.type}-${data.agent_name || data.document_name || data.workflow_id}`;
        
        setToasts((prev) => {
          // Check if toast already exists to perform inplace updates
          const exists = prev.some((t) => t.id === id);

          if (data.type === "agent_running") {
            const newToast: Toast = {
              id,
              type: "agent",
              title: "Agent Initiated",
              message: `Worker node "${data.agent_name}" has started task loops.`,
              status: "running",
              timestamp: new Date()
            };
            
            // Auto dismiss running agent notifications after 4.5 seconds
            setTimeout(() => removeToast(id), 4500);

            if (exists) {
              return prev.map((t) => (t.id === id ? newToast : t));
            }
            return [newToast, ...prev];
          } 
          
          else if (data.type === "document_indexed") {
            let message = "";
            let status: Toast["status"] = "processing";
            let title = "Document Ingestion";

            if (data.status === "processing") {
              message = `Vectorizing and chunking "${data.document_name}"...`;
              status = "processing";
            } else if (data.status === "completed") {
              message = `"${data.document_name}" successfully indexed into Qdrant store.`;
              status = "completed";
              title = "Indexing Completed";
              // Auto dismiss success toasts after 6 seconds
              setTimeout(() => removeToast(id), 6000);
            } else {
              message = `Failed to process document "${data.document_name}".`;
              status = "failed";
              title = "Ingestion Failed";
              setTimeout(() => removeToast(id), 8000);
            }

            const newToast: Toast = {
              id,
              type: "document",
              title,
              message,
              status,
              timestamp: new Date()
            };

            if (exists) {
              return prev.map((t) => (t.id === id ? newToast : t));
            }
            return [newToast, ...prev];
          } 
          
          else if (data.type === "workflow_started" || data.type === "workflow_completed") {
            const isCompleted = data.type === "workflow_completed";
            const newToast: Toast = {
              id,
              type: "workflow",
              title: isCompleted ? "Workflow Completed" : "Workflow Pipeline Run",
              message: isCompleted
                ? `Workflow "${data.workflow_name}" executed successfully (${data.logs_count} node logs created).`
                : `Triggering node executions for "${data.workflow_name}"...`,
              status: isCompleted ? "completed" : "running",
              timestamp: new Date()
            };

            if (isCompleted) {
              setTimeout(() => removeToast(id), 6500);
            }

            if (exists) {
              return prev.map((t) => (t.id === id ? newToast : t));
            }
            return [newToast, ...prev];
          }

          return prev;
        });
      } catch (err) {
        console.error("[RealTimeNotifier] Error parsing WS event:", err);
      }
    };

    ws.onclose = () => {
      console.log("[RealTimeNotifier] WebSocket closed. Retrying in 3.5s...");
      setWsConnected(false);
      reconnectTimeoutRef.current = setTimeout(connectWs, 3500);
    };

    ws.onerror = (err) => {
      console.warn("[RealTimeNotifier] WebSocket error (expected during backend reloads):", err);
      ws.close();
    };
  };

  useEffect(() => {
    connectWs();
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, []);

  const getIcon = (toast: Toast) => {
    if (toast.status === "completed") {
      return <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />;
    }
    if (toast.status === "failed") {
      return <AlertCircle className="h-5 w-5 text-rose-500 shrink-0" />;
    }
    
    switch (toast.type) {
      case "agent":
        return <Cpu className="h-5 w-5 text-purple-500 animate-pulse shrink-0" />;
      case "document":
        return <Database className="h-5 w-5 text-indigo-500 animate-bounce shrink-0" />;
      case "workflow":
        return <Workflow className="h-5 w-5 text-cyan-500 animate-pulse shrink-0" />;
    }
  };

  const getBorderColor = (toast: Toast) => {
    if (toast.status === "completed") return "border-emerald-500/40";
    if (toast.status === "failed") return "border-rose-500/40";
    if (toast.status === "processing") return "border-indigo-500/30";
    
    switch (toast.type) {
      case "agent": return "border-purple-500/35";
      case "document": return "border-indigo-500/35";
      case "workflow": return "border-cyan-500/35";
    }
  };

  const getGlowColor = (toast: Toast) => {
    if (toast.status === "completed") return "rgba(16, 185, 129, 0.15)";
    if (toast.status === "failed") return "rgba(244, 63, 94, 0.15)";
    
    switch (toast.type) {
      case "agent": return "rgba(168, 85, 247, 0.15)";
      case "document": return "rgba(99, 102, 241, 0.15)";
      case "workflow": return "rgba(6, 182, 212, 0.15)";
    }
  };

  return (
    <>
      {/* WS Status Badge (Subtle dot in top-right or just console connection) */}
      <div className="fixed bottom-4 right-4 z-[9999] opacity-40 hover:opacity-100 transition-opacity pointer-events-none md:pointer-events-auto">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/80 dark:bg-slate-950/80 border border-slate-800 text-[9px] font-bold tracking-wider uppercase">
          <span className={`h-1.5 w-1.5 rounded-full ${wsConnected ? "bg-emerald-500 animate-ping" : "bg-rose-500 animate-pulse"}`}></span>
          <span className="text-slate-400">Live Engine Connection</span>
        </div>
      </div>

      {/* Floating Notifications List */}
      <div className="fixed top-5 right-5 z-[99999] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, y: 15 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className={`pointer-events-auto p-4 rounded-xl backdrop-blur-md bg-slate-900/90 dark:bg-slate-950/90 border flex items-start gap-3.5 shadow-2xl relative overflow-hidden ${getBorderColor(toast)}`}
              style={{
                boxShadow: `0 10px 30px -10px rgba(0,0,0,0.5), 0 0 15px ${getGlowColor(toast)}`
              }}
            >
              {/* Spinning/pulsing highlight light bar */}
              {toast.status !== "completed" && toast.status !== "failed" && (
                <div className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-500 to-transparent animate-pulse" />
              )}

              {getIcon(toast)}

              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex justify-between items-start gap-2">
                  <h4 className="text-xs font-black tracking-tight text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    {toast.title}
                    {toast.status === "processing" && (
                      <RefreshCw className="h-3 w-3 animate-spin text-indigo-400" />
                    )}
                  </h4>
                  <button 
                    onClick={() => removeToast(toast.id)}
                    className="p-0.5 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition shrink-0"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-450 leading-relaxed font-semibold">
                  {toast.message}
                </p>
                <span className="text-[9px] text-slate-400/70 font-semibold block pt-1">
                  {toast.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}
