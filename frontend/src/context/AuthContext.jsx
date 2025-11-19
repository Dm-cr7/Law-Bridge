/**
 * AuthContext.jsx
 * ------------------------------------------------------------
 * Global authentication + socket context for the Legal Platform frontend
 *
 * Features:
 *  ✅ Securely stores and decodes JWT (localStorage or sessionStorage)
 *  ✅ Persists user between reloads
 *  ✅ Auto-logout on token expiration or 401
 *  ✅ Provides global login(), logout(), and user access
 *  ✅ Auto-connects Socket.IO after login
 *  ✅ Integrates seamlessly with ProtectedRoute.jsx
 */

import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
} from "react";
import jwtDecode from "jwt-decode";
import axios from "axios";
import {
  socket,
  connectSocketWithToken,
  disconnectSocket,
} from "../utils/socket";

const AuthContext = createContext(null);

const TOKEN_KEY = "authToken";
const USER_KEY = "authUser";

// === Axios instance with JWT auto-injection ===
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token =
    localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// === Handle 401 globally ===
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      console.warn("🔒 Session expired or invalid. Logging out.");
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(USER_KEY);
      disconnectSocket();
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // === Helper: Decode + validate token ===
  const decodeToken = (token) => {
    try {
      const decoded = jwtDecode(token);
      if (decoded.exp * 1000 < Date.now()) {
        console.warn("⚠️ JWT expired.");
        return null;
      }
      return decoded;
    } catch {
      return null;
    }
  };

  // === Restore session on app load ===
  useEffect(() => {
    const storedToken =
      localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
    const storedUser = localStorage.getItem(USER_KEY);

    if (storedToken && storedUser) {
      const decoded = decodeToken(storedToken);
      if (decoded) {
        setToken(storedToken);
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        connectSocketWithToken(storedToken);
      } else {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      }
    }

    setLoading(false);
  }, []);

  // === Login ===
  const login = useCallback(async (email, password, remember = true) => {
    const res = await api.post("/auth/login", { email, password });

    // Expect backend response like: { data: { token, user } }
    const { token, user } = res.data.data || {};

    if (!token || !user) {
      throw new Error("Invalid login response format from server.");
    }

    if (remember) {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      sessionStorage.setItem(TOKEN_KEY, token);
      sessionStorage.setItem(USER_KEY, JSON.stringify(user));
    }

    setUser(user);
    setToken(token);

    // Connect Socket.IO after login
    connectSocketWithToken(token);

    return user;
  }, []);

  // === Logout ===
  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);

    disconnectSocket();

    setUser(null);
    setToken(null);

    window.location.href = "/login";
  }, []);

  // === Auto-logout when token expires ===
  useEffect(() => {
    if (!token) return;
    const decoded = decodeToken(token);
    if (!decoded) return logout();

    const timeLeft = decoded.exp * 1000 - Date.now();
    const timeout = setTimeout(() => {
      console.log("⏳ Token expired, logging out automatically.");
      logout();
    }, timeLeft);

    return () => clearTimeout(timeout);
  }, [token, logout]);

  // === Context value ===
  const value = {
    user,
    token,
    loading,
    login,
    logout,
    isAuthenticated: !!user && !!token,
    hasRole: (roles) => user && roles.includes(user.role),
    api,
    socket,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading ? (
        children
      ) : (
        <div className="flex justify-center items-center h-screen bg-black-50 text-black-700">
          <div className="animate-pulse text-lg font-medium">
            Loading session...
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
};

// === Hook for consuming context ===
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
};
