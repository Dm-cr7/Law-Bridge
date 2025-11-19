// frontend/src/pages/public/VerifyEmail.jsx
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle, XCircle, Loader2, Mail } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "@/utils/api";
import { toast } from "sonner";

/**
 * ✅ VerifyEmail.jsx
 * ------------------------------------------------------------
 * - Confirms the user's email after registration
 * - Handles verification token via URL
 * - Matches Login/Register/ForgotPassword styling
 * - Provides success/error feedback and redirect options
 */

export default function VerifyEmail() {
  const [status, setStatus] = useState("verifying"); // verifying | success | error | expired
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get("token");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Invalid verification link — token missing.");
      return;
    }

    const verifyEmail = async () => {
      try {
        const { data } = await api.get(`/auth/verify-email?token=${token}`);
        if (data?.success) {
          setStatus("success");
          setMessage("Your email has been verified successfully!");
        } else {
          setStatus("error");
          setMessage(data?.message || "Verification failed.");
        }
      } catch (err) {
        const msg = err?.response?.data?.message || "Verification link invalid or expired.";
        if (msg.toLowerCase().includes("expired")) setStatus("expired");
        else setStatus("error");
        setMessage(msg);
      }
    };

    verifyEmail();
  }, [token]);

  const handleResendVerification = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/auth/resend-verification", { token });
      toast.success(data?.message || "Verification email resent!");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to resend verification email");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-100 p-4">
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-100"
      >
        <div className="flex flex-col items-center text-center">
          <img src="/logo.png" alt="Company Logo" className="w-14 h-14 mb-3" />

          {status === "verifying" && (
            <>
              <Loader2 className="animate-spin text-blue-600 w-10 h-10 mb-4" />
              <h2 className="text-xl font-semibold text-slate-700">
                Verifying your email...
              </h2>
              <p className="text-slate-500 mt-2 text-sm">
                Please wait while we confirm your verification link.
              </p>
            </>
          )}

          {status === "success" && (
            <>
              <CheckCircle className="text-green-500 w-12 h-12 mb-4" />
              <h2 className="text-2xl font-bold text-slate-800 mb-1">
                Email Verified!
              </h2>
              <p className="text-slate-500 mb-6 text-sm">{message}</p>
              <button
                onClick={() => navigate("/login")}
                className="w-full bg-blue-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Continue to Login
              </button>
            </>
          )}

          {status === "error" && (
            <>
              <XCircle className="text-red-500 w-12 h-12 mb-4" />
              <h2 className="text-2xl font-bold text-red-600 mb-1">
                Verification Failed
              </h2>
              <p className="text-slate-500 mb-6 text-sm">{message}</p>
              <button
                onClick={() => navigate("/register")}
                className="w-full bg-blue-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Go to Register
              </button>
            </>
          )}

          {status === "expired" && (
            <>
              <Mail className="text-yellow-500 w-12 h-12 mb-4" />
              <h2 className="text-2xl font-bold text-slate-800 mb-1">
                Verification Link Expired
              </h2>
              <p className="text-slate-500 mb-4 text-sm">{message}</p>
              <button
                onClick={handleResendVerification}
                disabled={loading}
                className="w-full bg-blue-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex justify-center items-center"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin h-4 w-4 mr-2" /> Sending...
                  </>
                ) : (
                  "Resend Verification Email"
                )}
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
