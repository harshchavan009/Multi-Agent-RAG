"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { Mic, Upload, FileAudio, CheckCircle, Clock, AlertCircle, Loader2, Copy, BookOpen, Volume2, X, ChevronDown } from "lucide-react";
import { apiFetch } from "../utils/api";
import { useAuthStore } from "@/app/store/authStore";

const WORKSPACE_ID = "00000000-0000-0000-0000-000000000001";

interface Transcription {
  id: string;
  name: string;
  status: "pending" | "processing" | "completed" | "failed";
  mime_type: string;
  file_size: number;
  created_at: string;
  metadata_fields: {
    transcript_preview?: string;
    word_count?: number;
    full_transcript?: string;
  };
}

interface KnowledgeBase {
  id: string;
  name: string;
}

const statusIcon = (status: string) => {
  switch (status) {
    case "completed": return <CheckCircle className="h-4 w-4 text-emerald-400" />;
    case "processing": return <Loader2 className="h-4 w-4 text-indigo-400 animate-spin" />;
    case "failed": return <AlertCircle className="h-4 w-4 text-rose-400" />;
    default: return <Clock className="h-4 w-4 text-amber-400" />;
  }
};

const statusColor = (status: string) => {
  switch (status) {
    case "completed": return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
    case "processing": return "text-indigo-400 bg-indigo-500/10 border-indigo-500/20";
    case "failed": return "text-rose-400 bg-rose-500/10 border-rose-500/20";
    default: return "text-amber-400 bg-amber-500/10 border-amber-500/20";
  }
};

function WaveformAnimation() {
  return (
    <div className="flex items-end gap-0.5 h-8">
      {Array.from({ length: 20 }).map((_, i) => (
        <div
          key={i}
          className="w-1 bg-gradient-to-t from-indigo-600 to-cyan-400 rounded-full animate-pulse"
          style={{
            height: `${Math.random() * 100}%`,
            animationDelay: `${i * 0.05}s`,
            animationDuration: `${0.6 + Math.random() * 0.6}s`,
            minHeight: "4px"
          }}
        />
      ))}
    </div>
  );
}

