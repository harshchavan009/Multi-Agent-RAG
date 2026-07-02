"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { ScanText, Upload, FileText, CheckCircle, Clock, AlertCircle, Loader2, Copy, BookOpen, X, ChevronDown, Eye, FileImage, Download } from "lucide-react";
import { apiFetch } from "../utils/api";

const WORKSPACE_ID = "00000000-0000-0000-0000-000000000001";

interface OCRDocument {
  id: string;
  name: string;
  status: "pending" | "processing" | "completed" | "failed";
  mime_type: string;
  file_size: number;
  created_at: string;
  metadata_fields: {
    text_preview?: string;
    word_count?: number;
    char_count?: number;
    full_text?: string;
    type?: string;
  };
}

interface KnowledgeBase {
  id: string;
  name: string;
}

const statusIcon = (status: string) => {
  switch (status) {
    case "completed": return <CheckCircle className="h-4 w-4 text-emerald-400" />;
    case "processing": return <Loader2 className="h-4 w-4 text-violet-400 animate-spin" />;
    case "failed": return <AlertCircle className="h-4 w-4 text-rose-400" />;
    default: return <Clock className="h-4 w-4 text-amber-400" />;
  }
};

const statusColor = (status: string) => {
  switch (status) {
    case "completed": return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
    case "processing": return "text-violet-400 bg-violet-500/10 border-violet-500/20";
    case "failed": return "text-rose-400 bg-rose-500/10 border-rose-500/20";
    default: return "text-amber-400 bg-amber-500/10 border-amber-500/20";
  }
};

function ScanningAnimation() {
  return (
    <div className="relative h-20 w-32 mx-auto">
      <div className="absolute inset-0 border-2 border-violet-500/30 rounded-lg overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-violet-500/20 to-transparent animate-scan" />
        <div className="absolute inset-0 flex flex-col gap-1 p-2 opacity-30">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-1 bg-slate-400 rounded-full" style={{ width: `${60 + Math.random() * 40}%` }} />
          ))}
        </div>
      </div>
      <div className="absolute top-2 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-violet-500 to-transparent animate-scan" />
    </div>
  );
}

