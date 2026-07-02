"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { Video, Upload, Mic2, CheckCircle, Clock, AlertCircle, Loader2, X, ChevronDown, ClipboardList, Target, FileText, Download, Trash2, Plus } from "lucide-react";
import { apiFetch } from "../utils/api";

const WORKSPACE_ID = "00000000-0000-0000-0000-000000000001";

interface MeetingAnalysis {
  id: string;
  filename: string;
  status: "pending" | "processing" | "completed" | "failed";
  summary?: string;
  action_items: string[];
  decisions: string[];
  created_at: string;
}

interface KnowledgeBase {
  id: string;
  name: string;
}

const statusColor = (status: string) => {
  switch (status) {
    case "completed": return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
    case "processing": return "text-cyan-400 bg-cyan-500/10 border-cyan-500/20";
    case "failed": return "text-rose-400 bg-rose-500/10 border-rose-500/20";
    default: return "text-amber-400 bg-amber-500/10 border-amber-500/20";
  }
};

function ProcessingAnimation() {
  const steps = ["Uploading recording", "Transcribing audio", "Extracting insights", "Finalizing"];
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep(prev => (prev + 1) % steps.length);
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-3">
      {steps.map((step, i) => (
        <div key={i} className={`flex items-center gap-3 transition-all ${i === activeStep ? "opacity-100" : "opacity-30"}`}>
          <div className={`h-2 w-2 rounded-full transition-all ${i === activeStep ? "bg-cyan-400 shadow-[0_0_8px_#22d3ee] scale-125" : i < activeStep ? "bg-emerald-400" : "bg-slate-700"}`} />
          <span className={`text-xs font-medium ${i === activeStep ? "text-cyan-300" : "text-slate-500"}`}>{step}</span>
          {i === activeStep && <Loader2 className="h-3 w-3 text-cyan-400 animate-spin ml-auto" />}
          {i < activeStep && <CheckCircle className="h-3 w-3 text-emerald-400 ml-auto" />}
        </div>
      ))}
    </div>
  );
}

