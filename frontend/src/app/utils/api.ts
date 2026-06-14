import { useAuthStore } from "../store/authStore";

const BASE_URL = "http://localhost:8000/api/v1";

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
