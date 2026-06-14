"use client";

import React, { useState, useEffect } from "react";
import { apiFetch } from "../utils/api";
import { useAuthStore } from "../store/authStore";
import {
  Send,
  FileText,
  Bot,
  User,
  Sparkles,
  BookOpen,
  AlertCircle,
  Plus,
  Paperclip,
  Trash2,
  Clock,
  ArrowRight,
  RefreshCw
} from "lucide-react";

interface Message {
  id: string;
  role: string;
  content: string;
  citations?: Array<{ title: string; text: string; doc_id?: string }>;
  metrics?: { iterations?: number; agent_history?: string[] };
  evaluations?: {
    groundedness_score?: number;
    faithfulness_score?: number;
    hallucination_score?: number;
  };
}

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
}

export default function ChatPage() {
  const workspaceId = "8501bde6-222d-42d6-9d75-ae480447a0c0";
  
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState("openai-gpt4o");
  const [selectedAgent, setSelectedAgent] = useState("auto");
  const [loading, setLoading] = useState(false);
  const [activeCitation, setActiveCitation] = useState<any>(null);
  const [attachedFile, setAttachedFile] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handlePaperclipClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    setUploadingFile(true);

    try {
      // 1. Get or create knowledge base for this workspace
      let kbId = "";
      const kbRes = await apiFetch(`/documents/kb?workspace_id=${workspaceId}`);
      if (kbRes.ok) {
        const kbData = await kbRes.json();
        if (Array.isArray(kbData) && kbData.length > 0) {
          kbId = kbData[0].id;
        }
      }

      if (!kbId) {
        // Create new knowledge base
        const createRes = await apiFetch("/documents/kb", {
          method: "POST",
          body: JSON.stringify({
            workspace_id: workspaceId,
            name: "Default Chat Knowledge Base",
            description: "Automatically created for Chat Studio file attachments",
            vector_settings: {}
          })
        });
        if (createRes.ok) {
          const createData = await createRes.json();
          kbId = createData.id;
        } else {
          throw new Error("Failed to create default knowledge base");
        }
      }

      // 2. Upload file
      const formData = new FormData();
      formData.append("knowledge_base_id", kbId);
      formData.append("file", file);

      const uploadRes = await apiFetch("/documents/upload", {
        method: "POST",
        body: formData
      });

      if (uploadRes.ok) {
        const uploadData = await uploadRes.json();
        setAttachedFile(file.name);
      } else {
        const errData = await uploadRes.json();
        throw new Error(errData.detail || "Failed to upload file");
      }
    } catch (err: any) {
      console.error("Attachment upload error:", err);
      alert(`Upload failed: ${err.message || err}`);
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Load chat sessions from database on mount
  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = () => {
    apiFetch(`/chats/?workspace_id=${workspaceId}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setSessions(data);
          if (data.length > 0 && !activeSessionId) {
            selectSession(data[0].id);
          }
        }
      })
      .catch((err) => console.log("Failed to load threads list", err));
  };

  const createNewSession = () => {
    apiFetch(`/chats/`, {
      method: "POST",
      body: JSON.stringify({
        workspace_id: workspaceId,
        title: "New Analysis Thread"
      })
    })
      .then((res) => res.json())
      .then((newChat) => {
        setSessions((prev) => [newChat, ...prev]);
        selectSession(newChat.id);
      });
  };

  const selectSession = (chatId: string) => {
    setActiveSessionId(chatId);
    setLoading(true);
    apiFetch(`/chats/${chatId}/messages`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setMessages(data);
        }
      })
      .finally(() => setLoading(false));
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading || !activeSessionId) return;

    const userMessage: Message = {
      id: Math.random().toString(),
      role: "user",
      content: input + (attachedFile ? ` [File: ${attachedFile}]` : ""),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setAttachedFile(null);
    setLoading(true);

    const assistantMessageId = Math.random().toString();
    // Insert placeholder message for streaming
    setMessages((prev) => [
      ...prev,
      {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        citations: []
      }
    ]);

    try {
      const { accessToken } = useAuthStore.getState();
      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      };
      if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`;
      }

      const res = await fetch(`http://localhost:8000/api/v1/chats/${activeSessionId}/messages/stream`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          chat_id: activeSessionId,
          role: "user",
          content: userMessage.content,
          selected_agent: selectedAgent
        })
      });

      if (!res.ok) {
        throw new Error("Local backend offline.");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("Response body is not readable.");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const cleanLine = line.trim();
          if (!cleanLine.startsWith("data: ")) continue;

          try {
            const jsonStr = cleanLine.substring(6);
            const data = JSON.parse(jsonStr);

            if (data.event === "token") {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, content: msg.content + data.text }
                    : msg
                )
              );
            } else if (data.event === "agent_start") {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? {
                        ...msg,
                        content: msg.content + `\n*[Active Node: Running ${data.agent}...]*\n`
                      }
                    : msg
                )
              );
            } else if (data.event === "done") {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? {
                        ...msg,
                        id: data.message_id,
                        content: data.response,
                        citations: data.citations || [],
                        evaluations: data.evaluations,
                        metrics: {
                          iterations: data.evaluations ? 2 : 0,
                          agent_history: data.agent_history || []
                        }
                      }
                    : msg
                )
              );
            }
          } catch (e) {
            console.error("Error parsing stream chunk:", e);
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content: `Error: ${err.message || "Failed to fetch response stream."}`
              }
            : msg
        )
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden h-[calc(100vh-4rem)]">
      {/* 1. Sidebar Channels */}
      <aside className="w-64 border-r border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/10 p-4 flex flex-col justify-between hidden md:flex shrink-0">
        <div className="space-y-4 overflow-hidden">
          <button 
            onClick={createNewSession}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold py-2.5 rounded-xl transition shadow-glow"
          >
            <Plus className="h-4 w-4" /> New Discussion
          </button>
          
          <div className="space-y-1 overflow-y-auto max-h-[350px]">
            <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold px-2 mb-2">History Channels</p>
            {sessions.map((s) => (
              <div
                key={s.id}
                onClick={() => selectSession(s.id)}
                className={`p-3 rounded-xl cursor-pointer transition flex flex-col border ${
                  activeSessionId === s.id
                    ? "bg-slate-200/60 dark:bg-slate-800/40 border-slate-300 dark:border-slate-700/80 text-indigo-600 dark:text-indigo-400 font-bold"
                    : "border-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/40"
                }`}
              >
                <span className="text-xs truncate">{s.title}</span>
                <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium">Chat ID: {s.id.slice(0, 8)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-3 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <p className="text-[10px] text-slate-400 font-bold flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 text-indigo-500" />
            <span>PostgreSQL Context Active</span>
          </p>
        </div>
      </aside>

      {/* 2. Middle Chat Stream */}
      <div className="flex-1 flex flex-col justify-between bg-slate-100/10 dark:bg-slate-950/20">
        <div className="h-14 border-b border-slate-200 dark:border-slate-800/80 px-6 flex items-center justify-between bg-slate-50/40 dark:bg-slate-900/10">
          <div className="flex items-center gap-3">
            <Sparkles className="h-4.5 w-4.5 text-indigo-500" />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Workspace Orchestrator Stream</span>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl px-3 py-1.5 focus:outline-none cursor-pointer"
            >
              <option value="auto">Auto Orchestrator</option>
              <option value="rag">RAG Search Agent</option>
              <option value="research">Web Research Agent</option>
              <option value="code">Python Sandbox Agent</option>
              <option value="analytics">Telemetry Agent</option>
            </select>

            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl px-3 py-1.5 focus:outline-none cursor-pointer"
            >
              <option value="openai-gpt4o">OpenAI GPT-4o</option>
              <option value="anthropic-claude35">Claude 3.5 Sonnet</option>
              <option value="deepseek-r1">DeepSeek R1</option>
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((m) => (
            <div key={m.id} className={`flex gap-4 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              {m.role !== "user" && (
                <div className="h-8.5 w-8.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                  <Bot className="h-4.5 w-4.5" />
                </div>
              )}

              <div className="max-w-3xl space-y-2.5">
                <div className={`p-4.5 rounded-2xl border leading-relaxed text-sm ${
                  m.role === "user"
                    ? "bg-indigo-600 text-white border-transparent"
                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800/80 text-slate-800 dark:text-slate-200 shadow-sm"
                }`}>
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </div>

                {m.citations && m.citations.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {m.citations.map((c, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveCitation(c)}
                        className="text-[10px] bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-slate-200 dark:hover:bg-slate-800/80 flex items-center gap-1.5 transition font-bold"
                      >
                        <BookOpen className="h-3 w-3" />
                        Reference Source [{i + 1}]
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {m.role === "user" && (
                <div className="h-8.5 w-8.5 rounded-xl bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 shrink-0">
                  <User className="h-4.5 w-4.5" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-4 items-center">
              <div className="h-8.5 w-8.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 animate-pulse">
                <Bot className="h-4.5 w-4.5" />
              </div>
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 flex items-center gap-2">
                <RefreshCw className="h-3.5 w-3.5 text-indigo-500 animate-spin" />
                <span className="text-xs text-slate-400 dark:text-slate-500 font-bold animate-pulse">Supervisor is planning sub-agent tasks...</span>
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleSend} className="p-6 border-t border-slate-200 dark:border-slate-800/80 bg-white/50 dark:bg-slate-950/40">
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 p-2 shadow-inner focus-within:border-indigo-500/50 transition">
            {attachedFile && (
              <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg max-w-xs mb-2">
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 truncate max-w-[180px]">
                  📎 {attachedFile}
                </span>
                <button
                  type="button"
                  onClick={() => setAttachedFile(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-[10px] font-bold ml-2.5"
                >
                  ✕
                </button>
              </div>
            )}
            
            {uploadingFile && (
              <div className="flex items-center gap-2 px-2 py-1 text-xs text-indigo-500 font-semibold mb-2 animate-pulse">
                <RefreshCw className="h-3 w-3 animate-spin" />
                <span>Indexing attachment chunks...</span>
              </div>
            )}

            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={activeSessionId ? "Ask the Supervisor..." : "Please create a new discussion thread..."}
              disabled={!activeSessionId || uploadingFile}
              rows={2}
              className="w-full bg-transparent resize-none py-1 px-2 text-sm focus:outline-none text-slate-700 dark:text-slate-200 placeholder-slate-400"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
            />
            <div className="flex justify-between items-center border-t border-slate-100 dark:border-slate-800/80 pt-2 px-1">
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".pdf,.docx,.txt"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={handlePaperclipClick}
                  disabled={uploadingFile}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-350 transition disabled:opacity-40"
                >
                  <Paperclip className="h-4.5 w-4.5" />
                </button>
              </div>
              <button
                type="submit"
                disabled={loading || uploadingFile || !input.trim() || !activeSessionId}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition disabled:opacity-40"
              >
                <span>Send Prompt</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* 3. Citations sidebar */}
      {activeCitation && (
        <aside className="w-80 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/10 p-6 flex flex-col justify-between overflow-y-auto shrink-0 z-20">
          <div className="space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-indigo-500" />
                <h3 className="font-bold text-sm text-slate-700 dark:text-slate-200">Citation Details</h3>
              </div>
              <button onClick={() => setActiveCitation(null)} className="text-slate-400 hover:text-slate-200 text-xs font-bold">Close</button>
            </div>
            <div className="space-y-3">
              <span className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20">{activeCitation.title}</span>
              <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-950/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800/80 shadow-inner">"{activeCitation.text}"</div>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
