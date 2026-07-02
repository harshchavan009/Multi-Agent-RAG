"use client";

import React, { useState, useEffect } from "react";
import { apiFetch } from "../utils/api";
import {
  HardDrive,
  BookOpen,
  GitBranch,
  Layers,
  MessageSquare,
  Briefcase,
  Cloud,
  Plug,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Save,
  Trash2,
  ArrowRight,
  Lock,
  X
} from "lucide-react";

interface IntegrationItem {
  id: string;
  name: string;
  credentials: Record<string, any>;
  is_active: boolean;
}

const TEMPLATE_ICONS: Record<string, any> = {
  google_drive: HardDrive,
  notion: BookOpen,
  github: GitBranch,
  jira: Layers,
  slack: MessageSquare,
  confluence: Briefcase,
  sharepoint: Cloud
};

const INTEGRATION_TEMPLATES = [
  {
    name: "google_drive",
    label: "Google Drive",
    description: "Index and synchronize documents, PDFs, and sheets from shared drives.",
    fields: [
      { name: "folder_id", label: "Folder ID (Optional)", type: "text", placeholder: "1A2B3C4D..." },
      { name: "api_key", label: "API Key", type: "password", placeholder: "AIzaSy..." },
      { name: "client_id", label: "OAuth Client ID", type: "text", placeholder: "xxx.apps.googleusercontent.com" }
    ],
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10"
  },
  {
    name: "notion",
    label: "Notion",
    description: "Sync databases, workspaces, and notes pages recursively.",
    fields: [
      { name: "api_key", label: "Notion Integration Secret Key", type: "password", placeholder: "secret_..." },
      { name: "workspace_name", label: "Notion Workspace Name", type: "text", placeholder: "Antigravity Workspace" }
    ],
    color: "text-slate-400",
    bgColor: "bg-slate-500/10"
  },
  {
    name: "github",
    label: "GitHub Repositories",
    description: "Crawl repository markdown files, codebases, and README readouts.",
    fields: [
      { name: "api_key", label: "Personal Access Token (classic/fine-grained)", type: "password", placeholder: "ghp_..." },
      { name: "repo", label: "Repository Path", type: "text", placeholder: "org/repo" }
    ],
    color: "text-indigo-400",
    bgColor: "bg-indigo-500/10"
  },
  {
    name: "jira",
    label: "Jira Software",
    description: "Index epics, user stories, comments, and project sprint backlogs.",
    fields: [
      { name: "url", label: "Jira Instance URL", type: "text", placeholder: "https://your-domain.atlassian.net" },
      { name: "email", label: "Account Email Address", type: "email", placeholder: "user@domain.com" },
      { name: "api_key", label: "Jira API Token", type: "password", placeholder: "ATATT3..." }
    ],
    color: "text-blue-500",
    bgColor: "bg-blue-500/10"
  },
  {
    name: "slack",
    label: "Slack Workspace",
    description: "Sync conversation histories, attachments, and alert notifications.",
    fields: [
      { name: "api_key", label: "Slack Bot User OAuth Token", type: "password", placeholder: "xoxb-..." },
      { name: "channels", label: "Monitor Channel IDs (Comma-separated)", type: "text", placeholder: "C12345,C67890" }
    ],
    color: "text-pink-500",
    bgColor: "bg-pink-500/10"
  },
  {
    name: "confluence",
    label: "Confluence Cloud",
    description: "Index space directories, document pages, and corporate wiki links.",
    fields: [
      { name: "url", label: "Confluence Cloud URL", type: "text", placeholder: "https://your-domain.atlassian.net/wiki" },
      { name: "email", label: "Account Email Address", type: "email", placeholder: "user@domain.com" },
      { name: "api_key", label: "Confluence API Token", type: "password", placeholder: "ATATT3..." }
    ],
    color: "text-cyan-500",
    bgColor: "bg-cyan-500/10"
  },
  {
    name: "sharepoint",
    label: "SharePoint Online",
    description: "Index shared folders, document lists, and folder hierarchies.",
    fields: [
      { name: "tenant_id", label: "Microsoft Entra Tenant ID", type: "text", placeholder: "00000000-0000-..." },
      { name: "client_id", label: "Application (client) ID", type: "text", placeholder: "00000000-0000-..." },
      { name: "client_secret", label: "Client Secret Value", type: "password", placeholder: "••••••••" }
    ],
    color: "text-blue-600",
    bgColor: "bg-blue-600/10"
  }
];

import { useAuthStore } from "@/app/store/authStore";

