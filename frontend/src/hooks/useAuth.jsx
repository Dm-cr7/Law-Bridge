import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axiosInstance from "@/utils/axiosInstance";

/**
 * 🧠 AuthContext
 * Centralized authentication & session handler for the entire app.
 * ---------------------------------------------------------------
 * - Loads user info from token (localStorage)
 * - Keeps user, role, and token in sync
 * - Exposes login, logout, and refresh functions
 * - Works seamlessly with ProtectedRoute & DashboardLayout
 */

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token") || null);
  const [loading, setLoading] = useState(true);

  /** 🔄 Load user info from backend if token exists */
  const fetchUserProfile = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const res = await axiosInstance.get("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUser(res.data);
    } catch (err) {
      console.error("Auth Fetch Error:", err);
      handleLogout(); // Token invalid → auto logout
    } finally {
      setLoading(false);
    }
  }, [token]);

  /** 🚪 Login handler — saves token + fetches profile */
  const handleLogin = async (credentials) => {
    try {
      const res = await axiosInstance.post("/api/auth/login", credentials);
      const { token, user } = res.data;

      localStorage.setItem("token", token);
      setToken(token);
      setUser(user);
      navigate(`/dashboard/${user.role}`);
    } catch (err) {
      console.error("Login Error:", err.response?.data || err.message);
      throw err.response?.data || { message: "Login failed" };
    }
  };

  /** 🚫 Logout handler — clears session & redirects */
  const handleLogout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    navigate("/login");
  };

  /** 🔐 Persist login session on reload */
  useEffect(() => {
    fetchUserProfile();
  }, [fetchUserProfile]);

  const value = {
    user,
    token,
    role: user?.role || null,
    loading,
    login: handleLogin,
    logout: handleLogout,
    refreshUser: fetchUserProfile,
    isAuthenticated: !!user && !!token,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

/** 🧩 Custom hook — use anywhere to access auth state */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside an AuthProvider");
  }
  return context;
};

export default useAuth;
