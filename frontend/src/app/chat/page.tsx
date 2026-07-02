"use client";

import React, { useState, useEffect, useRef } from "react";
import { apiFetch } from "@/app/utils/api";
import { useAuthStore } from "@/app/store/authStore";
import { ChatSkeleton } from "@/components/Skeletons";
import EmptyState from "@/components/EmptyState";
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
  RefreshCw,
  Check,
  Loader2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  X,
  PanelRightClose,
  PanelRightOpen,
  Terminal,
  Activity
} from "lucide-react";

interface AgentStep {
  name: string;
  status: "pending" | "running" | "completed";
}

interface Message {
  id: string;
  role: string;
  content: string;
  citations?: Array<{ title: string; text: string; doc_id?: string; page?: number | string }>;
  metrics?: { iterations?: number; agent_history?: string[] };
  evaluations?: {
    groundedness_score?: number;
    faithfulness_score?: number;
    hallucination_score?: number;
  };
  agentSteps?: AgentStep[];
  isStreaming?: boolean;
}

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
}

export default function ChatPage() {
  const { activeWorkspaceId } = useAuthStore();
  const workspaceId = activeWorkspaceId || "8501bde6-222d-42d6-9d75-ae480447a0c0";
  
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState("openai-gpt4o");
  const [selectedAgent, setSelectedAgent] = useState("auto");
  const [loading, setLoading] = useState(true);
  const [activeCitation, setActiveCitation] = useState<any>(null);
  const [sourcesPanelOpen, setSourcesPanelOpen] = useState(false);
  const [attachedFile, setAttachedFile] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({});
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const handlePaperclipClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Auto scroll to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

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

  // Load chat sessions from database on mount or when workspaceId changes
  useEffect(() => {
    fetchSessions();
  }, [workspaceId]);

  const fetchSessions = () => {
    apiFetch(`/chats/?workspace_id=${workspaceId}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setSessions(data);
          if (data.length > 0 && !activeSessionId) {
            selectSession(data[0].id);
          } else {
            setLoading(false);
          }
        } else {
          setLoading(false);
        }
      })
      .catch((err) => {
        console.log("Failed to load threads list", err);
        setLoading(false);
      });
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
    setMessages([]);
    apiFetch(`/chats/${chatId}/messages`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const formatted = data.map((msg: any) => {
            const history = msg.metrics?.agent_history || [];
            return {
              ...msg,
              isStreaming: false,
              agentSteps: msg.agentSteps || history.map((name: string) => ({
                name,
                status: "completed" as const
              }))
            };
          });
          setMessages(formatted);
        }
      })
      .finally(() => setLoading(false));
  };

  const deleteSession = (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this thread?")) {
      apiFetch(`/chats/${chatId}`, { method: "DELETE" })
        .then(() => {
          setSessions((prev) => prev.filter((s) => s.id !== chatId));
          if (activeSessionId === chatId) {
            setMessages([]);
            setActiveSessionId(null);
          }
        })
        .catch((err) => console.error(err));
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading || uploadingFile) return;

    let currentSessionId = activeSessionId;
    setLoading(true);
    const assistantMessageId = Math.random().toString();

    try {
      // Create session on-the-fly if none selected
      if (!currentSessionId) {
        const createRes = await apiFetch(`/chats/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspace_id: workspaceId,
            title: input.trim().slice(0, 30) || "New Discussion"
          })
        });
        if (!createRes.ok) {
          throw new Error("Failed to initialize a new discussion thread.");
        }
        const newChat = await createRes.json();
        setSessions((prev) => [newChat, ...prev]);
        currentSessionId = newChat.id;
        setActiveSessionId(newChat.id);
      }

      const userMessage: Message = {
        id: Math.random().toString(),
        role: "user",
        content: input + (attachedFile ? ` [File: ${attachedFile}]` : ""),
      };
      
      // Batch state update for user message and assistant placeholder
      setMessages((prev) => [
        ...prev,
        userMessage,
        {
          id: assistantMessageId,
          role: "assistant",
          content: "",
          citations: [],
          agentSteps: [
            { name: "Initializing Supervisor Orchestrator", status: "running" }
          ],
          isStreaming: true
        }
      ]);

      setInput("");
      setAttachedFile(null);

      const { accessToken } = useAuthStore.getState();
      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      };
      if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`;
      }

      const res = await fetch(`http://localhost:8000/api/v1/chats/${currentSessionId}/messages/stream`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          chat_id: currentSessionId,
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
                prev.map((msg) => {
                  if (msg.id !== assistantMessageId) return msg;

                  const currentSteps = msg.agentSteps ? [...msg.agentSteps] : [];
                  
                  // Mark the previous running steps as completed
                  const runningIdx = currentSteps.findIndex((s) => s.status === "running");
                  if (runningIdx !== -1) {
                    currentSteps[runningIdx] = { ...currentSteps[runningIdx], status: "completed" };
                  }

                  // Add new step as running
                  const friendlyName = data.agent.replace(/_|-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
                  if (!currentSteps.some((s) => s.name === friendlyName)) {
                    currentSteps.push({ name: friendlyName, status: "running" });
                  }

                  return { ...msg, agentSteps: currentSteps };
                })
              );
            } else if (data.event === "done") {
              setMessages((prev) =>
                prev.map((msg) => {
                  if (msg.id !== assistantMessageId) return msg;

                  const history = data.agent_history || [];
                  const finalSteps = history.map((name: string) => {
                    const friendly = name.replace(/_|-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
                    return {
                      name: friendly,
                      status: "completed" as const
                    };
                  });

                  if (finalSteps.length === 0 && msg.agentSteps) {
                    finalSteps.push(...msg.agentSteps.map((s) => ({ ...s, status: "completed" as const })));
                  }

                  return {
                    ...msg,
                    id: data.message_id,
                    content: data.response,
                    citations: data.citations || [],
                    evaluations: data.evaluations,
                    metrics: {
                      iterations: data.evaluations ? 2 : 0,
                      agent_history: data.agent_history || []
                    },
                    agentSteps: finalSteps,
                    isStreaming: false
                  };
                })
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
                content: `Error: ${err.message || "Failed to fetch response stream."}`,
                isStreaming: false
              }
            : msg
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleSteps = (msgId: string) => {
    setExpandedSteps((prev) => ({
      ...prev,
      [msgId]: !prev[msgId]
    }));
  };

  // Parse [1] [2] citations inside content into interactive buttons
  const renderMessageContent = (msg: Message) => {
    const content = msg.content;
    const citations = msg.citations;

    if (msg.isStreaming && !content) {
      return (
        <div className="flex items-center gap-2 text-slate-400 font-semibold text-xs animate-pulse py-1">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />
          <span>Thinking...</span>
          <span className="inline-block w-1.5 h-3.5 bg-indigo-500 dark:bg-indigo-400 animate-pulse rounded-sm align-middle">▌</span>
        </div>
      );
    }

    if (!citations || citations.length === 0) {
      return (
        <p className="whitespace-pre-wrap leading-relaxed text-slate-800 dark:text-slate-200">
          {content}
          {msg.isStreaming && (
            <span className="inline-block w-1.5 h-3.5 ml-1 bg-indigo-500 dark:bg-indigo-400 animate-pulse rounded-sm align-middle">▌</span>
          )}
        </p>
      );
    }

    const parts = content.split(/(\[\d+\])/g);
    return (
      <p className="whitespace-pre-wrap leading-relaxed text-slate-800 dark:text-slate-200">
        {parts.map((part, index) => {
          const match = part.match(/^\[(\d+)\]$/);
          if (match) {
            const citeIdx = parseInt(match[1], 10) - 1;
            const citation = citations[citeIdx];
            if (citation) {
              return (
                <button
                  key={index}
                  onClick={() => {
                    setActiveCitation(citation);
                    setSourcesPanelOpen(true);
                  }}
                  className="inline-flex items-center justify-center px-1.5 py-0.5 mx-0.5 text-[9px] font-bold bg-indigo-500/10 hover:bg-indigo-500/25 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 rounded-md transition cursor-pointer shrink-0 align-super"
                  title={citation.title}
                >
                  {match[1]}
                </button>
              );
            }
          }
          return part;
        })}
        {msg.isStreaming && (
          <span className="inline-block w-1.5 h-3.5 ml-1 bg-indigo-500 dark:bg-indigo-400 animate-pulse rounded-sm align-middle">▌</span>
        )}
      </p>
    );
  };

  if (loading && messages.length === 0) {
    return <ChatSkeleton />;
  }

  return (
    <div className="flex-1 flex overflow-hidden h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-950">
      
      {/* 1. Sleek Discussion Sidebar */}
      <aside className="w-64 border-r border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-950 flex flex-col justify-between hidden md:flex shrink-0">
        <div className="p-4 flex flex-col flex-1 min-h-0 space-y-4">
          <button 
            onClick={createNewSession}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2.5 rounded-xl transition duration-150 shadow-[0_0_12px_rgba(99,102,241,0.3)]"
          >
            <Plus className="h-4 w-4" /> New Discussion
          </button>
          
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-black px-2 mb-2">History threads</p>
            {sessions.map((s, idx) => (
              <div
                key={s.id || idx}
                onClick={() => s.id && selectSession(s.id)}
                className={`group p-3 rounded-xl cursor-pointer transition-all duration-150 flex items-center justify-between border ${
                  activeSessionId === s.id
                    ? "bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-indigo-600 dark:text-indigo-400 font-bold"
                    : "border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/50 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                <div className="flex flex-col min-w-0">
                  <span className="text-xs truncate pr-2">{s.title}</span>
                  <span className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold mt-0.5">ID: {s.id ? s.id.slice(0, 8) : "Session"}</span>
                </div>
                <button
                  onClick={(e) => s.id && deleteSession(s.id, e)}
                  className="p-1 rounded text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 opacity-0 group-hover:opacity-100 transition shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-900/10">
          <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-500" />
            <div className="text-left">
              <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider leading-none">Database Status</p>
              <p className="text-[11px] text-slate-700 dark:text-slate-300 font-bold leading-none mt-1">Postgres Sync</p>
            </div>
          </div>
        </div>
      </aside>

      {/* 2. Chat Workspace Container */}
      <div className="flex-1 flex flex-col justify-between relative overflow-hidden">
        
        {/* Header Controls */}
        <header className="h-14 border-b border-slate-200 dark:border-slate-900 px-6 flex items-center justify-between bg-white dark:bg-slate-950 z-10 shrink-0">
          <div className="flex items-center gap-3">
            <Sparkles className="h-4 w-4 text-indigo-500" />
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest">Orchestrator Workspace</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Target Agent Selection */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-900 rounded-xl p-1 border border-slate-200 dark:border-slate-800">
              <select
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                className="text-xs bg-transparent border-none text-slate-700 dark:text-slate-350 rounded-lg px-2.5 py-1 focus:outline-none cursor-pointer font-bold"
              >
                <option value="auto">Auto Orchestrator</option>
                <option value="rag">RAG Search Agent</option>
                <option value="research">Web Research Agent</option>
                <option value="code">Python Sandbox Agent</option>
                <option value="analytics">Telemetry Agent</option>
              </select>
            </div>

            {/* Model Selection */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-900 rounded-xl p-1 border border-slate-200 dark:border-slate-800">
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="text-xs bg-transparent border-none text-slate-700 dark:text-slate-350 rounded-lg px-2.5 py-1 focus:outline-none cursor-pointer font-bold"
              >
                <option value="openai-gpt4o">OpenAI GPT-4o</option>
                <option value="anthropic-claude35">Claude 3.5 Sonnet</option>
                <option value="deepseek-r1">DeepSeek R1</option>
              </select>
            </div>

            {/* Sources Toggle Button */}
            <button
              onClick={() => setSourcesPanelOpen(!sourcesPanelOpen)}
              className={`p-2 rounded-xl border transition ${
                sourcesPanelOpen
                  ? "bg-indigo-500/10 border-indigo-500/40 text-indigo-500"
                  : "bg-slate-100 dark:bg-slate-900 border-slate-250 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200/50"
              }`}
              title="Toggle Sources Drawer"
            >
              {sourcesPanelOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
            </button>
          </div>
        </header>

        {/* Message Stream Area */}
        <div className="flex-1 overflow-y-auto px-4 py-8 space-y-8 bg-slate-50/50 dark:bg-slate-950/20">
          <div className="max-w-3xl mx-auto space-y-8">
            {messages.length === 0 ? (
              <EmptyState
                type="chat"
                title="How can I assist your workflow today?"
                description="Ask the Supervisor to ingest documentation, run models, or structure automated pipelines."
                actionLabel="Create New Discussion"
                onActionClick={createNewSession}
              />
            ) : (
              messages.map((m) => {
                const isUser = m.role === "user";
                const hasSteps = m.agentSteps && m.agentSteps.length > 0;
                const showSteps = expandedSteps[m.id] !== false; // expanded by default

                return (
                  <div 
                    key={m.id} 
                    className={`flex items-start gap-4 ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    {/* Bot Avatar */}
                    {!isUser && (
                      <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow-[0_0_10px_rgba(99,102,241,0.2)]">
                        <Sparkles className="h-4 w-4" />
                      </div>
                    )}

                    <div className={`max-w-2xl space-y-3 ${isUser ? "order-1" : "order-2 text-left"}`}>
                      {/* Timeline Thinking Stepper (ChatGPT Style) */}
                      {!isUser && hasSteps && (
                        <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 space-y-3 shadow-sm transition-all duration-300">
                          <button
                            onClick={() => toggleSteps(m.id)}
                            className="flex items-center justify-between w-full text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition text-[10px] font-black uppercase tracking-wider cursor-pointer"
                          >
                            <span className="flex items-center gap-1.5">
                              <Terminal className="h-3.5 w-3.5 text-indigo-500" />
                              Agent Reasoning Steps ({m.agentSteps?.filter(s => s.status === "completed").length}/{m.agentSteps?.length})
                            </span>
                            <span className="flex items-center gap-1">
                              {showSteps ? "Hide Process" : "Show Process"}
                              <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${showSteps ? "rotate-180" : ""}`} />
                            </span>
                          </button>

                          {showSteps && (
                            <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                              {m.agentSteps?.map((step, idx) => {
                                const isDone = step.status === "completed";
                                const isCurrent = step.status === "running";
                                return (
                                  <div key={idx} className="flex items-center gap-2.5 text-xs text-slate-650 dark:text-slate-350">
                                    <div className="flex items-center justify-center shrink-0">
                                      {isDone ? (
                                        <div className="h-4.5 w-4.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-500 font-bold text-[9px]">
                                          ✓
                                        </div>
                                      ) : isCurrent ? (
                                        <div className="h-4.5 w-4.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-500">
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                        </div>
                                      ) : (
                                        <div className="h-4.5 w-4.5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500 font-bold text-[9px]">
                                          ○
                                        </div>
                                      )}
                                    </div>
                                    <span className={`${isDone ? "text-slate-400 dark:text-slate-500 font-medium" : isCurrent ? "text-indigo-600 dark:text-indigo-400 font-extrabold animate-pulse" : "text-slate-400"}`}>
                                      {step.name}
                                    </span>
                                  </div>
                                );
                              })}
                              {m.isStreaming && m.agentSteps?.every(s => s.status === "completed") && (
                                <div className="flex items-center gap-2.5 text-xs text-indigo-650 dark:text-indigo-400 font-bold animate-pulse">
                                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                                  <span>Generating Response...</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Main Message Text bubble */}
                      <div className={`p-4 rounded-2xl text-[14px] leading-relaxed shadow-sm transition-all duration-200 border ${
                        isUser
                          ? "bg-indigo-600 text-white border-transparent shadow-[0_4px_15px_rgba(99,102,241,0.15)] rounded-br-none"
                          : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-900/60 text-slate-800 dark:text-slate-200 rounded-bl-none"
                      }`}>
                        {isUser ? (
                          <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                        ) : (
                          renderMessageContent(m)
                        )}
                      </div>

                      {/* Document Citations Block */}
                      {!isUser && m.citations && m.citations.length > 0 && (
                        <div className="space-y-1.5 text-left">
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-wider px-1">Sources</p>
                          <div className="flex flex-wrap gap-2">
                            {m.citations.map((c, i) => (
                              <button
                                key={i}
                                onClick={() => {
                                  setActiveCitation(c);
                                  setSourcesPanelOpen(true);
                                }}
                                className="flex items-center gap-1.5 text-[11px] bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-xl text-slate-650 dark:text-slate-350 transition font-bold cursor-pointer"
                              >
                                <BookOpen className="h-3 w-3 text-indigo-500" />
                                <span className="max-w-[150px] truncate">{c.title}</span>
                                <span className="text-[9px] text-slate-400 dark:text-slate-500 font-normal">[{i + 1}]</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* User Avatar */}
                    {isUser && (
                      <div className="h-8 w-8 rounded-lg bg-slate-200 dark:bg-slate-850 flex items-center justify-center text-slate-700 dark:text-slate-300 shrink-0 border border-slate-300 dark:border-slate-800 shadow-sm">
                        <User className="h-4.5 w-4.5" />
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {loading && messages.filter(m => m.role === "assistant").length === 0 && (
              <div className="flex items-start gap-4">
                <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0 animate-pulse">
                  <Bot className="h-4.5 w-4.5" />
                </div>
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 flex items-center gap-2 shadow-sm text-left">
                  <Loader2 className="h-4 w-4 text-indigo-500 animate-spin" />
                  <span className="text-xs text-slate-400 dark:text-slate-500 font-bold animate-pulse">Orchestrator scheduling pipeline...</span>
                </div>
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>
        </div>

        {/* 3. Center Bottom Input Area */}
        <div className="p-4 md:p-6 border-t border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-950 shrink-0">
          <form onSubmit={handleSend} className="max-w-3xl mx-auto relative">
            <div className="border border-slate-250 dark:border-slate-800/80 rounded-2xl bg-slate-50 dark:bg-slate-900/40 p-2.5 shadow-sm focus-within:border-indigo-500/50 focus-within:bg-white dark:focus-within:bg-slate-900 transition duration-150">
              
              {/* File Upload Preview Bubble */}
              {attachedFile && (
                <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl max-w-xs mb-2">
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
              
              {/* File uploading progress indicator */}
              {uploadingFile && (
                <div className="flex items-center gap-2 px-2 py-1 text-xs text-indigo-500 font-bold mb-2 animate-pulse">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Ingesting attachment shards...</span>
                </div>
              )}

              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={activeSessionId ? "Type a prompt, attach a file, or ask for research..." : "Type a prompt to start a new discussion..."}
                disabled={uploadingFile}
                rows={2}
                className="w-full bg-transparent resize-none py-1.5 px-2 text-sm focus:outline-none text-slate-700 dark:text-slate-200 placeholder-slate-450 leading-relaxed"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(e);
                  }
                }}
              />

              <div className="flex justify-between items-center border-t border-slate-200/60 dark:border-slate-800/60 pt-2.5 px-1">
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
                    className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition disabled:opacity-40 cursor-pointer"
                    title="Attach Knowledge File (.pdf, .docx, .txt)"
                  >
                    <Paperclip className="h-4.5 w-4.5" />
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading || uploadingFile || !input.trim()}
                  className="flex items-center justify-center h-8 w-8 bg-indigo-650 hover:bg-indigo-500 text-white rounded-lg transition duration-150 disabled:opacity-30 disabled:hover:bg-indigo-650 cursor-pointer shadow-sm"
                  title="Send message"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
            <p className="text-[10px] text-slate-440 dark:text-slate-500 text-center mt-2 font-medium">IntelFlow uses multi-agent supervisor models. System checks compliance in real-time.</p>
          </form>
        </div>
      </div>

      {/* 4. Sliding Citations Drawer Panel (ChatGPT Style) */}
      {sourcesPanelOpen && (
        <aside className="w-80 border-l border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-950 p-6 flex flex-col justify-between overflow-y-auto shrink-0 z-20 animate-in slide-in-from-right duration-250">
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-indigo-500" />
                <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-200">Knowledge Sources</h3>
              </div>
              <button 
                onClick={() => setSourcesPanelOpen(false)} 
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-400 hover:text-slate-650 dark:hover:text-slate-255 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {activeCitation ? (
              <div className="space-y-4 text-left">
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase font-black text-indigo-600 dark:text-indigo-400 bg-indigo-550/10 px-2.5 py-1 rounded-lg border border-indigo-500/20 w-fit block">
                    {activeCitation.title}
                  </span>
                  {activeCitation.page && (
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2.5 py-1 rounded-lg w-fit block">
                      Page/Section {activeCitation.page}
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Source Excerpt</p>
                  <div className="text-xs text-slate-700 dark:text-slate-350 leading-relaxed bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-850 shadow-inner">
                    "{activeCitation.text}"
                  </div>
                </div>

                {activeCitation.doc_id && (
                  <a
                    href={`http://localhost:8000/uploads/${activeCitation.doc_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-2.5 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 font-bold text-xs rounded-xl flex items-center justify-center gap-2 text-slate-650 dark:text-slate-300 transition"
                  >
                    <span>Open Original Document</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            ) : (
              <div className="py-12 flex flex-col items-center gap-3 text-center">
                <BookOpen className="h-10 w-10 text-slate-300 dark:text-slate-800" />
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Click on any citation index badge inside the responses or source cards to load the excerpt details.</p>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-900 text-[10px] text-slate-450 dark:text-slate-500 text-center font-bold">
            Real-time RAG Guardrails enabled.
          </div>
        </aside>
      )}

    </div>
  );
}
