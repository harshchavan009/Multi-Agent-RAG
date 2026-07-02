"use client";

import React, { useState, useEffect } from "react";
import { apiFetch } from "../utils/api";
import { useAuthStore } from "@/app/store/authStore";
import { TableSkeleton } from "@/components/Skeletons";
import EmptyState from "@/components/EmptyState";
import {
  Folder,
  File,
  Upload,
  RefreshCw,
  CheckCircle,
  Plus,
  Search,
  AlertTriangle,
  Trash2
} from "lucide-react";

interface KnowledgeBaseItem {
  id: string;
  name: string;
  description?: string;
}

interface DocumentItem {
  id: string;
  name: string;
  file_size?: number;
  mime_type?: string;
  status: string;
  version: number;
  is_latest: boolean;
}

export default function DocumentsPage() {
  const { activeWorkspaceId } = useAuthStore();
  const workspaceId = activeWorkspaceId || "8501bde6-222d-42d6-9d75-ae480447a0c0";

  const [kbList, setKbList] = useState<KnowledgeBaseItem[]>([]);
  const [selectedKb, setSelectedKb] = useState<KnowledgeBaseItem | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [search, setSearch] = useState("");
  const [showAllVersions, setShowAllVersions] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load knowledge bases when workspaceId changes
  useEffect(() => {
    setKbList([]);
    setSelectedKb(null);
    setDocuments([]);
    fetchKBs();
  }, [workspaceId]);

  // Fetch documents when selected KB or version mode changes
  useEffect(() => {
    if (selectedKb) {
      fetchDocuments(selectedKb.id, showAllVersions);
    }
  }, [selectedKb, showAllVersions]);

  const fetchKBs = () => {
    apiFetch(`/documents/kb?workspace_id=${workspaceId}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setKbList(data);
          if (data.length > 0 && !selectedKb) {
            setSelectedKb(data[0]);
          } else if (data.length === 0) {
            setLoading(false);
          }
        } else {
          setLoading(false);
        }
      })
      .catch((err) => {
        console.log("Failed to load KBs", err);
        setLoading(false);
      });
  };

  const fetchDocuments = (kbId: string, showAll: boolean = showAllVersions) => {
    setLoading(true);
    apiFetch(`/documents/?knowledge_base_id=${kbId}&show_all_versions=${showAll}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setDocuments(data);
        }
      })
      .finally(() => setLoading(false));
  };

  const handleCreateKB = () => {
    const name = prompt("Enter new Knowledge Base name:");
    if (!name) return;

    apiFetch("/documents/kb", {
      method: "POST",
      body: JSON.stringify({
        workspace_id: workspaceId,
        name: name,
        description: "Custom indexed files partition",
        vector_settings: {}
      })
    })
      .then((res) => res.json())
      .then(() => fetchKBs());
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !selectedKb) return;
    const file = e.target.files[0];
    
    setUploading(true);

    const formData = new FormData();
    formData.append("knowledge_base_id", selectedKb.id);
    formData.append("file", file);

    try {
      const res = await apiFetch("/documents/upload", {
        method: "POST",
        body: formData
      });

      if (res.ok) {
        fetchDocuments(selectedKb.id);
      }
    } catch (err) {
      console.log("Upload error", err);
    } finally {
      setUploading(false);
    }
  };

  const handleSelectKb = (kb: KnowledgeBaseItem) => {
    setSelectedKb(kb);
  };

  const handleDeleteDoc = (docId: string) => {
    if (!confirm("Are you sure you want to delete this document from storage and index collections?")) return;
    apiFetch(`/documents/${docId}`, {
      method: "DELETE"
    })
      .then((res) => {
        if (res.ok) {
          if (selectedKb) {
            fetchDocuments(selectedKb.id);
          }
        } else {
          alert("Failed to delete document.");
        }
      })
      .catch((err) => console.error(err));
  };

  const filteredDocs = documents.filter((doc) =>
    doc.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto w-full flex-1 flex flex-col overflow-hidden">
      <div className="flex justify-between items-center shrink-0 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">Knowledge Base Library</h2>
          <p className="text-xs text-slate-500 mt-1">Manage index collections and upload files directly to Qdrant/PostgreSQL.</p>
        </div>
        <button 
          onClick={handleCreateKB}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4.5 py-2.5 rounded-xl transition shadow-glow"
        >
          <Plus className="h-4 w-4" /> Create Index Collection
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 overflow-hidden min-h-[500px]">
        <div className="glass-card rounded-2xl p-6 flex flex-col space-y-4 h-full overflow-y-auto shrink-0">
          <div>
            <h3 className="font-bold text-xs text-slate-700 dark:text-slate-200 uppercase tracking-wider">Index Partitions</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Toggle active directories.</p>
          </div>

          <div className="space-y-3 pt-2">
            {kbList.map((kb) => (
              <div
                key={kb.id}
                onClick={() => handleSelectKb(kb)}
                className={`p-4 rounded-xl border cursor-pointer transition flex flex-col gap-1 ${
                  selectedKb?.id === kb.id
                    ? "bg-indigo-500/10 border-indigo-500/40"
                    : "bg-slate-50 dark:bg-slate-900/45 border-slate-200 dark:border-slate-800/80 hover:border-slate-350"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Folder className="h-4 w-4 text-indigo-500" />
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200">{kb.name}</h4>
                </div>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 pl-6 truncate">{kb.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-3 glass-card rounded-2xl p-6 flex flex-col space-y-6 h-full overflow-y-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search file name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none text-slate-700 dark:text-slate-200"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 cursor-pointer shrink-0 select-none">
                <input
                  type="checkbox"
                  checked={showAllVersions}
                  onChange={(e) => setShowAllVersions(e.target.checked)}
                  className="rounded border-slate-300 dark:border-slate-800 text-indigo-600 focus:ring-indigo-500 accent-indigo-500 h-4 w-4"
                />
                <span>Show version history</span>
              </label>
            </div>

            <form className="w-full md:w-auto flex justify-end">
              <label className="flex items-center gap-2 border border-slate-200 dark:border-slate-800 hover:border-slate-300 bg-slate-50 dark:bg-slate-955 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-350 text-xs font-semibold px-4.5 py-2 rounded-xl cursor-pointer transition">
                <Upload className="h-4 w-4 text-indigo-500" />
                <span>Upload New File</span>
                <input type="file" className="hidden" onChange={handleFileUpload} />
              </label>
            </form>
          </div>

          {loading && (
            <TableSkeleton />
          )}

          <div className="space-y-3">
            {filteredDocs.length > 0 ? (
              filteredDocs.map((doc) => (
                <div key={doc.id} className="p-4 bg-slate-50/50 dark:bg-slate-900/10 border border-slate-200 dark:border-slate-800/80 rounded-xl flex items-center justify-between hover:border-indigo-500/20 transition">
                  <div className="flex items-center gap-3.5">
                    <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-400">
                      <File className="h-5 w-5 text-indigo-500" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                        <span>{doc.name}</span>
                        <span className="text-[10px] bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 px-1.5 py-0.5 rounded font-bold text-slate-500">
                          v{doc.version || 1}
                        </span>
                        {!doc.is_latest && (
                          <span className="text-[9px] bg-slate-200/50 dark:bg-slate-800/30 text-slate-400 dark:text-slate-600 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                            archived
                          </span>
                        )}
                      </h4>
                      <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-400 dark:text-slate-500 font-bold">
                        <span>Size: {doc.file_size ? `${round(doc.file_size / 1024, 1)} KB` : "unknown"}</span>
                        <span>•</span>
                        <span>Mimetype: {doc.mime_type || "unknown"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {doc.status === "completed" ? (
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full font-bold flex items-center gap-1.5 animate-in fade-in">
                        <CheckCircle className="h-3 w-3" /> Vector Indexed
                      </span>
                    ) : doc.status === "processing" ? (
                      <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-full font-bold flex items-center gap-1.5 animate-pulse">
                        <RefreshCw className="h-3 w-3 animate-spin" /> Embedding Chunks
                      </span>
                    ) : (
                      <span className="text-[10px] bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 px-2.5 py-1 rounded-full font-bold flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5" /> Failed
                      </span>
                    )}

                    <button
                      onClick={() => handleDeleteDoc(doc.id)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-rose-500 dark:hover:text-rose-450 transition cursor-pointer"
                      title="Delete Document"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              !loading && (
                <EmptyState
                  type="document"
                  title="No documents indexed"
                  description="Upload files (PDF, DOCX, TXT) to index vectors into Qdrant collection."
                  actionLabel="Upload New File"
                  onActionClick={() => {
                    const inputEl = document.querySelector('input[type="file"]') as HTMLInputElement;
                    inputEl?.click();
                  }}
                />
              )
            )}
          </div>

          {uploading && (
            <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-xl flex items-center gap-3 animate-pulse">
              <RefreshCw className="h-4 w-4 text-indigo-500 animate-spin" />
              <span className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold">Uploading and processing text layout vectors...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function round(val: number, precision: number) {
  const f = Math.pow(10, precision);
  return Math.round(val * f) / f;
}
