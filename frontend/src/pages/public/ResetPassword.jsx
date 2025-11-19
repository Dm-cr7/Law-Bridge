// frontend/src/pages/public/ResetPassword.jsx
import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock, Eye, EyeOff } from "lucide-react";
import api from "@/utils/api";
import { toast } from "sonner";

/**
 * 🔐 Secure Password Reset Page
 * Users arrive here via secure token link from email
 * Example URL: /reset-password?token=XYZ123
 */

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [form, setForm] = useState({
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const getPasswordStrength = (password) => {
    if (!password) return { label: "", color: "" };
    const strongRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    const mediumRegex =
      /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*?&]{6,}$/;

    if (strongRegex.test(password))
      return { label: "Strong", color: "text-green-600" };
    if (mediumRegex.test(password))
      return { label: "Medium", color: "text-yellow-500" };
    return { label: "Weak", color: "text-red-500" };
  };

  const passwordStrength = getPasswordStrength(form.password);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();

    if (!token) {
      toast.error("Invalid or expired password reset link");
      return;
    }

    if (form.password !== form.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/reset-password", {
        token,
        newPassword: form.password,
      });
      toast.success("Password reset successful! You can now log in.");
      navigate("/login");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Password reset failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gradient-to-br from-blue-50 via-white to-blue-100 p-4">
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md bg-white shadow-xl rounded-2xl p-8 border border-slate-100"
      >
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <img src="/logo.png" alt="Company Logo" className="w-14 h-14" />
          </div>
          <h1 className="text-3xl font-bold text-slate-800">Reset Password</h1>
          <p className="text-slate-500 text-sm mt-1">
            Enter your new password below to regain access
          </p>
        </div>

        <form onSubmit={handleResetPassword} className="space-y-5">
          <div>
            <label className="text-sm font-medium text-slate-700">
              New Password
            </label>
            <div className="relative mt-1">
              <Lock className="absolute left-3 top-3 text-slate-400 w-5 h-5" />
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={form.password}
                onChange={handleChange}
                required
                placeholder="Enter a new password"
                className="w-full pl-10 pr-10 py-2 border rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500 outline-none text-black"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-2.5 text-slate-400"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {passwordStrength.label && (
              <p className={`text-xs mt-1 ${passwordStrength.color}`}>
                Password strength: {passwordStrength.label}
              </p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">
              Confirm New Password
            </label>
            <div className="relative mt-1">
              <Lock className="absolute left-3 top-3 text-slate-400 w-5 h-5" />
              <input
                type={showPassword ? "text" : "password"}
                name="confirmPassword"
                value={form.confirmPassword}
                onChange={handleChange}
                required
                placeholder="Re-enter new password"
                className="w-full pl-10 pr-10 py-2 border rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500 outline-none text-black"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white px-5 py-2 rounded-lg font-medium shadow hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? "Resetting..." : "Reset Password"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-500">
          Remembered your password?{" "}
          <a href="/login" className="text-blue-600 hover:underline font-medium">
            Go to Login
          </a>
        </div>
      </motion.div>
    </div>
  );
}
