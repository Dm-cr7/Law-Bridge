// frontend/src/pages/public/ForgotPassword.jsx
import React, { useState } from "react";
import { motion } from "framer-motion";
import { Mail, ArrowLeft, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "@/utils/api";
import { toast } from "sonner";

/**
 * ✉️ ForgotPassword.jsx
 * ------------------------------------------------------------
 * - Secure email-based password reset request
 * - Matches design of Login/Register/ResetPassword pages
 * - Provides user feedback and smooth animations
 */

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!email) return toast.error("Please enter your email address");
    setLoading(true);

    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
      toast.success("Password reset link sent! Check your email inbox.");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to send reset email");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gradient-to-br from-blue-50 via-white to-blue-100 p-4">
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md bg-white shadow-xl rounded-2xl p-8 border border-slate-100"
      >
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <img src="/logo.png" alt="Company Logo" className="w-14 h-14" />
          </div>
          <h1 className="text-3xl font-bold text-slate-800">Forgot Password</h1>
          <p className="text-slate-500 text-sm mt-1">
            Enter your account email to receive a password reset link
          </p>
        </div>

        {/* Form */}
        {!sent ? (
          <form onSubmit={handleForgotPassword} className="space-y-5">
            <div>
              <label className="text-sm font-medium text-slate-700">
                Email Address
              </label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-3 text-slate-400 w-5 h-5" />
                <input
                  type="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500 outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white px-5 py-2 rounded-lg font-medium shadow hover:bg-blue-700 transition-colors disabled:opacity-50 flex justify-center items-center"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin mr-2 h-4 w-4" /> Sending...
                </>
              ) : (
                "Send Reset Link"
              )}
            </button>
          </form>
        ) : (
          <div className="text-center">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
              ✅ We’ve sent a password reset link to <strong>{email}</strong>.{" "}
              Please check your inbox and follow the instructions to continue.
            </div>
            <button
              onClick={() => navigate("/login")}
              className="mt-6 w-full bg-blue-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Back to Login
            </button>
          </div>
        )}

        {/* Footer Links */}
        {!sent && (
          <div className="mt-6 text-center text-sm text-slate-500">
            <button
              onClick={() => navigate("/login")}
              className="inline-flex items-center text-blue-600 hover:underline font-medium"
            >
              <ArrowLeft size={16} className="mr-1" /> Back to Login
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
