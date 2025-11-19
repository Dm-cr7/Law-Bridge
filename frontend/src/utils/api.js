/**frontend\src\utils\api.js
 * utils/api.js
 * ------------------------------------------------------------
 * Centralized Axios instance for API communication
 *
 * Features:
 *  ✅ Reads API base URL from environment
 *  ✅ Automatically attaches JWT token from storage
 *  ✅ Handles 401 (unauthorized) globally by redirecting to login
 *  ✅ Handles network errors & logs them clearly
 *  ✅ Supports multipart/form-data (uploads)
 *  ✅ Designed for use across all components & contexts
 */

import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const TOKEN_KEY = "authToken";
const USER_KEY = "authUser";

// --- Create Axios instance ---
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 15000, // 15s timeout to avoid hanging requests
});

// --- Request Interceptor ---
// Inject token into Authorization header for every outgoing request
api.interceptors.request.use(
  (config) => {
    const token =
      localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error("❌ Request config error:", error);
    return Promise.reject(error);
  }
);

// --- Response Interceptor ---
// Handle global errors like expired tokens or network issues
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { status, data } = error.response;

      // JWT expired or invalid — force logout
      if (status === 401) {
        console.warn("🔒 401 Unauthorized – token invalid or expired");
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        sessionStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(USER_KEY);
        window.location.href = "/login";
      }

      // 403 Forbidden — show friendly message
      if (status === 403) {
        console.error("🚫 Access denied:", data?.message || "Forbidden");
      }

      // 500+ errors — server issues
      if (status >= 500) {
        console.error("💥 Server error:", data?.message || "Internal Server Error");
      }

      return Promise.reject(error.response);
    }

    if (error.request) {
      // Request made but no response
      console.error("🌐 Network or CORS error:", error.message);
    } else {
      // Something happened while setting up the request
      console.error("⚙️ Axios setup error:", error.message);
    }

    return Promise.reject(error);
  }
);

// --- Helper for multipart/form-data uploads ---
export const uploadFile = async (endpoint, formData) => {
  try {
    const res = await api.post(endpoint, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  } catch (err) {
    console.error("File upload failed:", err);
    throw err;
  }
};

export default api;
