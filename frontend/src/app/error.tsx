"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home, ChevronRight, ChevronDown, Terminal } from "lucide-react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorBoundary({ error, reset }: ErrorProps) {
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Log details to observability endpoint or console
    console.error("[Global Error Boundary] Caught exception:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6 relative overflow-hidden transition-colors duration-200">
      
      {/* Background glowing rings */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-rose-500/5 via-transparent to-transparent blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-lg text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
        
        {/* Glowing caution indicator */}
        <div className="relative flex justify-center py-2">
          <div className="absolute -inset-1 rounded-full bg-rose-500 blur-xl opacity-10 animate-pulse" />
          <div className="relative h-20 w-20 rounded-2xl bg-card border border-border flex items-center justify-center shadow-xl">
            <AlertTriangle className="h-10 w-10 text-rose-500 animate-bounce" style={{ animationDuration: '3.5s' }} />
          </div>
        </div>

        {/* Informative text copy */}
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase text-rose-500 tracking-widest font-mono">PIPELINE RUNTIME FAULT</p>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl text-slate-800 dark:text-white">
            Node Execution Interrupted
          </h1>
          <p className="text-xs text-slate-550 dark:text-slate-400 max-w-sm mx-auto leading-relaxed font-semibold">
            The supervisor process encountered an unhandled execution pipeline exception. The active session was paused safely.
          </p>
        </div>

        {/* Expandable Technical Log Drawer */}
        <div className="glass-panel border border-border rounded-xl overflow-hidden text-left bg-card/40">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full px-4 py-3 flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
          >
            <span className="flex items-center gap-1.5 font-mono">
              <Terminal className="h-3.5 w-3.5 text-rose-500" />
              Runtime Error Trace
            </span>
            <span className="flex items-center gap-1">
              {showDetails ? "Hide Log" : "View Log"}
              {showDetails ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </span>
          </button>

          {showDetails && (
            <div className="px-4 pb-4 pt-1.5 border-t border-border/40 font-mono text-[10px] space-y-2 select-text overflow-x-auto max-h-40">
              <p className="text-rose-500 font-bold">{error.message || "Unknown execution exception."}</p>
              {error.digest && (
                <p className="text-slate-500 dark:text-slate-655 font-semibold">Digest: {error.digest}</p>
              )}
              <p className="text-slate-550 dark:text-slate-500 text-[9px] leading-relaxed break-all whitespace-pre-wrap">
                {error.stack || "Stack trace unavailable. Checked logs inside browser devtools context."}
              </p>
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={reset}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-650 hover:bg-indigo-500 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white text-xs font-bold px-6 py-3 rounded-xl transition duration-150 shadow-md hover:shadow-indigo-500/20 cursor-pointer"
          >
            <RefreshCw className="h-4 w-4" /> Retry Node Execution
          </button>
          <Link
            href="/dashboard"
            className="w-full sm:w-auto flex items-center justify-center gap-2 border border-border hover:bg-card-hover/40 text-slate-600 dark:text-slate-350 text-xs font-bold px-6 py-3 rounded-xl transition duration-150 cursor-pointer"
          >
            <Home className="h-4 w-4" /> Back to Safety
          </Link>
        </div>

      </div>
    </div>
  );
}