export default function MeetingPage() {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [analyses, setAnalyses] = useState<MeetingAnalysis[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [selectedKB, setSelectedKB] = useState("");
  const [saveToKB, setSaveToKB] = useState(false);
  const [selectedAnalysis, setSelectedAnalysis] = useState<MeetingAnalysis | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
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

  const fetchAnalyses = useCallback(async () => {
    try {
      const res = await apiFetch(`/meeting/analyses?workspace_id=${WORKSPACE_ID}`);
      if (res.ok) {
        const data = await res.json();
        setAnalyses(data);
        // Update selected analysis if changed
        if (selectedAnalysis) {
          const updated = data.find((a: MeetingAnalysis) => a.id === selectedAnalysis.id);
          if (updated) setSelectedAnalysis(updated);
        }
      }
    } catch (e) { console.error(e); }
  }, [selectedAnalysis]);

  useEffect(() => {
    fetchKBs();
    fetchAnalyses();
    pollingRef.current = setInterval(fetchAnalyses, 3000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, []);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError("");
    setSuccess("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("workspace_id", WORKSPACE_ID);
    formData.append("save_to_kb", String(saveToKB));
    if (saveToKB && selectedKB) formData.append("knowledge_base_id", selectedKB);

    try {
      const res = await apiFetch("/meeting/upload", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        setSuccess(`"${file.name}" uploaded! Analysis in progress...`);
        setSelectedAnalysis(data);
        fetchAnalyses();
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
  }, [saveToKB, selectedKB]);

  const deleteAnalysis = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiFetch(`/meeting/analysis/${id}`, { method: "DELETE" });
      if (selectedAnalysis?.id === id) setSelectedAnalysis(null);
      fetchAnalyses();
    } catch (e) { console.error(e); }
  };

  const exportPDF = () => {
    if (!selectedAnalysis) return;
    const content = [
      `MEETING INTELLIGENCE REPORT`,
      `File: ${selectedAnalysis.filename}`,
      `Date: ${new Date(selectedAnalysis.created_at).toLocaleString()}`,
      ``,
      `SUMMARY:`,
      selectedAnalysis.summary || "",
      ``,
      `ACTION ITEMS:`,
      ...(selectedAnalysis.action_items.map((a, i) => `${i + 1}. ${a}`)),
      ``,
      `DECISIONS:`,
      ...(selectedAnalysis.decisions.map((d, i) => `${i + 1}. ${d}`))
    ].join("\n");

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `meeting_${selectedAnalysis.filename}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDate = (dt: string) => new Date(dt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950/20 p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
            <Video className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">Meeting Intelligence</h1>
            <p className="text-sm text-slate-400">Upload recordings → transcribe → extract Summary, Actions & Decisions</p>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-4">
          <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-xs text-slate-500 font-medium">Powered by OpenAI Whisper + GPT-4</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-3 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">
          <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
          <p className="text-sm text-rose-300">{error}</p>
          <button onClick={() => setError("")} className="ml-auto"><X className="h-4 w-4 text-rose-400" /></button>
        </div>
      )}
      {success && (
        <div className="mb-4 flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
          <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
          <p className="text-sm text-emerald-300">{success}</p>
          <button onClick={() => setSuccess("")} className="ml-auto"><X className="h-4 w-4 text-emerald-400" /></button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Left Panel */}
        <div className="xl:col-span-2 space-y-5">
          {/* Upload Zone */}
          <div
            onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleFileDrop}
            onClick={() => !uploading && fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-2xl p-8 cursor-pointer transition-all duration-300 text-center group ${
              isDragOver
                ? "border-cyan-500 bg-cyan-500/10 shadow-lg shadow-cyan-500/20"
                : "border-slate-700 hover:border-cyan-500/60 bg-slate-900/40 hover:bg-cyan-500/5"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,video/*"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
            />

            {uploading ? (
              <div className="flex flex-col items-center gap-5">
                <div className="h-14 w-14 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
                  <Mic2 className="h-7 w-7 text-cyan-400 animate-pulse" />
                </div>
                <ProcessingAnimation />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20 border border-cyan-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Video className="h-8 w-8 text-cyan-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-200 mb-1">Drop meeting recording here</p>
                  <p className="text-xs text-slate-500">Audio or video files supported</p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  {["MP3", "MP4", "WAV", "M4A", "WEBM", "MOV"].map(fmt => (
                    <span key={fmt} className="px-2 py-0.5 bg-slate-800 text-slate-400 text-[10px] font-bold rounded-lg border border-slate-700">{fmt}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Options */}
          <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-5 space-y-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Upload Options</p>
            <label className="flex items-start gap-3 cursor-pointer group">
              <div
                onClick={() => setSaveToKB(!saveToKB)}
                className={`h-5 w-5 rounded border-2 flex items-center justify-center transition shrink-0 mt-0.5 ${saveToKB ? "bg-cyan-500 border-cyan-500" : "border-slate-600 group-hover:border-cyan-500/60"}`}
              >
                {saveToKB && <CheckCircle className="h-3 w-3 text-white" />}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-200">Save transcript to Knowledge Base</p>
                <p className="text-xs text-slate-500">Make the meeting searchable via RAG chat</p>
              </div>
            </label>
            {saveToKB && (
              <div className="pl-8">
                <label className="block text-xs text-slate-500 mb-1.5">Target Knowledge Base</label>
                <div className="relative">
                  <select
                    value={selectedKB}
                    onChange={e => setSelectedKB(e.target.value)}
                    className="w-full bg-slate-800/80 border border-slate-700 text-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-cyan-500 appearance-none"
                  >
                    {knowledgeBases.map(kb => <option key={kb.id} value={kb.id}>{kb.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                </div>
              </div>
            )}
          </div>

          {/* Meeting List */}
          <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800/60">
              <h2 className="text-sm font-bold text-slate-200">Recent Meetings</h2>
            </div>
            {analyses.length === 0 ? (
              <div className="py-10 flex flex-col items-center gap-2">
                <Video className="h-10 w-10 text-slate-700" />
                <p className="text-xs text-slate-500">No meetings analyzed yet</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/40 max-h-72 overflow-y-auto">
                {analyses.map(a => (
                  <div
                    key={a.id}
                    onClick={() => setSelectedAnalysis(a)}
                    className={`px-4 py-3 flex items-center gap-3 hover:bg-slate-800/30 transition cursor-pointer ${selectedAnalysis?.id === a.id ? "bg-cyan-500/5 border-l-2 border-cyan-500" : ""}`}
                  >
                    <Mic2 className="h-4 w-4 text-cyan-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-200 truncate">{a.filename}</p>
                      <p className="text-[10px] text-slate-500">{formatDate(a.created_at)}</p>
                    </div>
                    <div className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg border ${statusColor(a.status)}`}>
                      {a.status}
                    </div>
                    <button
                      onClick={(e) => deleteAnalysis(a.id, e)}
                      className="p-1 text-slate-600 hover:text-rose-400 transition shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Results */}
        <div className="xl:col-span-3">
          {!selectedAnalysis ? (
            <div className="h-full flex items-center justify-center bg-slate-900/40 border border-slate-800/60 rounded-2xl">
              <div className="text-center space-y-3 p-12">
                <div className="h-16 w-16 rounded-2xl bg-slate-800/60 border border-slate-700 flex items-center justify-center mx-auto">
                  <Video className="h-8 w-8 text-slate-600" />
                </div>
                <p className="text-sm text-slate-400 font-medium">Select a meeting or upload a recording</p>
                <p className="text-xs text-slate-600">AI will extract Summary, Action Items & Decisions</p>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Analysis Header */}
              <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-200">{selectedAnalysis.filename}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{formatDate(selectedAnalysis.created_at)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold ${statusColor(selectedAnalysis.status)}`}>
                    {selectedAnalysis.status === "processing" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {selectedAnalysis.status === "completed" && <CheckCircle className="h-3.5 w-3.5" />}
                    {selectedAnalysis.status === "pending" && <Clock className="h-3.5 w-3.5" />}
                    <span className="capitalize">{selectedAnalysis.status}</span>
                  </div>
                  {selectedAnalysis.status === "completed" && (
                    <button
                      onClick={exportPDF}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-lg transition"
                    >
                      <Download className="h-3.5 w-3.5" /> Export
                    </button>
                  )}
                </div>
              </div>

              {selectedAnalysis.status === "processing" || selectedAnalysis.status === "pending" ? (
                <div className="bg-slate-900/60 border border-cyan-500/20 rounded-2xl p-8 flex flex-col items-center gap-5">
                  <Loader2 className="h-10 w-10 text-cyan-400 animate-spin" />
                  <div className="text-center">
                    <p className="text-sm font-bold text-cyan-300">AI Analysis in Progress</p>
                    <p className="text-xs text-slate-500 mt-1">Transcribing and extracting meeting insights...</p>
                  </div>
                </div>
              ) : selectedAnalysis.status === "completed" ? (
                <>
                  {/* Summary */}
                  <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-7 w-7 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <FileText className="h-4 w-4 text-blue-400" />
                      </div>
                      <h3 className="text-sm font-bold text-slate-200">📋 Meeting Summary</h3>
                    </div>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      {selectedAnalysis.summary || "No summary available."}
                    </p>
                  </div>

                  {/* Action Items + Decisions */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Action Items */}
                    <div className="bg-slate-900/60 border border-amber-500/20 rounded-2xl p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="h-7 w-7 rounded-lg bg-amber-500/20 flex items-center justify-center">
                          <ClipboardList className="h-4 w-4 text-amber-400" />
                        </div>
                        <h3 className="text-sm font-bold text-slate-200">✅ Action Items</h3>
                        <span className="ml-auto text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg">
                          {selectedAnalysis.action_items.length}
                        </span>
                      </div>
                      {selectedAnalysis.action_items.length === 0 ? (
                        <p className="text-xs text-slate-500 italic">No action items identified</p>
                      ) : (
                        <div className="space-y-2 max-h-56 overflow-y-auto">
                          {selectedAnalysis.action_items.map((item, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <div className="h-5 w-5 rounded border-2 border-amber-500/40 flex items-center justify-center shrink-0 mt-0.5">
                                <span className="text-[9px] font-black text-amber-400">{i + 1}</span>
                              </div>
                              <p className="text-xs text-slate-300 leading-relaxed">{item}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Decisions */}
                    <div className="bg-slate-900/60 border border-emerald-500/20 rounded-2xl p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="h-7 w-7 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                          <Target className="h-4 w-4 text-emerald-400" />
                        </div>
                        <h3 className="text-sm font-bold text-slate-200">🎯 Decisions</h3>
                        <span className="ml-auto text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg">
                          {selectedAnalysis.decisions.length}
                        </span>
                      </div>
                      {selectedAnalysis.decisions.length === 0 ? (
                        <p className="text-xs text-slate-500 italic">No decisions identified</p>
                      ) : (
                        <div className="space-y-2 max-h-56 overflow-y-auto">
                          {selectedAnalysis.decisions.map((decision, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <div className="h-4 w-4 rounded-full bg-emerald-500/30 flex items-center justify-center shrink-0 mt-0.5">
                                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                              </div>
                              <p className="text-xs text-slate-300 leading-relaxed">{decision}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-6 text-center">
                  <AlertCircle className="h-8 w-8 text-rose-400 mx-auto mb-2" />
                  <p className="text-sm text-rose-300 font-medium">Analysis failed. Please try uploading again.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
