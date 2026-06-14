"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserPlus, Mail, Key, User, Sparkles, Loader, CheckCircle } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Registration success payload for dev/test helper redirection
  const [successData, setSuccessData] = useState<{
    email: string;
    token?: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("http://localhost:8000/api/v1/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          first_name: firstName || undefined,
          last_name: lastName || undefined,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Sign up failed. Please check inputs.");
      }

      const data = await response.json();
      
      setSuccessData({
        email: data.email,
        token: data.email_verification_token,
      });
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during user creation.");
    } finally {
      setLoading(false);
    }
  };

  if (successData) {
    return (
      <div className="w-full max-w-md">
        <div className="glass-card p-8 rounded-3xl border border-emerald-500/20 shadow-2xl relative overflow-hidden space-y-6 text-center">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <CheckCircle className="h-6 w-6" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">Enterprise Tenant Initialized!</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              An account has been created for <strong className="text-slate-700 dark:text-slate-350">{successData.email}</strong>.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 leading-relaxed text-left space-y-2">
            <p className="font-semibold text-slate-700 dark:text-slate-300">Email Verification Required</p>
            <p>Please check your email box or verify using the credentials token below to activate your organization workspace.</p>
          </div>

          {/* Interactive Debug Verification Shortcut */}
          {successData.token && (
            <div className="pt-2">
              <Link
                href={`/verify-email?token=${successData.token}`}
                className="w-full py-2.5 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 font-bold text-xs rounded-xl inline-flex items-center justify-center gap-2 transition"
              >
                <span>Verify Account Now (Debug)</span>
              </Link>
            </div>
          )}

          <div className="border-t border-slate-200 dark:border-slate-800/80 pt-4">
            <Link
              href="/login"
              className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition"
            >
              Back to Portal Login
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
          <div className="mx-auto h-12 w-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-cyan-400 flex items-center justify-center font-black text-xl text-white shadow-glow">
            A
          </div>
          <h1 className="text-2xl font-black tracking-tight bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-500 bg-clip-text text-transparent dark:from-indigo-400 dark:via-purple-400 dark:to-cyan-400">
            Create Account
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Setup multi-tenant space and auto-generate default workspaces
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl border border-rose-500/10 bg-rose-500/5 text-rose-500 text-xs font-semibold leading-relaxed flex items-center gap-2.5">
            <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse shrink-0"></span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">
                First Name
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Jane"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs focus:border-indigo-500/50 focus:outline-none dark:text-slate-200 transition"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">
                Last Name
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs focus:border-indigo-500/50 focus:outline-none dark:text-slate-200 transition"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">
              Enterprise Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane.doe@company.com"
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs focus:border-indigo-500/50 focus:outline-none dark:text-slate-200 transition"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">
              Password
            </label>
            <div className="relative">
              <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs focus:border-indigo-500/50 focus:outline-none dark:text-slate-200 transition"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">
              Confirm Password
            </label>
            <div className="relative">
              <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs focus:border-indigo-500/50 focus:outline-none dark:text-slate-200 transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-cyan-500 hover:opacity-95 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-glow hover:shadow-indigo-500/10 transition duration-150 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader className="h-4 w-4 animate-spin" />
                <span>Creating Org Space...</span>
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                <span>Initialize Platform Account</span>
              </>
            )}
          </button>
        </form>

        <div className="border-t border-slate-200 dark:border-slate-800/80 pt-4 text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Already have an enterprise session?{" "}
            <Link
              href="/login"
              className="font-bold text-indigo-500 hover:text-indigo-600 transition"
            >
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