export default function VoiceRAGPage() {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [selectedKB, setSelectedKB] = useState("");
  const [selectedTranscript, setSelectedTranscript] = useState<string | null>(null);
  const [transcriptText, setTranscriptText] = useState("");
  const [loadingTranscript, setLoadingTranscript] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const fetchKBs = useCallback(async () => {
    try {
      const res = await apiFetch(`/documents/kb?workspace_id=${WORKSPACE_ID}`);
      if (res.ok) {
        const data = await res.json();
        setKnowledgeBases(data);
        if (data.length > 0 && !selectedKB) setSelectedKB(data[0].id);
      }
    } catch (e) { console.error(e); }
  }, [selectedKB]);

  const fetchTranscriptions = useCallback(async (kbId: string) => {
    if (!kbId) return;
    try {
      const res = await apiFetch(`/voice-rag/transcriptions?knowledge_base_id=${kbId}`);
      if (res.ok) {
        const data = await res.json();
        setTranscriptions(data);
      }
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    fetchKBs();
  }, []);

  useEffect(() => {
    if (selectedKB) {
      fetchTranscriptions(selectedKB);
      // Poll for status updates if any in-progress
      pollingRef.current = setInterval(() => fetchTranscriptions(selectedKB), 3000);
      return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
    }
  }, [selectedKB, fetchTranscriptions]);

  const handleUpload = async (file: File) => {
    if (!selectedKB) { setError("Please select a Knowledge Base first."); return; }
    setUploading(true);
    setError("");
    setSuccess("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("knowledge_base_id", selectedKB);

    try {
      const res = await apiFetch("/voice-rag/upload", { method: "POST", body: formData });
      if (res.ok) {
        setSuccess(`"${file.name}" uploaded! Transcription in progress...`);
        fetchTranscriptions(selectedKB);
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

  const viewTranscript = async (docId: string) => {
    setLoadingTranscript(true);
    setSelectedTranscript(docId);
    try {
      const res = await apiFetch(`/voice-rag/transcript/${docId}`);
      if (res.ok) {
        const data = await res.json();
        setTranscriptText(data.transcript || data.transcript_preview || "No transcript available yet.");
      }
    } catch (e) {
      setTranscriptText("Failed to load transcript.");
    } finally {
      setLoadingTranscript(false);
    }
  };

  const copyTranscript = () => {
    navigator.clipboard.writeText(transcriptText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return "—";
    return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
  };

  const formatDate = (dt: string) => new Date(dt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/30 p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Mic className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">Voice RAG Studio</h1>
            <p className="text-sm text-slate-400">Upload voice notes → transcribe → query via RAG</p>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-4">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-slate-500 font-medium">Powered by OpenAI Whisper</span>
          <span className="mx-2 text-slate-700">•</span>
          <span className="text-xs text-slate-500 font-medium">Local whisper fallback enabled</span>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-4 flex items-center gap-3 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">
          <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
          <p className="text-sm text-rose-300">{error}</p>
          <button onClick={() => setError("")} className="ml-auto text-rose-400 hover:text-rose-300"><X className="h-4 w-4" /></button>
        </div>
      )}
      {success && (
        <div className="mb-4 flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
          <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
          <p className="text-sm text-emerald-300">{success}</p>
          <button onClick={() => setSuccess("")} className="ml-auto text-emerald-400 hover:text-emerald-300"><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Left: Upload + KB Select */}
        <div className="xl:col-span-2 space-y-6">
          {/* KB Selector */}
          <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-5 backdrop-blur-sm">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Target Knowledge Base</label>
            <div className="relative">
              <select
                value={selectedKB}
                onChange={e => setSelectedKB(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700 text-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 appearance-none cursor-pointer"
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
                ? "border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/20"
                : "border-slate-700 hover:border-indigo-500/60 bg-slate-900/40 hover:bg-indigo-500/5"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,video/mp4,video/webm"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
            />

            {uploading ? (
              <div className="flex flex-col items-center gap-4">
                <WaveformAnimation />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-indigo-400">Uploading & Transcribing...</p>
                  <p className="text-xs text-slate-500">Whisper AI is processing your audio</p>
                </div>
                <Loader2 className="h-5 w-5 text-indigo-400 animate-spin" />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Mic className="h-8 w-8 text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-200 mb-1">Drop your voice recording here</p>
                  <p className="text-xs text-slate-500">or click to browse files</p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  {["MP3", "WAV", "M4A", "OGG", "FLAC", "MP4"].map(fmt => (
                    <span key={fmt} className="px-2 py-0.5 bg-slate-800 text-slate-400 text-[10px] font-bold rounded-lg border border-slate-700">{fmt}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-900/60 border border-slate-800/60 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">Total Recordings</p>
              <p className="text-2xl font-black text-white">{transcriptions.length}</p>
            </div>
            <div className="bg-slate-900/60 border border-slate-800/60 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">Indexed</p>
              <p className="text-2xl font-black text-emerald-400">
                {transcriptions.filter(t => t.status === "completed").length}
              </p>
            </div>
          </div>
        </div>

        {/* Right: Transcription List + Viewer */}
        <div className="xl:col-span-3 space-y-6">
          {/* Transcription List */}
          <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl overflow-hidden backdrop-blur-sm">
            <div className="px-5 py-4 border-b border-slate-800/60 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-200">Voice Recordings</h2>
              <span className="text-xs text-slate-500">{transcriptions.length} files</span>
            </div>

            {transcriptions.length === 0 ? (
              <div className="py-16 flex flex-col items-center gap-3 text-center">
                <FileAudio className="h-12 w-12 text-slate-700" />
                <p className="text-sm text-slate-500">No recordings yet. Upload your first voice note above.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/40">
                {transcriptions.map(t => (
                  <div
                    key={t.id}
                    className={`px-5 py-4 flex items-center gap-4 hover:bg-slate-800/30 transition cursor-pointer ${selectedTranscript === t.id ? "bg-indigo-500/5 border-l-2 border-indigo-500" : ""}`}
                    onClick={() => t.status === "completed" && viewTranscript(t.id)}
                  >
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-500/20 flex items-center justify-center shrink-0">
                      <Volume2 className="h-5 w-5 text-indigo-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-200 truncate">{t.name}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-slate-500">{formatSize(t.file_size)}</span>
                        <span className="text-slate-700">•</span>
                        <span className="text-xs text-slate-500">{formatDate(t.created_at)}</span>
                        {t.metadata_fields?.word_count && (
                          <>
                            <span className="text-slate-700">•</span>
                            <span className="text-xs text-slate-500">{t.metadata_fields.word_count} words</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${statusColor(t.status)}`}>
                      {statusIcon(t.status)}
                      <span className="capitalize">{t.status}</span>
                    </div>
                    {t.status === "completed" && (
                      <button className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold shrink-0">View →</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Transcript Viewer */}
          {selectedTranscript && (
            <div className="bg-slate-900/60 border border-indigo-500/20 rounded-2xl overflow-hidden backdrop-blur-sm">
              <div className="px-5 py-4 border-b border-slate-800/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-indigo-400" />
                  <h2 className="text-sm font-bold text-slate-200">Transcript</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={copyTranscript}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-300 rounded-lg transition"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {copied ? "Copied!" : "Copy"}
                  </button>
                  <button onClick={() => { setSelectedTranscript(null); setTranscriptText(""); }} className="p-1.5 text-slate-500 hover:text-slate-300 transition">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="p-5">
                {loadingTranscript ? (
                  <div className="flex items-center gap-3 py-8 justify-center">
                    <Loader2 className="h-5 w-5 text-indigo-400 animate-spin" />
                    <span className="text-sm text-slate-400">Loading transcript...</span>
                  </div>
                ) : (
                  <div className="bg-slate-800/40 rounded-xl p-4 max-h-64 overflow-y-auto">
                    <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{transcriptText}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
