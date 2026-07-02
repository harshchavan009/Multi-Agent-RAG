import React from "react";
import { MessageSquare, Database, Workflow, Search, Plus } from "lucide-react";

interface EmptyStateProps {
  type: "chat" | "document" | "workflow" | "search" | "generic";
  title: string;
  description: string;
  actionLabel?: string;
  onActionClick?: () => void;
}

export default function EmptyState({
  type,
  title,
  description,
  actionLabel,
  onActionClick
}: EmptyStateProps) {
  const resolveIcon = () => {
    switch (type) {
      case "chat":
        return (
          <div className="h-16 w-16 rounded-3xl bg-indigo-500/10 dark:bg-indigo-500/15 flex items-center justify-center text-indigo-500 shadow-lg shadow-indigo-500/5 animate-pulse">
            <MessageSquare className="h-7 w-7" />
          </div>
        );
      case "document":
        return (
          <div className="h-16 w-16 rounded-3xl bg-cyan-500/10 dark:bg-cyan-500/15 flex items-center justify-center text-cyan-500 shadow-lg shadow-cyan-500/5">
            <Database className="h-7 w-7 animate-bounce" style={{ animationDuration: '3s' }} />
          </div>
        );
      case "workflow":
        return (
          <div className="h-16 w-16 rounded-3xl bg-violet-500/10 dark:bg-violet-500/15 flex items-center justify-center text-violet-500 shadow-lg shadow-violet-500/5">
            <Workflow className="h-7 w-7 animate-pulse" />
          </div>
        );
      case "search":
        return (
          <div className="h-16 w-16 rounded-3xl bg-slate-500/10 dark:bg-slate-500/15 flex items-center justify-center text-slate-500 shadow-lg">
            <Search className="h-7 w-7" />
          </div>
        );
      default:
        return (
          <div className="h-16 w-16 rounded-3xl bg-indigo-500/10 dark:bg-indigo-500/15 flex items-center justify-center text-indigo-500 shadow-lg">
            <MessageSquare className="h-7 w-7" />
          </div>
        );
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto space-y-5 animate-in fade-in slide-in-from-bottom-3 duration-300">
      {/* Visual Vector Icon Mark */}
      <div className="flex justify-center relative">
        {resolveIcon()}
        {/* Background glow orb */}
        <div className="absolute inset-0 bg-indigo-500/5 blur-2xl rounded-full scale-150 -z-10" />
      </div>

      {/* Structured Text Copy */}
      <div className="space-y-1.5">
        <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-200 tracking-tight">
          {title}
        </h3>
        <p className="text-xs text-slate-550 dark:text-slate-400 leading-relaxed max-w-[280px] mx-auto">
          {description}
        </p>
      </div>

      {/* Optional Interactive CTA Button */}
      {actionLabel && onActionClick && (
        <button
          onClick={onActionClick}
          className="inline-flex items-center gap-2 bg-indigo-650 hover:bg-indigo-500 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition duration-150 shadow-md hover:shadow-indigo-500/20 active:scale-95 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>{actionLabel}</span>
        </button>
      )}
    </div>
  );
}
