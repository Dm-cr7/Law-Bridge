// frontend/src/utils/axiosInstance.js
import axios from "axios";

// ✅ Dynamically set the base URL depending on environment
const BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

// ✅ Create the Axios instance
const axiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15000, // 15s timeout
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // send cookies if your backend uses them
});

// ✅ Automatically attach JWT token from localStorage (or cookies)
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// ✅ Handle global response errors
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle expired token — optional auto-refresh pattern
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      localStorage.getItem("refreshToken")
    ) {
      originalRequest._retry = true;
      try {
        const refreshToken = localStorage.getItem("refreshToken");
        const refreshResponse = await axios.post(`${BASE_URL}/auth/refresh`, {
          refreshToken,
        });

        const newAccessToken = refreshResponse.data?.accessToken;
        if (newAccessToken) {
          localStorage.setItem("token", newAccessToken);
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return axiosInstance(originalRequest);
        }
      } catch (refreshError) {
        console.error("🔒 Token refresh failed:", refreshError);
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        window.location.href = "/login";
      }
    }

    // Log and return error
    console.error("❌ API Error:", error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// ✅ Export helper functions for cleaner usage
export const apiGet = (url, config = {}) => axiosInstance.get(url, config);
export const apiPost = (url, data, config = {}) => axiosInstance.post(url, data, config);
export const apiPut = (url, data, config = {}) => axiosInstance.put(url, data, config);
export const apiDelete = (url, config = {}) => axiosInstance.delete(url, config);

export default axiosInstance;
