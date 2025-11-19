/**
 * utils/handleError.js
 * ------------------------------------------------------------
 * Centralized error handler for frontend
 *
 * Features:
 *  ✅ Normalizes Axios / Fetch / JS errors
 *  ✅ Automatically detects network, validation, and server errors
 *  ✅ Supports toast or modal display via callback
 *  ✅ Logs detailed info in dev, minimal info in prod
 */

import { toast } from "react-toastify";

/**
 * Normalize error object into a unified structure
 * @param {any} error - Axios or JS Error object
 * @returns {{ message: string, status?: number, details?: any }}
 */
export const normalizeError = (error) => {
  if (!error) {
    return { message: "Unknown error occurred" };
  }

  // Axios error with server response
  if (error.response) {
    const { data, status } = error.response;
    const message =
      data?.message ||
      (status === 401
        ? "Unauthorized — please log in again."
        : status === 403
        ? "You don't have permission to access this resource."
        : status === 404
        ? "Resource not found."
        : status >= 500
        ? "Server error. Please try again later."
        : "Unexpected server response.");
    return { message, status, details: data };
  }

  // Network error (no response)
  if (error.request) {
    return {
      message:
        "Network error — please check your internet connection or try again later.",
    };
  }

  // Plain JS error or thrown string
  if (typeof error === "string") return { message: error };
  if (error instanceof Error) return { message: error.message };

  // Fallback for unknown shapes
  return { message: "An unexpected error occurred", details: error };
};

/**
 * Global error handler
 * Automatically logs and shows toast notification (if enabled)
 *
 * @param {any} error - Error object or response
 * @param {Object} options
 * @param {boolean} [options.showToast=true] - Show toast notification
 * @param {boolean} [options.silent=false] - Skip logging
 * @param {Function} [options.customHandler] - Optional custom handler
 */
export const handleError = (
  error,
  { showToast = true, silent = false, customHandler } = {}
) => {
  const normalized = normalizeError(error);

  if (!silent && import.meta.env.DEV) {
    console.groupCollapsed("❌ Frontend Error Handler");
    console.error("Normalized error:", normalized);
    console.groupEnd();
  }

  if (typeof customHandler === "function") {
    customHandler(normalized);
  } else if (showToast) {
    toast.error(normalized.message, {
      position: "top-right",
      autoClose: 5000,
      theme: "colored",
    });
  }

  return normalized;
};

export default handleError;
