import { useAuthStore } from "@/app/store/authStore";

const BASE_URL = typeof window !== "undefined"
  ? (window.location.port === "3000" ? "http://localhost:8000/api/v1" : `${window.location.origin}/api/v1`)
  : "http://localhost:8000/api/v1";

interface FetchOptions extends RequestInit {
  headers?: Record<string, string>;
}

export async function apiFetch(endpoint: string, options: FetchOptions = {}): Promise<Response> {
  const url = endpoint.startsWith("http://") || endpoint.startsWith("https://")
    ? endpoint
    : `${BASE_URL}${endpoint}`;

  // Get current auth state
  const { accessToken, refreshToken, setAuth, clearAuth } = useAuthStore.getState();

  const headers = { ...options.headers };
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  // Set default content type if payload is present and not multipart
  if (options.body && !(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle session expiration and refresh
  if (response.status === 401 && refreshToken) {
    try {
      const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        const newAccessToken = refreshData.access_token;

        // Fetch user session info
        const sessionRes = await fetch(`${BASE_URL}/auth/session`, {
          headers: {
            "Authorization": `Bearer ${newAccessToken}`,
          },
        });

        if (sessionRes.ok) {
          const userData = await sessionRes.json();
          // Update credentials in local storage
          setAuth(newAccessToken, refreshToken, userData);

          // Retry the original request
          const retryHeaders = {
            ...headers,
            "Authorization": `Bearer ${newAccessToken}`,
          };
          return await fetch(url, {
            ...options,
            headers: retryHeaders,
          });
        }
      }
    } catch (err) {
      console.error("Session refresh failed:", err);
    }

    // Refresh failed - clean credentials and send to Login
    clearAuth();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  }

  return response;
}

// ============================================================
// VOICE RAG API
// ============================================================

export async function uploadVoiceNote(knowledgeBaseId: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("knowledge_base_id", knowledgeBaseId);
  return apiFetch("/voice-rag/upload", { method: "POST", body: formData });
}

export async function listTranscriptions(knowledgeBaseId: string) {
  return apiFetch(`/voice-rag/transcriptions?knowledge_base_id=${knowledgeBaseId}`);
}

export async function getTranscript(documentId: string) {
  return apiFetch(`/voice-rag/transcript/${documentId}`);
}

// ============================================================
// OCR INTELLIGENCE API
// ============================================================

export async function uploadForOCR(knowledgeBaseId: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("knowledge_base_id", knowledgeBaseId);
  return apiFetch("/ocr/upload", { method: "POST", body: formData });
}

export async function listOCRResults(knowledgeBaseId: string) {
  return apiFetch(`/ocr/results?knowledge_base_id=${knowledgeBaseId}`);
}

export async function getOCRText(documentId: string) {
  return apiFetch(`/ocr/text/${documentId}`);
}

// ============================================================
// MEETING INTELLIGENCE API
// ============================================================

export async function uploadMeeting(
  workspaceId: string,
  file: File,
  saveToKb: boolean = false,
  knowledgeBaseId?: string
) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("workspace_id", workspaceId);
  formData.append("save_to_kb", String(saveToKb));
  if (knowledgeBaseId) formData.append("knowledge_base_id", knowledgeBaseId);
  return apiFetch("/meeting/upload", { method: "POST", body: formData });
}

export async function listMeetingAnalyses(workspaceId: string) {
  return apiFetch(`/meeting/analyses?workspace_id=${workspaceId}`);
}

export async function getMeetingAnalysis(analysisId: string) {
  return apiFetch(`/meeting/analysis/${analysisId}`);
}

export async function deleteMeetingAnalysis(analysisId: string) {
  return apiFetch(`/meeting/analysis/${analysisId}`, { method: "DELETE" });
}

// ============================================================
// AUTONOMOUS RESEARCH API
// ============================================================

export async function startResearchTask(workspaceId: string, query: string, emailTo?: string) {
  return apiFetch("/research/", {
    method: "POST",
    body: JSON.stringify({ workspace_id: workspaceId, query, email_to: emailTo || null })
  });
}

export async function listResearchTasks(workspaceId: string) {
  return apiFetch(`/research/?workspace_id=${workspaceId}`);
}

export async function getResearchTask(taskId: string) {
  return apiFetch(`/research/${taskId}`);
}

export async function deleteResearchTask(taskId: string) {
  return apiFetch(`/research/${taskId}`, { method: "DELETE" });
}

export async function getResearchPDFInfo(taskId: string) {
  return apiFetch(`/research/${taskId}/download-pdf`);
}
