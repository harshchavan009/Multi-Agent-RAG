import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface UserProfile {
  email: string;
  first_name?: string;
  last_name?: string;
  is_email_verified: boolean;
  role: string;
  org_id?: string;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: UserProfile | null;
  activeWorkspaceId: string | null;
  activeWorkspaceName: string | null;
  setAuth: (accessToken: string, refreshToken: string, user: UserProfile) => void;
  clearAuth: () => void;
  updateUser: (user: Partial<UserProfile>) => void;
  setActiveWorkspace: (workspaceId: string, workspaceName: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      activeWorkspaceId: null,
      activeWorkspaceName: null,
      setAuth: (accessToken, refreshToken, user) =>
        set({ accessToken, refreshToken, user }),
      clearAuth: () => set({ accessToken: null, refreshToken: null, user: null, activeWorkspaceId: null, activeWorkspaceName: null }),
      updateUser: (userUpdates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...userUpdates } : null,
        })),
      setActiveWorkspace: (workspaceId, workspaceName) =>
        set({ activeWorkspaceId: workspaceId, activeWorkspaceName: workspaceName }),
    }),
    {
      name: "antigravity-auth-session",
    }
  )
);
