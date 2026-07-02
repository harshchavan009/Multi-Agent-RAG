import React from "react";

// Helper for quick shimmering block
export function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div className={`skeleton-shimmer rounded-xl bg-slate-200/50 dark:bg-slate-800/40 ${className}`} />
  );
}

// 1. Dashboard Skeleton
export function DashboardSkeleton() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground animate-pulse p-6 space-y-6">
      {/* KPI Rail Placeholders */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="glass-panel p-4 rounded-2xl flex items-center justify-between border border-border">
            <div className="space-y-2 flex-1 min-w-0">
              <SkeletonBlock className="h-2 w-16" />
              <SkeletonBlock className="h-5 w-24" />
              <SkeletonBlock className="h-2.5 w-8" />
            </div>
            <SkeletonBlock className="h-8 w-12 shrink-0" />
          </div>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left column - Agent Execution */}
        <div className="col-span-12 lg:col-span-4 glass-panel border border-border rounded-2xl p-5 space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-border">
            <SkeletonBlock className="h-4 w-28" />
            <SkeletonBlock className="h-3 w-16" />
          </div>
          <div className="space-y-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <SkeletonBlock className="h-7 w-7 rounded-lg" />
                    <div className="space-y-1">
                      <SkeletonBlock className="h-3 w-20" />
                      <SkeletonBlock className="h-2 w-12" />
                    </div>
                  </div>
                  <SkeletonBlock className="h-4.5 w-12 rounded-full" />
                </div>
                <SkeletonBlock className="h-2.5 w-full pl-9" />
                <div className="pl-9 flex items-center gap-2">
                  <SkeletonBlock className="h-1 flex-1 rounded-full" />
                  <SkeletonBlock className="h-2 w-6" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Center column - Workflows & Charts */}
        <div className="col-span-12 lg:col-span-5 flex flex-col gap-6">
          {/* Workflows */}
          <div className="glass-panel border border-border rounded-2xl p-5 space-y-4 flex-1">
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <SkeletonBlock className="h-4 w-32" />
              <SkeletonBlock className="h-3 w-12" />
            </div>
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <SkeletonBlock className="h-3 w-36" />
                    <SkeletonBlock className="h-4.5 w-14 rounded-full" />
                  </div>
                  <SkeletonBlock className="h-1.5 w-full" />
                  <SkeletonBlock className="h-2 w-28" />
                </div>
              ))}
            </div>
          </div>

          {/* Charts area */}
          <div className="glass-panel border border-border rounded-2xl p-5 space-y-4">
            <SkeletonBlock className="h-4 w-40" />
            <SkeletonBlock className="h-20 w-full" />
          </div>
        </div>

        {/* Right column - Knowledge Graph & documents */}
        <div className="col-span-12 lg:col-span-3 glass-panel border border-border rounded-2xl p-5 space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-border">
            <SkeletonBlock className="h-4 w-32" />
            <SkeletonBlock className="h-3 w-10" />
          </div>
          <SkeletonBlock className="h-28 w-full" />
          
          <div className="space-y-3 pt-2">
            <SkeletonBlock className="h-4 w-28" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between">
                  <SkeletonBlock className="h-3 w-28" />
                  <SkeletonBlock className="h-3.5 w-10 rounded-full" />
                </div>
                <SkeletonBlock className="h-1 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// 2. Chat Workspace Skeleton
export function ChatSkeleton() {
  return (
    <div className="flex-1 flex overflow-hidden h-[calc(100vh-4rem)] bg-background text-foreground animate-pulse">
      {/* Sidebar history */}
      <aside className="w-64 border-r border-border bg-card flex flex-col p-4 space-y-4 hidden md:flex shrink-0">
        <SkeletonBlock className="h-9 w-full" />
        <div className="space-y-2 flex-1 pt-2">
          <SkeletonBlock className="h-2 w-24 mb-3" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="p-3 border border-border rounded-xl space-y-2">
              <SkeletonBlock className="h-3.5 w-32" />
              <SkeletonBlock className="h-2.5 w-16" />
            </div>
          ))}
        </div>
      </aside>

      {/* Chat messages layout */}
      <div className="flex-1 flex flex-col justify-between">
        <header className="h-14 border-b border-border px-6 flex items-center justify-between bg-card shrink-0">
          <SkeletonBlock className="h-4 w-36" />
          <div className="flex gap-2">
            <SkeletonBlock className="h-7 w-28" />
            <SkeletonBlock className="h-7 w-28" />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-8 space-y-8 bg-slate-50/10 dark:bg-slate-950/10">
          <div className="max-w-3xl mx-auto space-y-8">
            {/* User message skeleton */}
            <div className="flex justify-end gap-3">
              <div className="space-y-2 max-w-xl text-right">
                <SkeletonBlock className="h-12 w-64 rounded-2xl rounded-br-none" />
              </div>
              <SkeletonBlock className="h-8 w-8 rounded-lg shrink-0" />
            </div>

            {/* AI message skeleton with reasoning steps */}
            <div className="flex justify-start gap-3">
              <SkeletonBlock className="h-8 w-8 rounded-lg shrink-0" />
              <div className="space-y-3 flex-1 max-w-xl">
                {/* Reasoning timeline */}
                <div className="glass-panel p-4 border border-border rounded-2xl space-y-2.5">
                  <SkeletonBlock className="h-3 w-40" />
                  <div className="space-y-2 pl-2">
                    <SkeletonBlock className="h-3 w-48" />
                    <SkeletonBlock className="h-3 w-36" />
                    <SkeletonBlock className="h-3 w-52" />
                  </div>
                </div>
                {/* Text bubble */}
                <SkeletonBlock className="h-24 w-full rounded-2xl rounded-bl-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Input box placeholder */}
        <div className="p-6 border-t border-border bg-card shrink-0">
          <div className="max-w-3xl mx-auto">
            <SkeletonBlock className="h-20 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

// 3. Table / Directory Skeleton
export function TableSkeleton() {
  return (
    <div className="space-y-4 animate-pulse w-full">
      <div className="flex justify-between items-center border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <SkeletonBlock className="h-8 w-44" />
          <SkeletonBlock className="h-6 w-28" />
        </div>
        <SkeletonBlock className="h-8 w-32" />
      </div>
      <div className="space-y-2.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="p-4 border border-border rounded-xl flex items-center justify-between bg-card">
            <div className="flex items-center gap-3">
              <SkeletonBlock className="h-10 w-10 rounded-xl" />
              <div className="space-y-2">
                <SkeletonBlock className="h-4 w-48" />
                <div className="flex items-center gap-3">
                  <SkeletonBlock className="h-2.5 w-16" />
                  <SkeletonBlock className="h-2.5 w-24" />
                </div>
              </div>
            </div>
            <SkeletonBlock className="h-6 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
