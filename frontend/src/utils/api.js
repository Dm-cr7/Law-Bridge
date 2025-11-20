// frontend/src/utils/api.js
/**
 * Centralized Axios instance
 * - Silent handling of aborted/canceled requests
 * - Preserves original Error object for callers (don't replace with error.response)
 * - Central 401 handling + optional redirect
 * - Exports uploadFile helper that uses the same instance
 */

import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const TOKEN_KEY = "authToken";
const USER_KEY = "authUser";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

/* Helper to detect cancellation / abort */
function isAbortError(err) {
  if (!err) return false;
  // axios v1+ uses code === 'ERR_CANCELED'
  if (err?.code === "ERR_CANCELED") return true;
  if (err?.name === "AbortError") return true;
  if (axios.isCancel && axios.isCancel(err)) return true;
  return false;
}

/* Request interceptor: attach token if present */
api.interceptors.request.use(
  (config) => {
    const token =
      localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (err) => {
    // very rare: axios request config problem
    console.error("❌ API request config error:", err?.message || err);
    return Promise.reject(err);
  }
);

/* Response interceptor: don't swallow cancellation; preserve error object */
api.interceptors.response.use(
  (res) => res,
  (err) => {
    // If aborted/canceled, quietly propagate the original error (no noisy logs)
    if (isAbortError(err)) {
      // do not log — callers should handle canceled requests if needed
      return Promise.reject(err);
    }

    // If a response exists (server returned non-2xx)
    if (err && err.response) {
      const { status, data } = err.response;

      // handle 401 centrally
      if (status === 401) {
        try {
          console.warn("🔒 401 Unauthorized — clearing auth and redirecting to /login");
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
          sessionStorage.removeItem(TOKEN_KEY);
          sessionStorage.removeItem(USER_KEY);
        } catch (e) {}
        // Redirect only in browser context
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
      }

      // log important server problems (but keep original error)
      if (status === 403) {
        console.error("🚫 API 403 Forbidden:", data?.message || data || "");
      } else if (status >= 500) {
        console.error("💥 API Server error:", data?.message || data || "");
      }

      // Preserve original axios error (do NOT replace with err.response)
      return Promise.reject(err);
    }

    // No response (network / CORS / offline)
    if (err && err.request) {
      console.error("🌐 Network/CORS or no response from server:", err.message || err);
      return Promise.reject(err);
    }

    // Fallback: unexpected error during setup
    console.error("⚙️ Axios setup error:", err?.message || err);
    return Promise.reject(err);
  }
);

/* multipart upload helper */
export async function uploadFile(endpoint, formData, options = {}) {
  try {
    const headers = { "Content-Type": "multipart/form-data" };
    const token =
      localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await api.post(endpoint, formData, {
      headers,
      ...options,
    });
    return res.data;
  } catch (err) {
    // rethrow the original error (caller will display)
    throw err;
  }
}

export default api;
