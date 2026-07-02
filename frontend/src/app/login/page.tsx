"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/app/store/authStore";
import { Shield, Key, Mail, Sparkles, Loader } from "lucide-react";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((state) => state.setAuth);
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Monitor URL search parameters for OAuth callback code
  useEffect(() => {
    const provider = searchParams.get("provider");
    const code = searchParams.get("code");
    if (provider && code) {
      handleOAuthCallback(provider, code);
    }
  }, [searchParams]);

  const handleOAuthCallback = async (provider: string, code: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`http://localhost:8000/api/v1/auth/oauth/${provider}/callback?code=${code}`);
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || `OAuth callback verification failed for ${provider}.`);
      }
      const data = await response.json();
      
      // Fetch session details
      const sessionRes = await fetch("http://localhost:8000/api/v1/auth/session", {
        headers: { "Authorization": `Bearer ${data.access_token}` }
      });
      if (!sessionRes.ok) {
        throw new Error("Unable to retrieve user workspace profile.");
      }
      const userData = await sessionRes.json();
      setAuth(data.access_token, data.refresh_token, userData);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "OAuth login authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("http://localhost:8000/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Incorrect email or password.");
      }

      const data = await response.json();
      
      const sessionRes = await fetch("http://localhost:8000/api/v1/auth/session", {
        headers: { "Authorization": `Bearer ${data.access_token}` }
      });

      if (!sessionRes.ok) {
        throw new Error("Unable to fetch user profile session.");
      }

      const userData = await sessionRes.json();
      setAuth(data.access_token, data.refresh_token, userData);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "An unexpected connection error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="glass-card p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl relative overflow-hidden space-y-6">
        {/* Glow ornaments */}
        <div className="absolute -top-12 -left-12 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl"></div>
        <div className="absolute -bottom-12 -right-12 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl"></div>

        {/* Heading Logo */}
        <div className="text-center space-y-2">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-cyan-400 flex items-center justify-center font-black text-xl text-white shadow-glow">
            A
          </div>
          <h1 className="text-2xl font-black tracking-tight bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-500 bg-clip-text text-transparent dark:from-indigo-400 dark:via-purple-400 dark:to-cyan-400">
            Enterprise Portal
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Sign in to access your multi-agent workspaces
          </p>
        </div>

        {/* Error Alert Box */}
        {error && (
          <div className="p-3.5 rounded-xl border border-rose-500/10 bg-rose-500/5 text-rose-500 text-xs font-semibold leading-relaxed flex items-center gap-2.5">
            <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse shrink-0"></span>
            <span>{error}</span>
          </div>
        )}

        {/* Main form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">
              Workspace Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-4 py-3 text-xs focus:border-indigo-500/50 focus:outline-none dark:text-slate-200 transition"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-[10px] font-bold text-indigo-500 hover:text-indigo-600 transition"
              >
                Forgot?
              </Link>
            </div>
            <div className="relative">
              <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-4 py-3 text-xs focus:border-indigo-500/50 focus:outline-none dark:text-slate-200 transition"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-slate-300 dark:border-slate-800 text-indigo-600 focus:ring-indigo-500 accent-indigo-500 h-3.5 w-3.5"
              />
              <span>Remember this session</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-cyan-500 hover:opacity-95 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-glow hover:shadow-indigo-500/10 transition duration-150 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader className="h-4 w-4 animate-spin" />
                <span>Authenticating Identity...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>Sign In to Workspaces</span>
              </>
            )}
          </button>
        </form>

        <div className="relative flex py-2 items-center">
          <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
          <span className="flex-shrink mx-4 text-slate-400 dark:text-slate-500 text-[10px] uppercase font-bold tracking-wider">or sign in with</span>
          <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => window.location.href = "http://localhost:8000/api/v1/auth/oauth/google/login"}
            className="flex items-center justify-center gap-2 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-905 hover:border-slate-300 dark:hover:bg-slate-900 transition text-xs font-bold text-slate-700 dark:text-slate-300"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
            </svg>
            <span>Google</span>
          </button>
          <button
            onClick={() => window.location.href = "http://localhost:8000/api/v1/auth/oauth/github/login"}
            className="flex items-center justify-center gap-2 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-905 hover:border-slate-300 dark:hover:bg-slate-900 transition text-xs font-bold text-slate-700 dark:text-slate-300"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
            </svg>
            <span>GitHub</span>
          </button>
        </div>

        <div className="border-t border-slate-200 dark:border-slate-800/80 pt-4 text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Don't have an enterprise account?{" "}
            <Link
              href="/register"
              className="font-bold text-indigo-500 hover:text-indigo-600 transition"
            >
              Sign Up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex gap-2 items-center justify-center p-12 text-slate-400">
        <Loader className="h-5 w-5 animate-spin" />
        <span className="text-xs font-bold">Loading session portal...</span>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
