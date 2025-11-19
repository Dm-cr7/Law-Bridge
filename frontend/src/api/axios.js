// frontend/src/utils/api.js

import axios from "axios";

// 🧭 Determine backend base URL from environment
const rawBaseURL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const baseURL = rawBaseURL.replace(/\/+$/, ""); // Remove trailing slashes

// 🏗️ Create axios instance
const api = axios.create({
  baseURL, // Example: https://your-backend.com
  withCredentials: true, // Allow cookies if backend uses them
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// 🛠️ Request Interceptor — Attach JWT token automatically
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token && typeof token === "string") {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 🚨 Response Interceptor — Handle expired sessions / unauthorized
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;

    if (status === 401) {
      console.warn("Unauthorized: clearing session and redirecting...");
      localStorage.removeItem("token");
      localStorage.removeItem("role");

      // Optional: Redirect to login if using React Router
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);

export default api;
