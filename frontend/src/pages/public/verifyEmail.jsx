import React, { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { CheckCircle, XCircle, Mail, RefreshCw, ArrowRight } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import api from "@/utils/api";
import { Button } from "@/components/ui/Button";
import ResponsiveImage from "@/components/ResponsiveImage";

/**
 * VerifyEmail.jsx
 *
 * Purpose
 * - Page that handles email verification when users follow the verification link
 * - Reads `token` (and optional `email`) from URL query string
 * - Calls backend endpoint: POST /api/auth/verify-email (or GET depending on your API)
 * - Shows success / failure UI, allows resending verification email
 *
 * Usage
 * - Add route: <Route path="/verify-email" element={<VerifyEmail />} />
 *
 * Notes
 * - Uses `api` wrapper (axios) that should be configured with baseURL and credentials
 * - Uses ResponsiveImage for decorative hero image (uses /images/legal-bg.jpg from public/)
 *
 */

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const emailParam = searchParams.get("email") || "";
  const navigate = useNavigate();

  const [status, setStatus] = useState("idle"); // idle | pending | success | error
  const [message, setMessage] = useState("");
  const [resendLoading, setResendLoading] = useState(false);

  const verify = useCallback(async () => {
    if (!token) {
      setStatus("error");
      setMessage("Verification token not found in URL.");
      return;
    }

    try {
      setStatus("pending");
      setMessage("");
      // prefer POST (secure) but adapt to your backend. If your backend expects GET, switch accordingly.
      const res = await api.post(
        "/auth/verify-email",
        { token },
        { withCredentials: true }
      );

      // backend expected shape: { success: true, message: "..." } or { data: { ... } }
      if (res?.data?.success || res?.status === 200) {
        setStatus("success");
        setMessage(res?.data?.message || "Your email has been verified. Thank you!");
        toast.success(res?.data?.message || "Email verified successfully");
      } else {
        setStatus("error");
        setMessage(res?.data?.message || "Verification failed. Please try again.");
        toast.error(res?.data?.message || "Verification failed");
      }
    } catch (err) {
      console.error("VerifyEmail error:", err);
      const backendMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Verification failed";
      setStatus("error");
      setMessage(String(backendMsg));
      toast.error(String(backendMsg));
    }
  }, [token]);

  useEffect(() => {
    // Auto-run verification on mount
    verify();
  }, [verify]);

  // Resend verification email
  const handleResend = async () => {
    if (!emailParam) {
      toast.error("No email present to resend to. If you used a different link, enter your email on the reset page.");
      return;
    }

    try {
      setResendLoading(true);
      const res = await api.post("/auth/resend-verification", { email: emailParam }, { withCredentials: true });
      if (res?.data?.success) {
        toast.success(res.data.message || "Verification email resent.");
      } else {
        toast.error(res?.data?.message || "Failed to resend verification email.");
      }
    } catch (err) {
      console.error("Resend verification error:", err);
      const backendMsg = err?.response?.data?.message || err?.message || "Failed to resend";
      toast.error(String(backendMsg));
    } finally {
      setResendLoading(false);
    }
  };

  // Optional: allow user to manually navigate to login
  const goToLogin = () => navigate("/login");

  const heroImage = "/images/legal-bg.jpg"; // public path
  const logoUrl = "/logo.png";

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-sky-50 via-blue-50 to-white text-slate-800">
      {/* HERO */}
      <header className="relative w-full h-56 sm:h-72 flex items-center justify-center overflow-hidden">
        <ResponsiveImage
          src={heroImage}
          alt="Courtroom background"
          className="absolute inset-0 w-full h-full object-cover opacity-80"
          style={{ filter: "brightness(0.5) contrast(0.9)" }}
        />
        <div className="relative z-10 text-center px-6">
          <img src={logoUrl} alt="LawBridge logo" className="mx-auto w-28 h-auto mb-2" />
          <h1 className="text-2xl md:text-3xl font-extrabold text-white drop-shadow-md">
            Verify your email
          </h1>
          <p className="mt-2 text-sm md:text-base text-blue-50/90 max-w-2xl mx-auto">
            Complete your registration — verify your email so you can access hearings, cases, and messages.
          </p>
        </div>
      </header>

      {/* MAIN CARD */}
      <main className="flex-1 container py-12">
        <div className="max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-white rounded-2xl shadow-lg p-8 border border-slate-100"
          >
            {/* Status */}
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                {status === "success" ? (
                  <CheckCircle className="w-12 h-12 text-emerald-500" />
                ) : status === "pending" ? (
                  <Mail className="w-12 h-12 text-sky-500 animate-pulse" />
                ) : (
                  <XCircle className="w-12 h-12 text-rose-500" />
                )}
              </div>

              <div className="flex-1">
                <h2 className="text-xl font-semibold">
                  {status === "success"
                    ? "Email verified"
                    : status === "pending"
                    ? "Verifying your email..."
                    : "Verification failed"}
                </h2>

                <p className="mt-2 text-slate-600">
                  {status === "pending"
                    ? "Please wait while we validate your verification link."
                    : message || "If verification did not complete, you can try resending the email."}
                </p>

                {/* Extra details on success */}
                {status === "success" && (
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button onClick={goToLogin} className="btn-primary">
                      Go to Login
                    </Button>
                    <Link to="/dashboard" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50">
                      Open Dashboard
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                )}

                {/* Show resend when error */}
                {status === "error" && (
                  <div className="mt-4 space-y-3">
                    <div className="text-sm text-slate-600">
                      If your link expired, you can request a new verification email.
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <Button onClick={handleResend} className="btn-primary" disabled={resendLoading}>
                        {resendLoading ? "Sending..." : "Resend verification"}
                        <RefreshCw className="w-4 h-4 ml-2" />
                      </Button>

                      <Button onClick={verify} className="btn-secondary">
                        Retry verification
                      </Button>

                      <Link to="/support" className="text-sm text-slate-500 underline ml-1">
                        Contact support
                      </Link>
                    </div>

                    {emailParam && (
                      <div className="mt-2 text-xs text-slate-500">
                        Resending to: <strong>{emailParam}</strong>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* raw message box for debugging (optional, small) */}
            {message && (
              <div className="mt-6 bg-slate-50 border border-slate-100 rounded-md p-3 text-sm text-slate-700">
                {message}
              </div>
            )}
          </motion.div>

          {/* helper links */}
          <div className="mt-6 text-center text-sm text-slate-600">
            <div>
              <Link to="/login" className="underline mr-3">
                Sign in
              </Link>
              <Link to="/register" className="underline">
                Create an account
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="py-8 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} LawBridge — Building bridges in the legal world
      </footer>
    </div>
  );
}
