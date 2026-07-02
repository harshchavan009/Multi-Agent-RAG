"use client";

import React from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6 relative overflow-hidden transition-colors duration-200">
      
      {/* Background radial gradients */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-500/10 via-transparent to-transparent blur-3xl" />
        <div className="absolute top-1/4 left-1/3 w-[300px] h-[300px] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-cyan-500/5 via-transparent to-transparent blur-2xl" />
      </div>

      <div className="relative z-10 w-full max-w-lg text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
        
        {/* Floating lost node animation */}
        <div className="relative flex justify-center py-4">
          <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400 blur-xl opacity-20 animate-pulse" />
          <div className="relative h-24 w-24 rounded-3xl bg-card border border-border flex items-center justify-center shadow-2xl">
            <svg viewBox="0 0 100 100" className="h-16 w-16 text-indigo-500" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Lost node orbit */}
              <circle cx="50" cy="50" r="30" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 6" className="animate-spin" style={{ animationDuration: '10s' }} />
              <circle cx="50" cy="50" r="15" stroke="currentColor" strokeWidth="1" strokeDasharray="2 3" />
              {/* Satellites */}
              <circle cx="50" cy="20" r="4.5" fill="currentColor" />
              <circle cx="20" cy="65" r="3" fill="#06b6d4" />
              <circle cx="75" cy="60" r="3.5" fill="#f43f5e" />
              {/* Center */}
              <circle cx="50" cy="50" r="5" fill="currentColor" />
            </svg>
          </div>
        </div>

        {/* Text copy */}
        <div className="space-y-3">
          <p className="text-[10px] font-black uppercase text-indigo-500 tracking-widest font-mono">ERROR CODE 404</p>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl text-slate-800 dark:text-white">
            Lost in the Knowledge Graph
          </h1>
          <p className="text-xs text-slate-550 dark:text-slate-400 max-w-sm mx-auto leading-relaxed font-semibold">
            The operational model node or dashboard path you requested could not be resolved by the supervisor router context.
          </p>
        </div>

        {/* Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={() => window.history.back()}
            className="w-full sm:w-auto flex items-center justify-center gap-2 border border-border hover:bg-card-hover/40 text-slate-600 dark:text-slate-350 text-xs font-bold px-6 py-3 rounded-xl transition duration-150 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" /> Go Back
          </button>
          <Link
            href="/dashboard"
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-650 hover:bg-indigo-500 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white text-xs font-bold px-6 py-3 rounded-xl transition duration-150 shadow-md hover:shadow-indigo-500/20 cursor-pointer"
          >
            <Home className="h-4 w-4" /> Operations Center
          </Link>
        </div>

      </div>
    </div>
  );
}
