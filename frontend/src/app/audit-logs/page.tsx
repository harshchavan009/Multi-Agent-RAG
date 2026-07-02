"use client";

import React, { useState, useEffect } from "react";
import { apiFetch } from "../utils/api";
import { FolderLock, Monitor, RefreshCw, Trash2 } from "lucide-react";

interface AuditLogItem {
  id: string;
  organization_id: string;
  user_id?: string;
  action: string;
  details: { details?: string; [key: string]: any };
  ip_address?: string;
  created_at: string;
}

import { useAuthStore } from "@/app/store/authStore";

export default function AuditLogsPage() {
  const { activeWorkspaceId } = useAuthStore();
  const workspaceId = activeWorkspaceId || "8501bde6-222d-42d6-9d75-ae480447a0c0";
  
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchLogs();
  }, [workspaceId]);

  const fetchLogs = () => {
    setLoading(true);
    apiFetch(`/audit-logs/?workspace_id=${workspaceId}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setLogs(data);
        }
      })
      .finally(() => setLoading(false));
  };

  const handleDeleteLog = async (id: string) => {
    if (!confirm("Are you sure you want to delete this audit log entry?")) return;
    setDeletingId(id);
    try {
      const res = await apiFetch(`/audit-logs/${id}`, {
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

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto w-full">
      <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">System Audit Trails</h2>
          <p className="text-xs text-slate-500 mt-1">Review organizational log audit tracks for policy compliance checking.</p>
        </div>
        <button
          onClick={fetchLogs}
          className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 transition"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {loading && (
        <div className="flex gap-2 items-center justify-center p-12 text-slate-400">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span className="text-xs font-bold">Querying System Audit logs...</span>
        </div>
      )}

      {!loading && (
        <div className="glass-card rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 bg-slate-50 dark:bg-slate-900/30">
                <th className="p-4 font-semibold">Action Trigger</th>
                <th className="p-4 font-semibold">Audit Details</th>
                <th className="p-4 font-semibold">IP Address</th>
                <th className="p-4 font-semibold">Timestamp</th>
                <th className="p-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80">
              {logs.map((log) => (
                <tr key={log.id} className="text-slate-700 dark:text-slate-300 hover:bg-slate-50/30 dark:hover:bg-slate-900/10 transition">
                  <td className="p-4 flex items-center gap-2 font-bold">
                    <FolderLock className="h-4 w-4 text-indigo-500" />
                    <span>{log.action}</span>
                  </td>
                  <td className="p-4 font-medium max-w-xs truncate">
                    {log.details.details || JSON.stringify(log.details)}
                  </td>
                  <td className="p-4 flex items-center gap-1 text-slate-450 dark:text-slate-500 font-bold mt-1">
                    <Monitor className="h-3.5 w-3.5" />
                    <span>{log.ip_address || "127.0.0.1"}</span>
                  </td>
                  <td className="p-4 font-medium">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
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
