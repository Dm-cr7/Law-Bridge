import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Mail, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

/**
 * ⚖️ Login.jsx
 * ------------------------------------------------------------
 * Creative 2D Gradient Motion Edition
 * Clean, responsive, and fully brand-aligned with LawBridge UI.
 */

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(email, password, true);
      if (user) {
        toast.success("Welcome back!");
        navigate(`/dashboard/${user.role || "advocate"}`);
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    setResetLoading(true);
    try {
      const { api } = useAuth();
      await api.post("/auth/forgot-password", { email: resetEmail });
      toast.success("If that email exists, a reset link has been sent.");
      setResetSent(true);
      setResetEmail("");
    } catch {
      toast.error("Failed to send reset link");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="relative flex flex-col justify-center items-center min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-white to-blue-100">
      {/* 🔵 Animated background glows */}
      <motion.div
        className="absolute -top-20 -left-20 w-[400px] h-[400px] bg-sky-400/30 rounded-full blur-[150px]"
        animate={{ x: [0, 30, -30, 0], y: [0, 20, -20, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-blue-500/30 rounded-full blur-[180px]"
        animate={{ x: [0, -40, 40, 0], y: [0, -30, 30, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* 🧭 Login Card */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="relative z-10 w-full max-w-md bg-white/70 backdrop-blur-xl border border-blue-100 shadow-[0_0_40px_rgba(56,189,248,0.2)] rounded-2xl p-8"
      >
        {/* 🌟 Header */}
        <div className="text-center mb-6">
          <motion.img
            src="/logo.png"
            alt="LawBridge Logo"
            className="w-14 h-14 mx-auto drop-shadow-lg"
            initial={{ scale: 0.9 }}
            animate={{ scale: [0.9, 1.05, 0.9] }}
            transition={{ duration: 3, repeat: Infinity }}
          />
          <h1 className="text-3xl font-extrabold text-blue-700 mt-3">
            Welcome Back
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Secure access to your LawBridge dashboard
          </p>
        </div>

        {/* 📝 Login Form */}
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="text-sm font-medium text-slate-700">Email</label>
            <div className="relative mt-1">
              <Mail className="absolute left-3 top-3 text-blue-400 w-5 h-5" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full pl-10 pr-3 py-2 border border-blue-100 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none text-black bg-white/80"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Password</label>
            <div className="relative mt-1">
              <Lock className="absolute left-3 top-3 text-blue-400 w-5 h-5" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
                className="w-full pl-10 pr-10 py-2 border border-blue-100 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none text-black bg-white/80"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-blue-500 transition"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {/* 🔗 Forgot / Login Actions */}
          <div className="flex justify-between items-center mt-4">
            <button
              type="button"
              onClick={() => setForgotOpen(true)}
              className="text-sm text-blue-600 hover:underline"
            >
              Forgot password?
            </button>

            <button
              type="submit"
              disabled={loading}
              className="bg-gradient-to-r from-blue-600 to-sky-500 text-white px-6 py-2 rounded-full font-medium shadow-md hover:shadow-lg hover:scale-[1.02] transition-all disabled:opacity-60"
            >
              {loading ? "Logging in..." : "Login"}
            </button>
          </div>
        </form>

        <div className="mt-6 text-center text-sm text-slate-600">
          Don’t have an account?{" "}
          <a
            href="/register"
            className="text-blue-600 hover:underline font-semibold"
          >
            Register
          </a>
        </div>
      </motion.div>

      {/* 🔒 Forgot Password Modal */}
      <AnimatePresence>
        {forgotOpen && (
          <motion.div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white/90 backdrop-blur-lg rounded-2xl shadow-2xl p-6 w-full max-w-md border border-blue-100"
            >
              <h2 className="text-xl font-bold text-blue-700 text-center mb-4">
                Forgot Password
              </h2>

              {resetSent ? (
                <div className="text-center space-y-4">
                  <p className="text-slate-600">
                    A password reset link has been sent to your email.
                  </p>
                  <button
                    onClick={() => {
                      setForgotOpen(false);
                      setResetSent(false);
                    }}
                    className="bg-gradient-to-r from-blue-600 to-sky-500 text-white px-5 py-2 rounded-full font-medium hover:shadow-md transition"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgot} className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700">
                      Email
                    </label>
                    <div className="relative mt-1">
                      <Mail className="absolute left-3 top-3 text-blue-400 w-5 h-5" />
                      <input
                        type="email"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        required
                        placeholder="you@example.com"
                        className="w-full pl-10 pr-3 py-2 border border-blue-100 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none text-black bg-white/80"
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center mt-3">
                    <button
                      type="button"
                      onClick={() => setForgotOpen(false)}
                      className="text-sm text-slate-500 hover:underline"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={resetLoading}
                      className="bg-gradient-to-r from-blue-600 to-sky-500 text-white px-5 py-2 rounded-full font-medium hover:shadow-md transition disabled:opacity-60"
                    >
                      {resetLoading ? "Sending..." : "Send reset link"}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
