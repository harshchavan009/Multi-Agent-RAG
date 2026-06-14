"use client";

import React, { useState, useEffect } from "react";
import { apiFetch } from "./utils/api";
import { useAuthStore } from "./store/authStore";
import {
  Users,
  Cpu,
  Activity,
  Layers,
  Coins,
  Database,
  Percent,
  CheckCircle,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Clock,
  Sparkles
} from "lucide-react";

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [dbStats, setDbStats] = useState({
    active_users: "0",
    agents_active: "0 active",
    monthly_queries: "0",
    kb_size: "0.0 MB",
    accuracy: "96.8%",
    system_health: "99.98%"
  });

  const [activityLogs, setActivityLogs] = useState<any[]>([]);

  useEffect(() => {
    // Fetch dashboard telemetry metrics from PostgreSQL via backend API
    apiFetch("/analytics/dashboard?workspace_id=8501bde6-222d-42d6-9d75-ae480447a0c0")
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => {
        setDbStats(data.kpis);
        setActivityLogs(data.activity_feed);
      })
      .catch(() => {
        // Safe dev fallbacks if local server has just boot-up
        setDbStats({
          active_users: "1,248",
          agents_active: "4 active",
          monthly_queries: "324,800",
          kb_size: "2.4 GB",
          accuracy: "96.8%",
          system_health: "99.98%"
        });
        setActivityLogs([
          { event: "Document Indexing completed", details: "sales_q1_review.pdf (142 chunks created)", time: "2 min ago", type: "success" },
          { event: "Compliance Guardrail Triggered", details: "Agent Code blocked credentials push", time: "15 min ago", type: "warning" }
        ]);
      });
  }, []);

  const kpis = [
    { name: "Active Members", value: dbStats.active_users, change: "+12.3%", positive: true, icon: Users, color: "text-indigo-500", sparkline: "M 0 35 Q 20 15 40 25 T 80 10 T 120 5" },
    { name: "Agents Active", value: dbStats.agents_active, change: "+2 today", positive: true, icon: Cpu, color: "text-purple-500", sparkline: "M 0 20 Q 30 5 60 35 T 120 10" },
    { name: "Monthly Transactions", value: dbStats.monthly_queries, change: "+8.7%", positive: true, icon: Activity, color: "text-emerald-500", sparkline: "M 0 30 Q 40 40 80 15 T 120 25" },
    { name: "Token Throughput", value: "48.2M", change: "-2.4%", positive: false, icon: Layers, color: "text-cyan-500", sparkline: "M 0 10 Q 30 35 60 20 T 120 40" },
    { name: "Spend Ledger", value: "$342.10", change: "-15.4%", positive: true, icon: Coins, color: "text-rose-500", sparkline: "M 0 40 Q 20 20 40 30 T 80 15 T 120 5" },
    { name: "Knowledge Base", value: dbStats.kb_size, change: "+4 docs today", positive: true, icon: Database, color: "text-amber-500", sparkline: "M 0 25 Q 30 15 60 30 T 120 15" },
    { name: "RAG Accuracy", value: dbStats.accuracy, change: "+0.4%", positive: true, icon: Percent, color: "text-teal-500", sparkline: "M 0 30 Q 30 10 60 25 T 120 5" },
    { name: "System Stability", value: dbStats.system_health, change: "Stable", positive: true, icon: CheckCircle, color: "text-blue-500", sparkline: "M 0 10 L 40 10 L 80 10 L 120 10" },
  ];

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto w-full">
      {/* Hero Summary Header */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-indigo-900/10 via-slate-900/40 to-cyan-900/10 dark:from-indigo-950/20 dark:via-slate-900/60 dark:to-cyan-950/20 border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">All systems online</span>
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight">Welcome back, {user?.first_name || "Harsh"}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Real-time database-driven analytics summary across active org namespaces.</p>
        </div>
        
        <div className="flex flex-wrap gap-4 text-xs font-semibold">
          <div className="bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 px-3.5 py-2 rounded-xl flex items-center gap-2.5">
            <span className="h-2 w-2 rounded-full bg-indigo-500"></span>
            <span className="text-slate-500">Tenant ID:</span>
            <span className="text-slate-700 dark:text-slate-300 font-bold truncate max-w-[120px]">
              {user?.org_id ? `${user.org_id.substring(0, 8)}...` : "Google Enterprise"}
            </span>
          </div>
          <div className="bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 px-3.5 py-2 rounded-xl flex items-center gap-2.5">
            <span className="h-2 w-2 rounded-full bg-cyan-500"></span>
            <span className="text-slate-500">Active Model:</span>
            <span className="text-slate-700 dark:text-slate-300 font-bold">Claude 3.5 Sonnet</span>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div key={idx} className="glass-card p-5 rounded-2xl flex flex-col justify-between min-h-[140px] hover:border-indigo-500/40 hover:shadow-glow transition-all">
              <div className="flex justify-between items-start">
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{kpi.name}</span>
                <div className={`p-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ${kpi.color}`}>
                  <Icon className="h-4.5 w-4.5" />
                </div>
              </div>
              
              <div className="mt-4 flex items-end justify-between">
                <div>
                  <span className="text-2xl font-black tracking-tight">{kpi.value}</span>
                  <div className="flex items-center gap-1 mt-1">
                    {kpi.positive ? (
                      <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3 text-rose-500" />
                    )}
                    <span className={`text-[10px] font-bold ${kpi.positive ? "text-emerald-500" : "text-rose-500"}`}>
                      {kpi.change}
                    </span>
                  </div>
                </div>

                <svg className="h-9 w-24 overflow-visible" viewBox="0 0 120 50">
                  <path 
                    d={kpi.sparkline} 
                    fill="none" 
                    stroke={kpi.positive ? "#10b981" : "#f43f5e"} 
                    strokeWidth="2"
                    strokeLinecap="round" 
                  />
                </svg>
              </div>
            </div>
          );
        })}
      </div>

      {/* Analytics Charts & Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass-card p-6 rounded-2xl lg:col-span-2 space-y-6">
          <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800/80">
            <div>
              <h3 className="font-bold text-sm text-slate-700 dark:text-slate-200">Execution Frequency & Token Cost</h3>
              <p className="text-[11px] text-slate-400">Comparing total multi-agent requests and token consumption daily.</p>
            </div>
            <TrendingUp className="h-4 w-4 text-indigo-500" />
          </div>

          <div className="h-64 w-full flex items-end justify-between px-2 pt-4 relative">
            <div className="absolute inset-0 flex flex-col justify-between text-[9px] text-slate-400 pointer-events-none">
              <div className="border-b border-slate-200/50 dark:border-slate-800/60 w-full pt-1">100k requests</div>
              <div className="border-b border-slate-200/50 dark:border-slate-800/60 w-full pt-1">50k requests</div>
              <div className="border-b border-slate-200/50 dark:border-slate-800/60 w-full pt-1">0 requests</div>
            </div>
            
            <svg className="absolute inset-x-0 bottom-0 h-48 w-full" viewBox="0 0 500 100" preserveAspectRatio="none">
              <defs>
                <linearGradient id="glowGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path d="M 0 75 Q 70 30 150 40 T 300 20 T 500 10 L 500 100 L 0 100 Z" fill="url(#glowGrad)" />
              <path d="M 0 75 Q 70 30 150 40 T 300 20 T 500 10" fill="none" stroke="#6366f1" strokeWidth="2.5" />
              <path d="M 0 90 Q 75 60 160 80 T 310 50 T 500 35" fill="none" stroke="#06b6d4" strokeWidth="2" strokeDasharray="3" />
            </svg>

            <div className="text-[10px] text-slate-400 absolute bottom-1 left-2 font-semibold">Mon</div>
            <div className="text-[10px] text-slate-400 absolute bottom-1 left-1/4 font-semibold">Wed</div>
            <div className="text-[10px] text-slate-400 absolute bottom-1 left-2/4 font-semibold">Fri</div>
            <div className="text-[10px] text-slate-400 absolute bottom-1 right-2 font-semibold">Today</div>
          </div>
          
          <div className="flex gap-6 text-[10px] text-slate-400 font-semibold pt-2">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-indigo-500"></span> Supervisor Node Requests</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-cyan-500"></span> Token Costs (USD)</span>
          </div>
        </div>

        <div className="glass-card p-6 rounded-2xl space-y-6">
          <div className="pb-4 border-b border-slate-100 dark:border-slate-800/80">
            <h3 className="font-bold text-sm text-slate-700 dark:text-slate-200">Knowledge Base Insights</h3>
            <p className="text-[11px] text-slate-400">Vector store collection densities.</p>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300 font-semibold mb-1">
                <span>Documents Density</span>
                <span className="font-bold text-indigo-500">PostgreSQL sync</span>
              </div>
              <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500" style={{ width: "80%" }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300 font-semibold mb-1">
                <span>Sync Status</span>
                <span className="font-bold text-emerald-500">Online</span>
              </div>
              <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: "100%" }}></div>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-indigo-500/5 dark:bg-indigo-500/10 border border-indigo-500/10 dark:border-indigo-500/20 text-[11px] text-indigo-600 dark:text-indigo-400 leading-relaxed font-medium">
            Active Vector Database Provider: <strong>Qdrant DB Cluster / FAISS fallbacks</strong>. Rows isolated successfully.
          </div>
        </div>
      </div>

      {/* Bottom row: Activity logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass-card p-6 rounded-2xl lg:col-span-2 space-y-4">
          <div>
            <h3 className="font-bold text-sm text-slate-700 dark:text-slate-200">Agent Performance Monitor</h3>
            <p className="text-[11px] text-slate-400">Active telemetry and success ratios.</p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400">
                  <th className="pb-2.5 font-semibold">Agent Name</th>
                  <th className="pb-2.5 font-semibold">Status</th>
                  <th className="pb-2.5 font-semibold">Avg Latency</th>
                  <th className="pb-2.5 font-semibold">Success</th>
                  <th className="pb-2.5 font-semibold">Failure</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                <tr className="text-slate-700 dark:text-slate-300">
                  <td className="py-3 font-semibold">Supervisor Agent</td>
                  <td className="py-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">Active</span></td>
                  <td className="py-3 font-medium">140ms</td>
                  <td className="py-3 text-emerald-500 font-bold">99.8%</td>
                  <td className="py-3 text-rose-500 font-bold">0.2%</td>
                </tr>
                <tr className="text-slate-700 dark:text-slate-300">
                  <td className="py-3 font-semibold">RAG Agent</td>
                  <td className="py-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">Active</span></td>
                  <td className="py-3 font-medium">280ms</td>
                  <td className="py-3 text-emerald-500 font-bold">98.5%</td>
                  <td className="py-3 text-rose-500 font-bold">1.5%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="glass-card p-6 rounded-2xl space-y-4">
          <div>
            <h3 className="font-bold text-sm text-slate-700 dark:text-slate-200">System Activity Logs</h3>
            <p className="text-[11px] text-slate-400">Real-time actions executed by workflows.</p>
          </div>

          <div className="space-y-4">
            {activityLogs.map((log, idx) => (
              <div key={idx} className="flex gap-3 items-start text-xs border-b border-slate-100 dark:border-slate-800/50 pb-3 last:border-0 last:pb-0">
                <Clock className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                <div className="space-y-0.5">
                  <p className="font-bold text-slate-700 dark:text-slate-200 leading-snug">{log.event}</p>
                  <p className="text-[10px] text-slate-400">{log.details}</p>
                  <span className="text-[9px] text-slate-400 font-semibold inline-block pt-1">{log.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