export default function OCRPage() {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [ocrDocs, setOcrDocs] = useState<OCRDocument[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [selectedKB, setSelectedKB] = useState("");
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState("");
  const [loadingText, setLoadingText] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const fetchKBs = async () => {
    try {
      const res = await apiFetch(`/documents/kb?workspace_id=${WORKSPACE_ID}`);
      if (res.ok) {
        const data = await res.json();
        setKnowledgeBases(data);
        if (data.length > 0 && !selectedKB) setSelectedKB(data[0].id);
      }
    } catch (e) { console.error(e); }
  };

  const fetchOcrDocs = useCallback(async (kbId: string) => {
    if (!kbId) return;
    try {
      const res = await apiFetch(`/ocr/results?knowledge_base_id=${kbId}`);
      if (res.ok) {
        const data = await res.json();
        setOcrDocs(data);
      }
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { fetchKBs(); }, []);

  useEffect(() => {
    if (selectedKB) {
      fetchOcrDocs(selectedKB);
      pollingRef.current = setInterval(() => fetchOcrDocs(selectedKB), 3000);
      return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
    }
  }, [selectedKB, fetchOcrDocs]);

  const handleUpload = async (file: File) => {
    if (!selectedKB) { setError("Please select a Knowledge Base first."); return; }
    setUploading(true);
    setError("");
    setSuccess("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("knowledge_base_id", selectedKB);

    try {
      const res = await apiFetch("/ocr/upload", { method: "POST", body: formData });
      if (res.ok) {
        setSuccess(`"${file.name}" uploaded! OCR extraction in progress...`);
        fetchOcrDocs(selectedKB);
      } else {
        const err = await res.json();
        setError(err.detail || "Upload failed");
      }
    } catch (e) {
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  }, [selectedKB]);

  const viewText = async (docId: string) => {
    setLoadingText(true);
    setSelectedDoc(docId);
    try {
      const res = await apiFetch(`/ocr/text/${docId}`);
      if (res.ok) {
        const data = await res.json();
        setExtractedText(data.full_text || data.text_preview || "No text extracted yet.");
      }
    } catch (e) {
      setExtractedText("Failed to load extracted text.");
    } finally {
      setLoadingText(false);
    }
  };

  const copyText = () => {
    navigator.clipboard.writeText(extractedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadText = () => {
    const blob = new Blob([extractedText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ocr_extracted.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return "—";
    return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
  };

  const formatDate = (dt: string) => new Date(dt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950/20 p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
            <ScanText className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">OCR Intelligence</h1>
            <p className="text-sm text-slate-400">Extract text from scanned PDFs & images → index into Knowledge Base</p>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-4">
          <div className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
          <span className="text-xs text-slate-500 font-medium">GPT-4 Vision OCR • pytesseract fallback</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-3 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">
          <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
          <p className="text-sm text-rose-300">{error}</p>
          <button onClick={() => setError("")} className="ml-auto text-rose-400"><X className="h-4 w-4" /></button>
        </div>
      )}
      {success && (
        <div className="mb-4 flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
          <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
          <p className="text-sm text-emerald-300">{success}</p>
          <button onClick={() => setSuccess("")} className="ml-auto text-emerald-400"><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Left Panel */}
        <div className="xl:col-span-2 space-y-5">
          {/* KB Selector */}
          <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-5 backdrop-blur-sm">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Target Knowledge Base</label>
            <div className="relative">
              <select
                value={selectedKB}
                onChange={e => setSelectedKB(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700 text-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-violet-500 appearance-none"
              >
                {knowledgeBases.length === 0 && <option value="">No knowledge bases found</option>}
                {knowledgeBases.map(kb => <option key={kb.id} value={kb.id}>{kb.name}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Upload Zone */}
          <div
            onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-2xl p-8 cursor-pointer transition-all duration-300 text-center group ${
              isDragOver
                ? "border-violet-500 bg-violet-500/10 shadow-lg shadow-violet-500/20"
                : "border-slate-700 hover:border-violet-500/60 bg-slate-900/40 hover:bg-violet-500/5"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
            />

            {uploading ? (
              <div className="flex flex-col items-center gap-5">
                <ScanningAnimation />
                <div>
                  <p className="text-sm font-bold text-violet-400">OCR Processing...</p>
                  <p className="text-xs text-slate-500 mt-1">Extracting text with AI vision</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <ScanText className="h-8 w-8 text-violet-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-200 mb-1">Drop scanned PDF or image here</p>
                  <p className="text-xs text-slate-500">or click to browse files</p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  {["PDF", "PNG", "JPG", "TIFF", "BMP", "WEBP"].map(fmt => (
                    <span key={fmt} className="px-2 py-0.5 bg-slate-800 text-slate-400 text-[10px] font-bold rounded-lg border border-slate-700">{fmt}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Feature Highlights */}
          <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-5 space-y-3">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Capabilities</p>
            {[
              { icon: "🔍", title: "Multi-Page PDF OCR", desc: "Extract text from all pages" },
              { icon: "🧠", title: "AI Vision Engine", desc: "GPT-4 Vision for superior accuracy" },
              { icon: "📚", title: "Auto KB Indexing", desc: "Immediately searchable via RAG" },
              { icon: "🔄", title: "Local Fallback", desc: "pytesseract when offline" },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="text-base mt-0.5">{item.icon}</span>
                <div>
                  <p className="text-xs font-semibold text-slate-300">{item.title}</p>
                  <p className="text-[11px] text-slate-500">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel */}
        <div className="xl:col-span-3 space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-900/60 border border-slate-800/60 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">Total Docs</p>
              <p className="text-2xl font-black text-white">{ocrDocs.length}</p>
            </div>
            <div className="bg-slate-900/60 border border-slate-800/60 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">Extracted</p>
              <p className="text-2xl font-black text-emerald-400">{ocrDocs.filter(d => d.status === "completed").length}</p>
            </div>
            <div className="bg-slate-900/60 border border-slate-800/60 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">Processing</p>
              <p className="text-2xl font-black text-violet-400">{ocrDocs.filter(d => d.status === "processing").length}</p>
            </div>
          </div>

          {/* Document List */}
          <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl overflow-hidden backdrop-blur-sm">
            <div className="px-5 py-4 border-b border-slate-800/60 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-200">OCR Documents</h2>
              <span className="text-xs text-slate-500">{ocrDocs.length} files</span>
            </div>

            {ocrDocs.length === 0 ? (
              <div className="py-16 flex flex-col items-center gap-3">
                <FileImage className="h-12 w-12 text-slate-700" />
                <p className="text-sm text-slate-500">Upload a scanned PDF or image to get started.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/40">
                {ocrDocs.map(doc => (
                  <div
                    key={doc.id}
                    className={`px-5 py-4 flex items-center gap-4 hover:bg-slate-800/30 transition cursor-pointer ${selectedDoc === doc.id ? "bg-violet-500/5 border-l-2 border-violet-500" : ""}`}
                    onClick={() => doc.status === "completed" && viewText(doc.id)}
                  >
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/20 flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5 text-violet-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-200 truncate">{doc.name}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-slate-500">{formatSize(doc.file_size)}</span>
                        <span className="text-slate-700">•</span>
                        <span className="text-xs text-slate-500">{formatDate(doc.created_at)}</span>
                        {doc.metadata_fields?.word_count && (
                          <>
                            <span className="text-slate-700">•</span>
                            <span className="text-xs text-slate-500">{doc.metadata_fields.word_count.toLocaleString()} words</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${statusColor(doc.status)}`}>
                      {statusIcon(doc.status)}
                      <span className="capitalize">{doc.status}</span>
                    </div>
                    {doc.status === "completed" && (
                      <button className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 font-semibold">
                        <Eye className="h-3.5 w-3.5" /> View
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Text Viewer */}
          {selectedDoc && (
            <div className="bg-slate-900/60 border border-violet-500/20 rounded-2xl overflow-hidden backdrop-blur-sm">
              <div className="px-5 py-4 border-b border-slate-800/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-violet-400" />
                  <h2 className="text-sm font-bold text-slate-200">Extracted Text</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={downloadText} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-300 rounded-lg transition">
                    <Download className="h-3.5 w-3.5" /> Download
                  </button>
                  <button onClick={copyText} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-300 rounded-lg transition">
                    <Copy className="h-3.5 w-3.5" /> {copied ? "Copied!" : "Copy"}
                  </button>
                  <button onClick={() => { setSelectedDoc(null); setExtractedText(""); }} className="p-1.5 text-slate-500 hover:text-slate-300">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="p-5">
                {loadingText ? (
                  <div className="flex items-center gap-3 py-8 justify-center">
                    <Loader2 className="h-5 w-5 text-violet-400 animate-spin" />
                    <span className="text-sm text-slate-400">Loading extracted text...</span>
                  </div>
                ) : (
                  <div className="bg-slate-800/40 rounded-xl p-4 max-h-72 overflow-y-auto font-mono">
                    <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{extractedText}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes scan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(500%); }
        }
        .animate-scan { animation: scan 2s linear infinite; }
      `}} />
    </div>
  );
}
