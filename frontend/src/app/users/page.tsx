"use client";

import React, { useState, useEffect } from "react";
import { apiFetch } from "../utils/api";
import { useAuthStore } from "@/app/store/authStore";
import { Users as UsersIcon, ShieldCheck, Mail, RefreshCw, AlertCircle, CheckCircle2, Plus, UserPlus, X } from "lucide-react";

interface OrgUser {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  is_active: boolean;
  is_email_verified: boolean;
  role: string;
}

export default function UsersPage() {
  const { user: currentUser } = useAuthStore();
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Invite states
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("user");
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<any | null>(null);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setInviting(true);
    setError(null);
    setSuccess(null);
    setInviteResult(null);

    try {
      const response = await apiFetch("/auth/invite", {
        method: "POST",
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Invitation request failed.");
      }

      const data = await response.json();
      setSuccess(`Invited member ${inviteEmail} successfully!`);
      setInviteResult(data);
      setInviteEmail("");
      fetchUsers();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during invite.");
    } finally {
      setInviting(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = () => {
    setLoading(true);
    apiFetch("/auth/users")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load organization members.");
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setUsers(data);
        }
      })
      .catch((err) => {
        setError(err.message || "Failed to retrieve directory list.");
      })
      .finally(() => setLoading(false));
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    setUpdatingId(userId);
    setError(null);
    setSuccess(null);

    try {
      const response = await apiFetch(`/auth/users/${userId}/role`, {
        method: "PUT",
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Forbidden. Insufficient operational permissions.");
      }

      setSuccess("User role updated successfully.");
      fetchUsers();
    } catch (err: any) {
      setError(err.message || "Unable to modify permissions.");
    } finally {
      setUpdatingId(null);
    }
  };

  const isAuthorizedToEdit = currentUser?.role === "super_admin" || currentUser?.role === "admin";

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto w-full">
      <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">Identity & Access Management (IAM)</h2>
          <p className="text-xs text-slate-500 mt-1">Manage tenant user access permissions and security roles.</p>
        </div>
        <div className="flex gap-3">
          {isAuthorizedToEdit && (
            <button
              onClick={() => setShowInviteModal(true)}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 hover:opacity-95 text-white font-bold text-xs shadow-glow transition flex items-center gap-2 cursor-pointer"
            >
              <Plus className="h-4 w-4" /> Invite Team Member
            </button>
          )}
          <button
            onClick={fetchUsers}
            className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 transition cursor-pointer"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Alert Notices */}
      {error && (
        <div className="p-3.5 rounded-xl border border-rose-500/10 bg-rose-500/5 text-rose-500 text-xs font-semibold leading-relaxed flex items-center gap-2.5">
          <AlertCircle className="h-4.5 w-4.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3.5 rounded-xl border border-emerald-500/10 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 text-xs font-semibold leading-relaxed flex items-center gap-2.5">
          <CheckCircle2 className="h-4.5 w-4.5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {loading && (
        <div className="flex gap-2 items-center justify-center p-12 text-slate-400">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span className="text-xs font-bold">Querying organization directory...</span>
        </div>
      )}

      {!loading && (
        <div className="glass-card rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 bg-slate-50 dark:bg-slate-900/30">
                <th className="p-4 font-semibold">User Member</th>
                <th className="p-4 font-semibold">Assigned Role</th>
                <th className="p-4 font-semibold">Email status</th>
                <th className="p-4 font-semibold">Role Control</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80">
              {users.map((item) => (
                <tr key={item.id} className="text-slate-700 dark:text-slate-300 hover:bg-slate-50/30 dark:hover:bg-slate-900/10 transition">
                  <td className="p-4">
                    <div className="flex items-center gap-2 font-medium">
                      <Mail className="h-4 w-4 text-indigo-500" />
                      <div>
                        <span className="font-bold">{item.email}</span>
                        {item.first_name && (
                          <span className="text-[10px] text-slate-450 dark:text-slate-500 ml-2">
                            ({item.first_name} {item.last_name || ""})
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-4 font-semibold uppercase tracking-wider text-[10px] text-slate-500">
                    <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-750">
                      {item.role.replace("_", " ")}
                    </span>
                  </td>
                  <td className="p-4">
                    {item.is_email_verified ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-550/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                        Verified
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold">
                        Pending Verify
                      </span>
                    )}
                  </td>
                  <td className="p-4">
                    {updatingId === item.id ? (
                      <RefreshCw className="h-4 w-4 text-indigo-500 animate-spin" />
                    ) : (
                      <select
                        value={item.role}
                        disabled={!isAuthorizedToEdit}
                        onChange={(e) => handleRoleChange(item.id, e.target.value)}
                        className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1 text-xs text-slate-650 dark:text-slate-300 focus:outline-none cursor-pointer disabled:opacity-50"
                      >
                        <option value="super_admin">Super Admin</option>
                        <option value="admin">Admin</option>
                        <option value="manager">Manager</option>
                        <option value="user">User</option>
                      </select>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Invite Team Member Dialog Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-slate-955/80 dark:bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-6 relative shadow-2xl overflow-hidden space-y-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="absolute -top-12 -left-12 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl"></div>
            <div className="absolute -bottom-12 -right-12 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl"></div>
            
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold bg-gradient-to-r from-indigo-500 to-cyan-500 dark:from-indigo-400 dark:to-cyan-400 bg-clip-text text-transparent flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
                <span>Invite Team Member</span>
              </h3>
              <button
                onClick={() => { setShowInviteModal(false); setInviteResult(null); setError(null); }}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {error && (
              <div className="p-3.5 rounded-xl border border-rose-500/10 bg-rose-500/5 text-rose-500 text-xs font-semibold leading-relaxed">
                {error}
              </div>
            )}

            {inviteResult && inviteResult.temporary_password && (
              <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/15 text-xs text-slate-600 dark:text-slate-350 space-y-2">
                <p className="font-bold text-emerald-600 dark:text-emerald-400">Temporary Password Assigned:</p>
                <div className="bg-slate-100 dark:bg-slate-950/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 font-mono text-emerald-600 dark:text-emerald-300 flex items-center justify-between">
                  <span>{inviteResult.temporary_password}</span>
                  <span className="text-[9px] uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded font-sans font-bold">Copy</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-normal">
                  Give this password to your teammate so they can instantly authenticate to your workspace tenant.
                </p>
              </div>
            )}

            {!inviteResult && (
              <form onSubmit={handleInvite} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">
                    Teammate Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="email"
                      required
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="teammate@company.com"
                      className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-4 py-3 text-xs focus:border-indigo-500/50 focus:outline-none dark:text-slate-200 transition"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">
                    Security Access Role
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-3 text-xs focus:border-indigo-500/50 focus:outline-none dark:text-slate-200 transition cursor-pointer"
                  >
                    <option value="admin">Administrator (Admin)</option>
                    <option value="manager">Manager (Read & Write)</option>
                    <option value="user">User (Read-only Member)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={inviting}
                  className="w-full py-3 bg-gradient-to-r from-indigo-600 to-cyan-500 hover:opacity-95 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-glow transition disabled:opacity-50 cursor-pointer"
                >
                  {inviting ? "Issuing Invitation..." : "Send Tenant Invite"}
                </button>
              </form>
            )}

            {inviteResult && (
              <button
                onClick={() => { setShowInviteModal(false); setInviteResult(null); }}
                className="w-full py-2.5 bg-slate-200 dark:bg-slate-800 hover:opacity-90 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Close Drawer
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
