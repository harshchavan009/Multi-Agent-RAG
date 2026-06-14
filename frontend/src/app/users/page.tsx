"use client";

import React, { useState, useEffect } from "react";
import { apiFetch } from "../utils/api";
import { useAuthStore } from "../store/authStore";
import { Users as UsersIcon, ShieldCheck, Mail, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";

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
        <button
          onClick={fetchUsers}
          className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 transition"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
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
    </div>
  );
}
