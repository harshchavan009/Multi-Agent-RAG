"use client";

import React, { useState, useEffect } from "react";
import { apiFetch } from "../utils/api";
import { Activity, BarChart, LineChart, TrendingUp, RefreshCw, Trash2, Cpu } from "lucide-react";

interface AnalyticsLogItem {
  id: string;
  workspace_id: string;
  query: string;
  tokens_consumed: number;
  cost_usd: number;
  latency_ms: number;
  agent_visited: string;
  created_at: string;
}

export default function AnalyticsLogsPage() {
  const workspaceId = "8501bde6-222d-42d6-9d75-ae480447a0c0";
  
  const [logs, setLogs] = useState<AnalyticsLogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = () => {
    setLoading(true);
    apiFetch(`/analytics-logs/?workspace_id=${workspaceId}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setLogs(data);
        }
      })
      .finally(() => setLoading(false));
  };

  const handleDeleteLog = async (id: string) => {
    if (!confirm("Are you sure you want to delete this telemetry log?")) return;
    setDeletingId(id);
    try {
      const res = await apiFetch(`/analytics-logs/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        fetchLogs();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  };

  // Compute metrics summaries
  const totalCost = logs.reduce((sum, item) => sum + item.cost_usd, 0);
  const avgLatency = logs.length > 0 ? Math.round(logs.reduce((sum, item) => sum + item.latency_ms, 0) / logs.length) : 0;
  const totalTokens = logs.reduce((sum, item) => sum + item.tokens_consumed, 0);

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto w-full">
      <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">System Telemetry & Metrics</h2>
          <p className="text-xs text-slate-500 mt-1">Cross-tenant operational metrics and multi-agent execution analytics.</p>
        </div>
        <button
          onClick={fetchLogs}
          className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 transition"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-6 rounded-2xl space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 font-bold">Estimated SLA Cost</h4>
            <BarChart className="h-4.5 w-4.5 text-indigo-500" />
          </div>
          <p className="text-xs text-slate-455 dark:text-slate-400 font-bold">
            Total tokens cost: <strong className="text-sm text-slate-800 dark:text-slate-100 font-extrabold">${totalCost.toFixed(5)} USD</strong>
          </p>
        </div>

        <div className="glass-card p-6 rounded-2xl space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 font-bold">Average Run Latency</h4>
            <TrendingUp className="h-4.5 w-4.5 text-indigo-500" />
          </div>
          <p className="text-xs text-slate-455 dark:text-slate-400 font-bold">
            Execution speed: <strong className="text-sm text-slate-800 dark:text-slate-100 font-extrabold">{avgLatency} ms / agent</strong>
          </p>
        </div>

        <div className="glass-card p-6 rounded-2xl space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 font-bold">Cumulative Tokens</h4>
            <Activity className="h-4.5 w-4.5 text-indigo-500" />
          </div>
          <p className="text-xs text-slate-455 dark:text-slate-400 font-bold">
            Total tokens processed: <strong className="text-sm text-slate-800 dark:text-slate-100 font-extrabold">{totalTokens.toLocaleString()}</strong>
          </p>
        </div>
      </div>

      {loading && (
        <div className="flex gap-2 items-center justify-center p-12 text-slate-400">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span className="text-xs font-bold">Loading agent execution telemetry...</span>
        </div>
      )}

      {!loading && (
        <div className="glass-card rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 bg-slate-50 dark:bg-slate-900/30">
                <th className="p-4 font-semibold">User Query</th>
                <th className="p-4 font-semibold">Active Agent Node</th>
                <th className="p-4 font-semibold">Tokens consumed</th>
                <th className="p-4 font-semibold">Execution Latency</th>
                <th className="p-4 font-semibold">Calculated Cost</th>
                <th className="p-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80">
              {logs.map((log) => (
                <tr key={log.id} className="text-slate-700 dark:text-slate-300 hover:bg-slate-50/30 dark:hover:bg-slate-900/10 transition">
                  <td className="p-4 font-bold max-w-xs truncate">{log.query}</td>
                  <td className="p-4">
                    <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-250 dark:border-slate-700/80 font-bold text-[10px] text-slate-500 uppercase tracking-wider">
                      {log.agent_visited}
                    </span>
                  </td>
                  <td className="p-4 font-bold text-slate-500">{log.tokens_consumed}</td>
                  <td className="p-4 font-bold text-slate-500">{log.latency_ms} ms</td>
                  <td className="p-4 font-bold text-emerald-600 dark:text-emerald-450">${log.cost_usd.toFixed(5)}</td>
                  <td className="p-4 text-right">
                    {deletingId === log.id ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin inline text-slate-400" />
                    ) : (
                      <button
                        onClick={() => handleDeleteLog(log.id)}
                        className="text-slate-400 hover:text-rose-500 transition px-2 py-1"
                      >
                        <Trash2 className="h-4 w-4 inline" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
