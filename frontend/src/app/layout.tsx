"use client";

import "./globals.css";
import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/app/store/authStore";
import { apiFetch } from "@/app/utils/api";
import RealTimeNotifier from "../components/RealTimeNotifier";
import BrandLogo from "../components/BrandLogo";


import {
  LayoutDashboard,
  MessageSquare,
  Shield,
  Workflow,
  FolderLock,
  Settings,
  Database,
  Users as UsersIcon,
  FileCode,
  Activity,
  ChevronLeft,
  ChevronRight,
  Search,
  Bell,
  Sun,
  Moon,
  ChevronDown,
  Globe,
  Sparkles,
  Network,
  Plug,
  Mic,
  ScanText,
  Video,
  BrainCircuit,
  Brain,
  Check,
  X,
  Building2,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Info,
  DollarSign,
  Radio
} from "lucide-react";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  
  // Collapse state for sidebar
  const [collapsed, setCollapsed] = useState(false);
  
  // Theme state: dark (default) or light
  const [theme, setTheme] = useState("dark");

  const { accessToken, user, clearAuth, activeWorkspaceId, activeWorkspaceName, setActiveWorkspace } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  // Dropdown / panel state
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);
  const [sidebarOrgDropdownOpen, setSidebarOrgDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [activeOrg, setActiveOrg] = useState("Global Org Context");
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [notifications, setNotifications] = useState([
    { id: 1, type: "success", title: "Document indexed", body: "Employee_Handbook.pdf has been vectorized.", time: "2m ago", read: false },
    { id: 2, type: "info", title: "Agent workflow complete", body: "RAG pipeline finished with 98.5% SLA compliance.", time: "14m ago", read: false },
    { id: 3, type: "warning", title: "Celery queue degraded", body: "Redis connection latency above 200ms threshold.", time: "1h ago", read: true },
    { id: 4, type: "info", title: "New model registered", body: "GPT-4o added to Model Registry by admin.", time: "3h ago", read: true },
  ]);

  const orgRef = useRef<HTMLDivElement>(null);
  const sidebarOrgRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const mockOrgs = [
    { id: "global", name: "Global Org Context", members: 24, status: "active" },
    { id: "engineering", name: "Engineering Division", members: 8, status: "active" },
    { id: "research", name: "Research & AI Team", members: 5, status: "active" },
    { id: "ops", name: "Operations Workspace", members: 11, status: "inactive" },
  ];

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = () => setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  const dismissNotif = (id: number) => setNotifications(prev => prev.filter(n => n.id !== id));

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (orgRef.current && !orgRef.current.contains(e.target as Node)) setOrgDropdownOpen(false);
      if (sidebarOrgRef.current && !sidebarOrgRef.current.contains(e.target as Node)) setSidebarOrgDropdownOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Shortcut listeners (⌥A for AI Assistant Chat)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        router.push("/chat");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  // Sync state class with DOM
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === "light") {
      root.classList.add("light");
      root.classList.remove("dark");
    } else {
      root.classList.add("dark");
      root.classList.remove("light");
    }
  }, [theme]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (accessToken) {
      fetchWorkspaces();
    }
  }, [accessToken]);

  const fetchWorkspaces = () => {
    apiFetch("/auth/workspaces")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load workspaces");
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setWorkspaces(data);
          if (data.length > 0 && !activeWorkspaceId) {
            setActiveWorkspace(data[0].id, data[0].name);
          }
        }
      })
      .catch((err) => console.error("Workspaces load error", err));
  };

  const handleCreateWorkspace = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;
    
    apiFetch("/auth/workspaces", {
      method: "POST",
      body: JSON.stringify({ name: newWorkspaceName })
    })
      .then((res) => {
        if (!res.ok) throw new Error("Workspace creation failed");
        return res.json();
      })
      .then((data) => {
        setNewWorkspaceName("");
        fetchWorkspaces();
        if (data.id) {
          setActiveWorkspace(data.id, data.name);
        }
      })
      .catch((err) => alert(err.message));
  };

  const isAuthRoute = pathname && (
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/verify-email")
  );

  const isLandingRoute = pathname === "/";

  useEffect(() => {
    if (!mounted) return;

    if (!accessToken && !isAuthRoute && !isLandingRoute) {
      router.push("/login");
    } else if (accessToken && isAuthRoute) {
      router.push("/dashboard");
    }
  }, [accessToken, isAuthRoute, isLandingRoute, mounted]);

  // Collapsible Sidebar links definition (Linear groups)
  const workspaceItems = [
    { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard, shortcut: "D" },
    { name: "Chat Studio", path: "/chat", icon: MessageSquare, shortcut: "C" },
    { name: "Agent Studio", path: "/agents", icon: Shield, shortcut: "A" },
  ];

  const intelligenceItems = [
    { name: "Knowledge Base", path: "/documents", icon: Database, shortcut: "K" },
    { name: "Knowledge Graph", path: "/knowledge-graph", icon: Network, shortcut: "G" },
    { name: "Memory Studio", path: "/memory", icon: Brain, shortcut: "M" },
    { name: "Workflows", path: "/workflows", icon: Workflow, shortcut: "W" },
    { name: "Integrations", path: "/integrations", icon: Plug, shortcut: "I" },
    { name: "Voice RAG", path: "/voice-rag", icon: Mic, shortcut: "V" },
    { name: "OCR Intelligence", path: "/ocr", icon: ScanText, shortcut: "O" },
    { name: "Meeting Intel", path: "/meeting", icon: Video, shortcut: "E" },
    { name: "Auto Research", path: "/research", icon: BrainCircuit, shortcut: "R" },
  ];

  const isAdmin = !user || user.role === "super_admin" || user.role === "admin" || user.role === "org_admin";

  const adminItems = [
    { name: "Model Registry", path: "/models", icon: FileCode, shortcut: "M" },
    { name: "LLMOps Dashboard", path: "/llmops", icon: Sparkles, shortcut: "P" },
    { name: "Cost & Billing", path: "/cost", icon: DollarSign, shortcut: "$" },
    { name: "AI Observatory", path: "/observatory", icon: Radio, shortcut: "B" },
    ...(isAdmin ? [{ name: "Users & IAM", path: "/users", icon: UsersIcon, shortcut: "U" }] : []),
    { name: "Audit Logging", path: "/audit-logs", icon: FolderLock, shortcut: "L" },
    { name: "Analytics Logs", path: "/analytics", icon: Activity, shortcut: "N" },
    ...(isAdmin ? [{ name: "Settings", path: "/settings", icon: Settings, shortcut: "S" }] : []),
  ];

  const isRestrictedRoute = pathname && (pathname.startsWith("/settings") || pathname.startsWith("/users"));
  const isUnauthorized = !isAdmin && isRestrictedRoute;

  const getPageTitle = () => {
    if (!pathname || pathname === "/") return "IntelFlow — Multi-Agent Enterprise RAG Platform";
    const segment = pathname.split("/").filter(Boolean).pop();
    if (!segment) return "IntelFlow — Multi-Agent Enterprise RAG Platform";
    const formatted = segment.charAt(0).toUpperCase() + segment.slice(1).replace("-", " ");
    return `${formatted} | IntelFlow — Enterprise RAG OS`;
  };

  return (
    <html lang="en" className={theme === "light" ? "light" : "dark"}>
      <head>
        <title>{getPageTitle()}</title>
        <meta name="description" content="IntelFlow is an advanced enterprise multi-agent RAG operating system with workflow builders, real-time analytics telemetry, and natural language citation interfaces." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="mesh-bg min-h-screen text-slate-900 dark:text-slate-100 transition-colors duration-200">
        {mounted && <RealTimeNotifier />}
        {!mounted ? null : !accessToken && !isAuthRoute && !isLandingRoute ? null : isAuthRoute ? (
          <main className="w-full min-h-screen flex items-center justify-center p-4">
            {children}
          </main>
        ) : isLandingRoute ? (
          <div className="min-h-screen flex flex-col w-full">
            <main className="w-full flex-1">
              {children}
            </main>
          </div>
        ) : (
          <div className="min-h-screen flex w-full">
        
        {/* Persistent Collapsible Left Sidebar */}
        <aside 
          className={`glass-panel border-r border-slate-200 dark:border-slate-800/80 flex flex-col justify-between p-3.5 z-40 transition-all duration-300 relative ${
            collapsed ? "w-[4.75rem]" : "w-64"
          }`}
        >
          <div className="flex flex-col flex-1 min-h-0">
            {/* Header: Logo and Toggle Collapse */}
            <div className="flex items-center justify-between mb-4 pt-1.5 px-1">
              <BrandLogo collapsed={collapsed} />
              <button 
                onClick={() => setCollapsed(!collapsed)}
                className="p-1 rounded-md bg-slate-100/80 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 transition"
              >
                {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
              </button>
            </div>

            {/* Workspace switcher dropdown */}
            <div className="relative mb-2" ref={sidebarOrgRef}>
              <button
                onClick={() => setSidebarOrgDropdownOpen(!sidebarOrgDropdownOpen)}
                className={`w-full flex items-center justify-between p-1.5 rounded-xl transition-all duration-200 cursor-pointer ${
                  sidebarOrgDropdownOpen
                    ? "bg-slate-100/10 dark:bg-slate-800/40 border border-indigo-500/30"
                    : "hover:bg-slate-100/50 dark:hover:bg-slate-800/30 border border-transparent"
                }`}
              >
                <div className="flex items-center gap-2.5 overflow-hidden">
                  {/* Organization Avatar */}
                  <div className="h-7 w-7 rounded-lg bg-gradient-to-tr from-indigo-500 to-cyan-400 flex items-center justify-center font-bold text-xs text-white shadow-[0_0_12px_rgba(99,102,241,0.2)] shrink-0 relative">
                    {(activeWorkspaceName || "Default Workspace")[0]}
                    {/* Status Ring / Indicator */}
                    <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 border border-slate-950 shadow-[0_0_6px_#10b981]"></span>
                  </div>
                  {!collapsed && (
                    <div className="text-left transition-opacity duration-300 min-w-0">
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate leading-none mb-0.5">{activeWorkspaceName || "Default Workspace"}</p>
                      <p className="text-[9px] text-slate-400 dark:text-slate-500 truncate leading-none font-semibold">Workspace Context</p>
                    </div>
                  )}
                </div>
                {!collapsed && (
                  <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform duration-200 shrink-0 ml-1 ${sidebarOrgDropdownOpen ? "rotate-180" : ""}`} />
                )}
              </button>

              {/* Workspace switch dropdown list */}
              {sidebarOrgDropdownOpen && (
                <div className={`absolute top-full mt-1.5 w-60 bg-slate-950 border border-slate-850 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150 ${collapsed ? "left-0" : "left-0 right-0"}`}>
                  <div className="px-3 py-1.5 border-b border-slate-850">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Switch Workspace</p>
                  </div>
                  <div className="p-1 space-y-0.5 max-h-56 overflow-y-auto">
                    {workspaces.map(w => (
                      <button
                        key={w.id}
                        onClick={() => { setActiveWorkspace(w.id, w.name); setSidebarOrgDropdownOpen(false); }}
                        className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition text-left ${
                          activeWorkspaceId === w.id
                            ? "bg-indigo-600/10 text-indigo-400 font-semibold"
                            : "hover:bg-slate-850/60 text-slate-300 hover:text-white"
                        }`}
                      >
                        <div className="h-6 w-6 rounded bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-500/10 flex items-center justify-center font-bold text-[10px] shrink-0 text-indigo-400">
                          {w.name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate leading-none mb-0.5">{w.name}</p>
                          <p className="text-[9px] text-slate-500 leading-none">Active Context</p>
                        </div>
                        {activeWorkspaceId === w.id && (
                          <Check className="h-3 w-3 text-indigo-400 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                  <form onSubmit={handleCreateWorkspace} className="p-2 border-t border-slate-850 flex gap-2">
                    <input
                      type="text"
                      placeholder="Create Workspace..."
                      value={newWorkspaceName}
                      onChange={(e) => setNewWorkspaceName(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-850 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-200 focus:outline-none focus:border-indigo-500/50"
                    />
                    <button type="submit" className="bg-indigo-650 hover:bg-indigo-600 text-white rounded-lg px-2.5 py-1 text-[11px] font-bold cursor-pointer">
                      +
                    </button>
                  </form>
                </div>
              )}
            </div>

            {/* AI Assistant shortcut bar */}
            <div className="mb-2.5">
              <button
                onClick={() => router.push("/chat")}
                className={`w-full flex items-center p-2 rounded-xl transition-all duration-250 group border border-slate-200/5 dark:border-white/5 bg-slate-100/30 dark:bg-white/5 hover:bg-indigo-600/10 hover:border-indigo-500/30 text-indigo-600 dark:text-indigo-400 font-bold cursor-pointer ${
                  collapsed ? "justify-center" : "justify-between"
                }`}
              >
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <Sparkles className="h-4 w-4 text-indigo-500 shrink-0 group-hover:animate-pulse" />
                  {!collapsed && <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 truncate">AI Assistant</span>}
                </div>
                {!collapsed && (
                  <span className="text-[8px] font-mono text-slate-400 dark:text-slate-500 bg-slate-200/60 dark:bg-slate-900 border border-slate-350 dark:border-slate-800 px-1 py-0.5 rounded shadow-sm">
                    ⌥A
                  </span>
                )}
              </button>
            </div>

            {/* Sidebar navigation groups - Scrollable Wrapper */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-2 text-left">
              {/* Group 1: Workspace */}
              <div>
                {!collapsed && (
                  <p className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-2.5 mb-1 animate-fade-in">
                    Workspace
                  </p>
                )}
                <nav className="space-y-0.5">
                  {workspaceItems.map((item, idx) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.path;
                    return (
                      <Link 
                        key={idx} 
                        href={item.path}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl transition-all group relative border-l-2 ${
                          isActive 
                            ? "bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 font-semibold border-indigo-500"
                            : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-250 hover:bg-slate-100/50 dark:hover:bg-slate-800/30 border-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          <Icon className="h-4 w-4 shrink-0 transition-transform duration-250 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                          {!collapsed && <span className="text-xs font-semibold">{item.name}</span>}
                        </div>
                        {collapsed && (
                          <div className="absolute left-16 scale-0 group-hover:scale-100 transition-all z-50 bg-slate-950 text-white text-[10px] rounded px-2.5 py-1.5 font-bold shadow-lg pointer-events-none whitespace-nowrap">
                            {item.name}
                          </div>
                        )}
                      </Link>
                    );
                  })}
                </nav>
              </div>

              {/* Group 2: Intelligence */}
              <div>
                {!collapsed && (
                  <p className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-2.5 mb-1 animate-fade-in">
                    Intelligence
                  </p>
                )}
                <nav className="space-y-0.5">
                  {intelligenceItems.map((item, idx) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.path;
                    return (
                      <Link 
                        key={idx} 
                        href={item.path}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl transition-all group relative border-l-2 ${
                          isActive 
                            ? "bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 font-semibold border-indigo-500"
                            : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-250 hover:bg-slate-100/50 dark:hover:bg-slate-800/30 border-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          <Icon className="h-4 w-4 shrink-0 transition-transform duration-250 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                          {!collapsed && <span className="text-xs font-semibold truncate">{item.name}</span>}
                        </div>
                        {collapsed && (
                          <div className="absolute left-16 scale-0 group-hover:scale-100 transition-all z-50 bg-slate-950 text-white text-[10px] rounded px-2.5 py-1.5 font-bold shadow-lg pointer-events-none whitespace-nowrap">
                            {item.name}
                          </div>
                        )}
                      </Link>
                    );
                  })}
                </nav>
              </div>

              {/* Group 3: Operations */}
              <div>
                {!collapsed && (
                  <p className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-2.5 mb-1 animate-fade-in">
                    Operations
                  </p>
                )}
                <nav className="space-y-0.5">
                  {adminItems.map((item, idx) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.path;
                    return (
                      <Link 
                        key={idx} 
                        href={item.path}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl transition-all group relative border-l-2 ${
                          isActive 
                            ? "bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 font-semibold border-indigo-500"
                            : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-250 hover:bg-slate-100/50 dark:hover:bg-slate-800/30 border-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          <Icon className="h-4 w-4 shrink-0 transition-transform duration-250 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                          {!collapsed && <span className="text-xs font-semibold truncate">{item.name}</span>}
                        </div>
                        {collapsed && (
                          <div className="absolute left-16 scale-0 group-hover:scale-100 transition-all z-50 bg-slate-950 text-white text-[10px] rounded px-2.5 py-1.5 font-bold shadow-lg pointer-events-none whitespace-nowrap">
                            {item.name}
                          </div>
                        )}
                      </Link>
                    );
                  })}
                </nav>
              </div>
            </div>

          </div>

          {/* Footer: User Profile / Logout */}
          <div className="pt-3.5 border-t border-slate-200 dark:border-slate-800 shrink-0">
            {!collapsed ? (
              <div className="flex items-center justify-between p-1">
                <div className="flex items-center gap-2.5 overflow-hidden text-left">
                  <div className="h-7 w-7 rounded-lg bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0 relative">
                    {user?.first_name ? user.first_name[0].toUpperCase() : user?.email ? user.email[0].toUpperCase() : "U"}
                    <span className="absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-indigo-500 ring-1 ring-slate-950"></span>
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-250 truncate">
                      {user?.first_name ? `${user.first_name} ${user.last_name || ""}`.trim() : user?.email ? user.email.split("@")[0] : "harshchavan009"}
                    </p>
                    <p className="text-[9px] text-slate-400 dark:text-slate-500 truncate font-extrabold uppercase tracking-wide">
                      {user?.role ? user.role.replace("_", " ") : "super_admin"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    clearAuth();
                    router.push("/login");
                  }}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition shrink-0 ml-1 cursor-pointer"
                  title="Sign Out"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs relative">
                  {user?.first_name ? user.first_name[0].toUpperCase() : user?.email ? user.email[0].toUpperCase() : "U"}
                  <span className="absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-indigo-500 ring-1 ring-slate-950"></span>
                </div>
                <button
                  onClick={() => {
                    clearAuth();
                    router.push("/login");
                  }}
                  className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition cursor-pointer"
                  title="Sign Out"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Outer content holder with Top Navigation bar */}
        <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
          
          {/* Top Header Navigation Bar */}
          <header className="h-16 glass-panel border-b border-slate-200 dark:border-slate-800/80 px-6 flex items-center justify-between shrink-0 z-30">
            {/* Left: Global Workspace / Search Selector */}
            <div className="flex items-center gap-4">

              {/* Global Org Context Dropdown */}
              <div className="relative" ref={orgRef}>
                <button
                  id="global-org-context-btn"
                  onClick={() => { setOrgDropdownOpen(!orgDropdownOpen); setNotifOpen(false); }}
                  className={`flex items-center gap-2 border px-3 py-1.5 rounded-xl cursor-pointer transition ${
                    orgDropdownOpen
                      ? "border-indigo-500/60 bg-indigo-500/10 dark:bg-indigo-500/10"
                      : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:border-indigo-500/50"
                  }`}
                >
                  <Globe className="h-4 w-4 text-indigo-500" />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 max-w-[130px] truncate">{activeWorkspaceName || "Default Workspace"}</span>
                  <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${orgDropdownOpen ? "rotate-180" : ""}`} />
                </button>

                {/* Org Dropdown Panel */}
                {orgDropdownOpen && (
                  <div className="absolute top-full left-0 mt-2 w-72 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-4 py-3 border-b border-slate-800">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Switch Workspace</p>
                    </div>
                    <div className="p-2 space-y-0.5 max-h-64 overflow-y-auto">
                      {workspaces.map(w => (
                        <button
                          key={w.id}
                          onClick={() => { setActiveWorkspace(w.id, w.name); setOrgDropdownOpen(false); }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition text-left ${
                            activeWorkspaceId === w.id
                              ? "bg-indigo-600/15 border border-indigo-500/20"
                              : "hover:bg-slate-800/60"
                          }`}
                        >
                          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500/30 to-violet-500/30 border border-indigo-500/20 flex items-center justify-center shrink-0">
                            <Building2 className="h-4 w-4 text-indigo-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-200 truncate">{w.name}</p>
                            <p className="text-[10px] text-slate-500">Active context slug: {w.slug}</p>
                          </div>
                          {activeWorkspaceId === w.id && (
                            <Check className="h-4 w-4 text-indigo-400 shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                    <div className="px-4 py-2.5 border-t border-slate-800">
                      <Link
                        href="/settings"
                        onClick={() => setOrgDropdownOpen(false)}
                        className="flex items-center gap-2 text-xs text-indigo-400 hover:text-indigo-300 font-semibold transition"
                      >
                        <Settings className="h-3.5 w-3.5" /> Workspace Settings
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* Dynamic search bar */}
              <div className="relative w-80 hidden md:block">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search indexed files, agents and API logs..."
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs focus:border-indigo-500/50 focus:outline-none dark:text-slate-200 placeholder-slate-400 transition"
                />
              </div>
            </div>

            {/* Right: Notifications, Theme Switcher */}
            <div className="flex items-center gap-3">

              {/* Notification Bell */}
              <div className="relative" ref={notifRef}>
                <button
                  id="notification-bell-btn"
                  onClick={() => { setNotifOpen(!notifOpen); setOrgDropdownOpen(false); }}
                  className={`p-2 rounded-xl border relative transition ${
                    notifOpen
                      ? "bg-indigo-500/10 border-indigo-500/40 text-indigo-400"
                      : "bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-indigo-500 text-white text-[9px] font-black flex items-center justify-center ring-2 ring-slate-900">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {/* Notification Panel */}
                {notifOpen && (
                  <div className="absolute top-full right-0 mt-2 w-80 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Bell className="h-3.5 w-3.5 text-indigo-400" />
                        <p className="text-xs font-bold text-slate-200">Notifications</p>
                        {unreadCount > 0 && (
                          <span className="h-4 w-4 rounded-full bg-indigo-500 text-white text-[9px] font-black flex items-center justify-center">
                            {unreadCount}
                          </span>
                        )}
                      </div>
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllRead}
                          className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold transition"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>

                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60">
                      {notifications.length === 0 ? (
                        <div className="py-10 flex flex-col items-center gap-2">
                          <CheckCircle2 className="h-8 w-8 text-slate-700" />
                          <p className="text-xs text-slate-500">All caught up!</p>
                        </div>
                      ) : (
                        notifications.map(notif => (
                          <div
                            key={notif.id}
                            className={`px-4 py-3 flex items-start gap-3 transition hover:bg-slate-800/40 ${
                              !notif.read ? "bg-indigo-500/5" : ""
                            }`}
                          >
                            <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                              notif.type === "success" ? "bg-emerald-500/15" :
                              notif.type === "warning" ? "bg-amber-500/15" : "bg-blue-500/15"
                            }`}>
                              {notif.type === "success" && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                              {notif.type === "warning" && <AlertTriangle className="h-4 w-4 text-amber-400" />}
                              {notif.type === "info" && <Info className="h-4 w-4 text-blue-400" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-xs font-semibold text-slate-200 truncate">{notif.title}</p>
                                {!notif.read && <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 shrink-0" />}
                              </div>
                              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{notif.body}</p>
                              <p className="text-[10px] text-slate-600 mt-1">{notif.time}</p>
                            </div>
                            <button
                              onClick={() => dismissNotif(notif.id)}
                              className="p-1 text-slate-600 hover:text-slate-400 transition shrink-0"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="px-4 py-2.5 border-t border-slate-800">
                      <p className="text-[10px] text-slate-600 text-center">System notifications only · Real-time alerts enabled</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Theme Toggle */}
              <button
                id="theme-toggle-btn"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition"
              >
                {theme === "dark" ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-indigo-500" />}
              </button>

              {/* SLA Status Badge */}
              <div className="hidden lg:flex items-center gap-2 text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-3 py-1.5 rounded-full border border-emerald-500/20">
                <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                <span>SLA Guardrails: 99.9%</span>
              </div>
            </div>
          </header>

          {/* Central Main view frame */}
          <main className="flex-1 overflow-y-auto bg-slate-50/30 dark:bg-slate-950/20">
            {isUnauthorized ? (
              <div className="flex-grow flex flex-col items-center justify-center p-12 text-center h-full min-h-[500px]">
                <div className="glass-card p-8 rounded-3xl border border-rose-500/10 bg-rose-500/5 max-w-md space-y-4">
                  <div className="mx-auto h-12 w-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
                    <FolderLock className="h-6 w-6" />
                  </div>
                  <h2 className="text-lg font-black text-slate-800 dark:text-slate-200">Access Denied</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    You do not have the required operational permissions to access this screen. Please contact your workspace administrator.
                  </p>
                  <Link href="/" className="inline-block px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition shadow-glow">
                    Return to Dashboard
                  </Link>
                </div>
              </div>
            ) : (
              children
            )}
          </main>
        </div>
      </div>
    )}
  </body>
</html>
  );
}
