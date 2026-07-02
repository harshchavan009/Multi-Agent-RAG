"use client";

import React, { useState, useEffect } from "react";
import { apiFetch } from "../utils/api";
import { Key, Sliders, RefreshCw, AlertCircle, CheckCircle2, Save, Sparkles, Eye, EyeOff, LayoutTemplate } from "lucide-react";

interface SettingsData {
  openai_api_key: string;
  rag_context_limit: number;
  theme: string;
}

import { useAuthStore } from "@/app/store/authStore";

export default function SettingsPage() {
  const { activeWorkspaceId } = useAuthStore();
  const workspaceId = activeWorkspaceId || "8501bde6-222d-42d6-9d75-ae480447a0c0";

  const [settings, setSettings] = useState<SettingsData>({
    openai_api_key: "",
    rag_context_limit: 5,
    theme: "dark"
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [workspaceId]);

  const fetchSettings = () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    apiFetch(`/settings/?workspace_id=${workspaceId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load workspace settings.");
        return res.json();
      })
      .then((data) => {
        if (data) {
          setSettings({
            openai_api_key: data.openai_api_key || "",
            rag_context_limit: data.rag_context_limit || 5,
            theme: data.theme || "dark"
          });
        }
      })
      .catch((err) => {
        setError(err.message || "Failed to retrieve workspace configuration.");
      })
      .finally(() => setLoading(false));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await apiFetch("/settings/", {
        method: "POST",
        body: JSON.stringify({
          workspace_id: workspaceId,
          openai_api_key: settings.openai_api_key,
          rag_context_limit: settings.rag_context_limit,
          theme: settings.theme
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to update configuration settings.");
      }

      const data = await res.json();
      setSuccess("Workspace settings updated successfully.");
      
      // Sync document class theme if theme is changed
      const root = window.document.documentElement;
      if (data.theme === "light") {
        root.classList.add("light");
      } else {
        root.classList.remove("light");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred while saving.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8 space-y-8 max-w-4xl mx-auto w-full">
      <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">Workspace Settings</h2>
          <p className="text-xs text-slate-500 mt-1">Configure context window partition limits and API engine keys.</p>
        </div>
        <button
          onClick={fetchSettings}
          disabled={loading || saving}
          className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 transition disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Alert Notices */}
      {error && (
        <div className="p-3.5 rounded-xl border border-rose-500/10 bg-rose-500/5 text-rose-500 text-xs font-semibold leading-relaxed flex items-center gap-2.5 animate-in fade-in duration-300">
          <AlertCircle className="h-4.5 w-4.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3.5 rounded-xl border border-emerald-500/10 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 text-xs font-semibold leading-relaxed flex items-center gap-2.5 animate-in fade-in duration-300">
          <CheckCircle2 className="h-4.5 w-4.5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {loading ? (
        <div className="flex gap-2 items-center justify-center p-12 text-slate-400">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span className="text-xs font-bold">Querying configurations database...</span>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          <div className="glass-card p-6 rounded-2xl space-y-6 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
              <Key className="h-5 w-5 text-indigo-500" />
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">API Access Key</h4>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between items-center">
                <label className="font-bold text-slate-400">OpenAI API Key Token</label>
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-250 flex items-center gap-1 font-semibold"
                >
                  {showKey ? (
                    <>
                      <EyeOff className="h-3.5 w-3.5" /> Hide
                    </>
                  ) : (
                    <>
                      <Eye className="h-3.5 w-3.5" /> Show
                    </>
                  )}
                </button>
              </div>
              <input
                type={showKey ? "text" : "password"}
                value={settings.openai_api_key}
                onChange={(e) => setSettings({ ...settings, openai_api_key: e.target.value })}
                placeholder="sk-••••••••••••••••••••••••••••••••••••••••"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-slate-700 dark:text-slate-200 text-xs focus:border-indigo-500/50 focus:outline-none transition"
              />
              <p className="text-[10px] text-slate-500 mt-1">This key is used for executing LLM and Embedding synthesis workflows.</p>
            </div>
          </div>

          <div className="glass-card p-6 rounded-2xl space-y-6 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
              <Sliders className="h-5 w-5 text-indigo-500" />
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">Retrieval & Engine Guardrails</h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-400">RAG Context Limit</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={settings.rag_context_limit}
                  onChange={(e) => setSettings({ ...settings, rag_context_limit: parseInt(e.target.value) || 5 })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-slate-700 dark:text-slate-200 focus:border-indigo-500/50 focus:outline-none transition"
                />
                <p className="text-[10px] text-slate-500 mt-1">Number of similar chunks retrieved per RAG query session.</p>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-400">Active Theme Preference</label>
                <select
                  value={settings.theme}
                  onChange={(e) => setSettings({ ...settings, theme: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-slate-700 dark:text-slate-200 focus:border-indigo-500/50 focus:outline-none cursor-pointer transition"
                >
                  <option value="dark">Enterprise Slate Dark</option>
                  <option value="light">Premium Clean Light</option>
                </select>
                <p className="text-[10px] text-slate-500 mt-1">Preferred appearance setting for your active workspace.</p>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center pt-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
              <Sparkles className="h-4 w-4 text-indigo-500 animate-pulse" />
              <span>Workspace changes will apply instantly to all team members.</span>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-5 py-2.5 rounded-xl transition shadow-glow disabled:opacity-50"
            >
              {saving ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" /> Save Configurations
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

