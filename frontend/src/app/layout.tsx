"use client";

import "./globals.css";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "./store/authStore";
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
  Sparkles
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

  const { accessToken, user, clearAuth } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  // Sync state class with DOM
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === "light") {
      root.classList.add("light");
    } else {
      root.classList.remove("light");
    }
  }, [theme]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isAuthRoute = pathname && (
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/verify-email")
  );

  useEffect(() => {
    if (!mounted) return;

    if (!accessToken && !isAuthRoute) {
      router.push("/login");
    } else if (accessToken && isAuthRoute) {
      router.push("/");
    }
  }, [accessToken, isAuthRoute, mounted]);

  // Handle route authentication mismatches during mount to avoid flickers
  if (!mounted) {
    return (
      <html lang="en">
        <body className="mesh-bg min-h-screen flex items-center justify-center text-slate-100 bg-slate-950">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Antigravity Engine Booting...</p>
          </div>
        </body>
      </html>
    );
  }

  // Redirecting state block
  if (!accessToken && !isAuthRoute) {
    return (
      <html lang="en">
        <body className="mesh-bg min-h-screen flex items-center justify-center text-slate-100 bg-slate-950">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Securing session space...</p>
          </div>
        </body>
      </html>
    );
  }

  // If on authentication route, render simple single-card frame
  if (isAuthRoute) {
    return (
      <html lang="en" className={theme === "light" ? "light" : ""}>
        <body className="mesh-bg min-h-screen flex items-center justify-center text-slate-900 dark:text-slate-100 transition-colors duration-200">
          <main className="w-full flex items-center justify-center p-4">
            {children}
          </main>
        </body>
      </html>
    );
  }

  // Collapsible Sidebar links definition
  const navItems = [
    { name: "Dashboard", path: "/", icon: LayoutDashboard },
    { name: "Chat Studio", path: "/chat", icon: MessageSquare },
    { name: "Agent Studio", path: "/agents", icon: Shield },
    { name: "Knowledge Base", path: "/documents", icon: Database },
    { name: "Workflows", path: "/workflows", icon: Workflow },
  ];

  const secondaryNavItems = [
    { name: "Model Registry", path: "/models", icon: FileCode },
    { name: "Users & IAM", path: "/users", icon: UsersIcon },
    { name: "Audit Logging", path: "/audit-logs", icon: FolderLock },
    { name: "Analytics Logs", path: "/analytics", icon: Activity },
    { name: "Settings", path: "/settings", icon: Settings },
  ];

  return (
    <html lang="en" className={theme === "light" ? "light" : ""}>
      <body className="mesh-bg min-h-screen flex text-slate-900 dark:text-slate-100 transition-colors duration-200">
        
        {/* Persistent Collapsible Left Sidebar */}
        <aside 
          className={`glass-panel border-r border-slate-200 dark:border-slate-800/80 flex flex-col justify-between p-4 z-40 transition-all duration-300 ${
            collapsed ? "w-[4.5rem]" : "w-64"
          }`}
        >
          <div>
            {/* Header: Logo and Toggle Collapse */}
            <div className="flex items-center justify-between mb-6 pt-2">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-400 flex items-center justify-center font-bold text-lg text-white shadow-glow shrink-0">
                  A
                </div>
                {!collapsed && (
                  <div className="transition-opacity duration-300">
                    <h1 className="font-extrabold tracking-tight text-sm text-indigo-600 dark:text-indigo-400">ANTIGRAVITY</h1>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-semibold">Enterprise RAG</p>
                  </div>
                )}
              </div>
              <button 
                onClick={() => setCollapsed(!collapsed)}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 transition"
              >
                {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </button>
            </div>

            {/* Workspace details */}
            {!collapsed ? (
              <div className="mb-6 p-3 rounded-xl bg-slate-100/60 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="overflow-hidden">
                  <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Active Workspace</p>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">Default production space</p>
                </div>
                <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981] shrink-0 ml-2"></span>
              </div>
            ) : (
              <div className="flex justify-center mb-6">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]"></span>
              </div>
            )}

            {/* Main Navigation links */}
            <nav className="space-y-1">
              {navItems.map((item, idx) => {
                const Icon = item.icon;
                const isActive = pathname === item.path;
                return (
                  <Link 
                    key={idx} 
                    href={item.path}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group relative ${
                      isActive 
                        ? "bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 font-semibold border-l-2 border-indigo-500"
                        : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-800/40"
                    }`}
                  >
                    <Icon className="h-4.5 w-4.5 shrink-0" />
                    {!collapsed && <span className="text-xs font-semibold">{item.name}</span>}
                    {/* Collapsed Tooltip helper */}
                    {collapsed && (
                      <div className="absolute left-16 scale-0 group-hover:scale-100 transition-all z-50 bg-slate-950 text-white text-[10px] rounded px-2.5 py-1.5 font-bold shadow-lg pointer-events-none whitespace-nowrap">
                        {item.name}
                      </div>
                    )}
                  </Link>
                );
              })}
            </nav>

            <div className="border-t border-slate-200 dark:border-slate-800/80 my-4"></div>

            {/* Admin and secondary navigation */}
            <nav className="space-y-1">
              {secondaryNavItems.map((item, idx) => {
                const Icon = item.icon;
                const isActive = pathname === item.path;
                return (
                  <Link 
                    key={idx} 
                    href={item.path}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group relative ${
                      isActive 
                        ? "bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 font-semibold border-l-2 border-indigo-500"
                        : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-800/40"
                    }`}
                  >
                    <Icon className="h-4.5 w-4.5 shrink-0" />
                    {!collapsed && <span className="text-xs font-semibold">{item.name}</span>}
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

          {/* Footer: User Profile / Logout */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
            {!collapsed ? (
              <div className="flex items-center justify-between p-1">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="h-8 w-8 rounded-lg bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">
                    {user?.first_name ? user.first_name[0].toUpperCase() : user?.email ? user.email[0].toUpperCase() : "U"}
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
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition shrink-0 ml-1"
                  title="Sign Out"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">
                  {user?.first_name ? user.first_name[0].toUpperCase() : user?.email ? user.email[0].toUpperCase() : "U"}
                </div>
                <button
                  onClick={() => {
                    clearAuth();
                    router.push("/login");
                  }}
                  className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition"
                  title="Sign Out"
                >
                  <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 rounded-xl cursor-pointer hover:border-indigo-500/50 transition">
                <Globe className="h-4 w-4 text-indigo-500" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Global Org Context</span>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
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

            {/* Right: Notifications, Theme Switcher, and profile action items */}
            <div className="flex items-center gap-4">
              {/* Notification bell badge */}
              <button className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 relative transition">
                <Bell className="h-4.5 w-4.5" />
                <span className="absolute top-1 right-1.5 h-2 w-2 rounded-full bg-indigo-500 ring-2 ring-white dark:ring-slate-900"></span>
              </button>

              {/* Theme Selector Toggle */}
              <button 
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition"
              >
                {theme === "dark" ? <Sun className="h-4.5 w-4.5 text-amber-400" /> : <Moon className="h-4.5 w-4.5 text-indigo-500" />}
              </button>

              {/* Quick status cluster */}
              <div className="hidden lg:flex items-center gap-2 text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-3 py-1.5 rounded-full border border-emerald-500/20">
                <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                <span>SLA Guardrails: 99.9%</span>
              </div>
            </div>
          </header>

          {/* Central Main view frame */}
          <main className="flex-1 overflow-y-auto bg-slate-50/30 dark:bg-slate-950/20">
            {children}
          </main>
        </div>

      </body>
    </html>
  );
}
