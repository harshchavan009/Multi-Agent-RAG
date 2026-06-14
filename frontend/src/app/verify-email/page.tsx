"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Mail, CheckCircle, XCircle, Loader } from "lucide-react";

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Parse token from url parameters and auto-submit
  useEffect(() => {
    const urlToken = searchParams.get("token");
    if (urlToken) {
      setToken(urlToken);
      autoVerify(urlToken);
    }
  }, [searchParams]);

  const autoVerify = async (verifyToken: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("http://localhost:8000/api/v1/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: verifyToken }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Verification failed. Token may be expired.");
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during email verification.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (token) {
      autoVerify(token);
    }
  };

  if (success) {
    return (
      <div className="w-full max-w-md">
        <div className="glass-card p-8 rounded-3xl border border-emerald-500/20 shadow-2xl relative overflow-hidden space-y-6 text-center">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <CheckCircle className="h-6 w-6" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">Identity Verified</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Your email address has been successfully verified in our multi-tenant catalog.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-400">
            Redirecting to dashboard login portal...
          </div>

          <div className="pt-2">
            <Link
              href="/login"
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl inline-block transition"
            >
              Sign In to Workspaces
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="glass-card p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl relative overflow-hidden space-y-6">
        <div className="absolute -top-12 -left-12 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl"></div>
        <div className="absolute -bottom-12 -right-12 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl"></div>

        <div className="text-center space-y-2">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
            <Mail className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-black tracking-tight bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-500 bg-clip-text text-transparent dark:from-indigo-400 dark:via-purple-400 dark:to-cyan-400">
            Verify Registration
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Confirm your platform registration via security validation token
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl border border-rose-500/10 bg-rose-500/5 text-rose-500 text-xs font-semibold leading-relaxed flex items-center gap-2.5">
            <XCircle className="h-4 w-4 text-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading && (
          <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-3">
            <Loader className="h-6 w-6 text-indigo-500 animate-spin" />
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Verifying validation token...</p>
          </div>
        )}

        {!loading && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">
                Verification Token
              </label>
              <input
                type="text"
                required
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Enter or paste email token here"
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-xs focus:border-indigo-500/50 focus:outline-none dark:text-slate-200 transition font-mono"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-indigo-600 to-cyan-500 hover:opacity-95 text-white font-bold text-xs rounded-xl shadow-glow transition"
            >
              Verify Organization Account
            </button>
          </form>
        )}

        <div className="border-t border-slate-200 dark:border-slate-800/80 pt-4 text-center">
          <Link
            href="/login"
            className="text-xs font-bold text-indigo-500 hover:text-indigo-600 transition"
          >
            Back to Portal Login
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Loading verification view...</p>
      </div>
    }>
      <VerifyEmailForm />
    </Suspense>
  );
}