export default function IntegrationsPage() {
  const { activeWorkspaceId } = useAuthStore();
  const workspaceId = activeWorkspaceId || "8501bde6-222d-42d6-9d75-ae480447a0c0";

  const [activeConfig, setActiveConfig] = useState<any>(null);
  const [integrations, setIntegrations] = useState<IntegrationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tab, setTab] = useState<"all" | "connected">("all");

  useEffect(() => {
    fetchIntegrations();
  }, [workspaceId]);

  const fetchIntegrations = () => {
    setLoading(true);
    apiFetch(`/integrations/?workspace_id=${workspaceId}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setIntegrations(data);
        }
      })
      .finally(() => setLoading(false));
  };

  const handleOpenConfig = (template: any) => {
    const active = integrations.find((i) => i.name === template.name);
    setError(null);
    setSuccess(null);
    setActiveConfig(template);
    
    // Prefill form
    const initialForm: Record<string, string> = {};
    template.fields.forEach((f: any) => {
      initialForm[f.name] = active?.credentials?.[f.name] || "";
    });
    setFormData(initialForm);
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await apiFetch("/integrations/", {
        method: "POST",
        body: JSON.stringify({
          workspace_id: workspaceId,
          name: activeConfig.name,
          credentials: formData,
          is_active: true
        })
      });

      if (!res.ok) throw new Error("Failed to configure integration.");
      
      setSuccess(`${activeConfig.label} integration configured successfully.`);
      fetchIntegrations();
      setTimeout(() => setActiveConfig(null), 1200);
    } catch (err: any) {
      setError(err.message || "An error occurred while saving.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfig = async (integrationId: string, label: string) => {
    if (!confirm(`Are you sure you want to disconnect ${label}?`)) return;
    
    try {
      const res = await apiFetch(`/integrations/${integrationId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        alert(`${label} integration disconnected.`);
        fetchIntegrations();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const isConnected = (name: string) => {
    return integrations.some((i) => i.name === name);
  };

  const getConnectedItem = (name: string) => {
    return integrations.find((i) => i.name === name);
  };

  return (
    <div className="p-8 space-y-8 max-w-6xl mx-auto w-full">
      <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight font-sans">Enterprise Connectors</h2>
          <p className="text-xs text-slate-500 mt-1">Connect corporate data repositories directly with the multi-agent vector pipelines.</p>
        </div>
        <div className="flex items-center gap-2 border border-slate-200 dark:border-slate-800 rounded-xl p-1 bg-white dark:bg-slate-900">
          <button
            onClick={() => setTab("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              tab === "all" ? "bg-indigo-500/10 text-indigo-500 font-bold" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            All Connectors
          </button>
          <button
            onClick={() => setTab("connected")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              tab === "connected" ? "bg-indigo-500/10 text-indigo-500 font-bold" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Connected ({integrations.length})
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex gap-2 items-center justify-center p-12 text-slate-400">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span className="text-xs font-bold">Checking active workspace connections...</span>
        </div>
      )}

      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {INTEGRATION_TEMPLATES.filter((t) => tab === "all" || isConnected(t.name)).map((template) => {
            const Icon = TEMPLATE_ICONS[template.name];
            const conn = getConnectedItem(template.name);
            const active = !!conn;
            
            return (
              <div 
                key={template.name}
                className={`glass-card rounded-2xl p-5 border transition flex flex-col justify-between h-56 hover:border-indigo-500/30 ${
                  active 
                    ? "bg-indigo-500/[0.02] border-indigo-500/25" 
                    : "bg-slate-50/50 dark:bg-slate-900/10 border-slate-200 dark:border-slate-800/80"
                }`}
              >
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div className={`h-11 w-11 rounded-xl flex items-center justify-center border border-slate-200 dark:border-slate-800/60 ${template.bgColor}`}>
                      <Icon className={`h-5 w-5 ${template.color}`} />
                    </div>
                    <div>
                      {active ? (
                        <span className="text-[9px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                          Connected
                        </span>
                      ) : (
                        <span className="text-[9px] bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 px-2.5 py-0.5 rounded-full font-bold text-slate-400 uppercase tracking-wider">
                          Disconnected
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200">{template.label}</h4>
                    <p className="text-[10px] text-slate-450 dark:text-slate-500 leading-relaxed font-semibold">{template.description}</p>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-800/80">
                  <button
                    onClick={() => handleOpenConfig(template)}
                    className="text-[11px] font-bold text-indigo-500 hover:text-indigo-400 flex items-center gap-1.5"
                  >
                    <span>Configure Connection</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>

                  {active && (
                    <button
                      onClick={() => handleDeleteConfig(conn.id, template.label)}
                      className="p-1 text-slate-400 hover:text-rose-500 transition"
                      title="Disconnect Integration"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Configuration modal panel overlay */}
      {activeConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="glass-panel w-full max-w-lg rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800/80 flex flex-col justify-between shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/60 dark:bg-slate-900/10">
              <div className="flex items-center gap-2.5">
                <Plug className="h-4.5 w-4.5 text-indigo-500 animate-pulse" />
                <h3 className="font-extrabold text-sm text-slate-700 dark:text-slate-200">Configure {activeConfig.label}</h3>
              </div>
              <button 
                onClick={() => setActiveConfig(null)}
                className="p-1 rounded-lg hover:bg-slate-150 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="p-6 space-y-4">
              {error && (
                <div className="p-3 rounded-xl border border-rose-500/10 bg-rose-500/5 text-rose-500 text-xs font-semibold leading-relaxed flex items-center gap-2 animate-in fade-in duration-300">
                  <AlertCircle className="h-4.5 w-4.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div className="p-3 rounded-xl border border-emerald-500/10 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 text-xs font-semibold leading-relaxed flex items-center gap-2 animate-in fade-in duration-300">
                  <CheckCircle2 className="h-4.5 w-4.5 shrink-0" />
                  <span>{success}</span>
                </div>
              )}

              <div className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-800/60 space-y-3">
                <div className="flex items-center gap-2 text-[10px] text-slate-450 dark:text-slate-500 font-bold uppercase tracking-wider mb-1">
                  <Lock className="h-3.5 w-3.5 text-indigo-500" />
                  <span>Secure OAuth/Secret Details</span>
                </div>

                {activeConfig.fields.map((field: any) => (
                  <div key={field.name} className="space-y-1 text-xs">
                    <label className="font-bold text-slate-400">{field.label}</label>
                    <input
                      type={field.type}
                      placeholder={field.placeholder}
                      value={formData[field.name] || ""}
                      required
                      onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                      className="w-full bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800/80 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-250 focus:border-indigo-500/50 focus:outline-none transition"
                    />
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setActiveConfig(null)}
                  className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-450 text-xs font-semibold px-4 py-2.5 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4.5 py-2.5 rounded-xl transition shadow-glow"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" /> Save Connection
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
