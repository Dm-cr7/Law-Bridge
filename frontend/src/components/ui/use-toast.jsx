// frontend/src/components/ui/use-toast.jsx
import React, { createContext, useContext, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, CheckCircle, AlertCircle, Info, Bell } from "lucide-react";
import clsx from "clsx";

/**
 * LawBridge Toast System
 * ----------------------
 * - Supports types: success, error, info, warning, general
 * - Auto dismiss + manual close
 * - Framer Motion animations
 */

const ToastContext = createContext();

export const useToast = () => useContext(ToastContext);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Add a new toast
  const addToast = useCallback(
    (toast) => {
      const id = toast.id || Date.now();
      setToasts((prev) => [...prev, { id, ...toast }]);

      if (toast.duration !== 0) {
        setTimeout(() => removeToast(id), toast.duration || 4000);
      }
    },
    [removeToast]
  );

  // Link global toast helper
  toast.add = addToast;

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-3 w-[340px] max-w-[90vw]">
        <AnimatePresence>
          {toasts.map((t) => (
            <Toast key={t.id} {...t} onClose={() => removeToast(t.id)} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

/* =======================================================
   Individual Toast Component
   ======================================================= */
const Toast = ({ type = "info", title, message, onClose }) => {
  const icons = {
    success: CheckCircle,
    error: AlertCircle,
    warning: AlertCircle,
    info: Info,
    general: Bell,
  };
  const Icon = icons[type] || Bell;

  const baseStyle =
    "relative flex items-start gap-3 p-4 rounded-xl shadow-md border transition-colors duration-200";
  const typeStyle = {
    success:
      "bg-green-50 text-green-800 border-green-300 dark:bg-green-900/40 dark:text-green-200",
    error:
      "bg-red-50 text-red-800 border-red-300 dark:bg-red-900/40 dark:text-red-200",
    warning:
      "bg-yellow-50 text-yellow-800 border-yellow-300 dark:bg-yellow-900/40 dark:text-yellow-200",
    info:
      "bg-blue-50 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-200",
    general:
      "bg-black-50 text-black-800 border-black-300 dark:bg-black-800 dark:text-black-100",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 30, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className={clsx(baseStyle, typeStyle[type])}
    >
      <Icon className="w-6 h-6 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        {title && <h4 className="font-semibold text-sm mb-1">{title}</h4>}
        {message && <p className="text-sm leading-snug">{message}</p>}
      </div>
      <button
        onClick={onClose}
        className="absolute top-2 right-2 text-black-500 hover:text-black-700 dark:text-black-400 dark:hover:text-black-200"
        aria-label="Close notification"
      >
        <X size={16} />
      </button>
    </motion.div>
  );
};

/* =======================================================
   Global Toast Helper
   ======================================================= */
export const toast = {
  add: () => {
    console.warn(
      "⚠️ toast.add() called before <ToastProvider> initialized. Wrap your app with <ToastProvider>."
    );
  },
  success: (message, opts = {}) => toast.add({ type: "success", message, ...opts }),
  error: (message, opts = {}) => toast.add({ type: "error", message, ...opts }),
  info: (message, opts = {}) => toast.add({ type: "info", message, ...opts }),
  warning: (message, opts = {}) => toast.add({ type: "warning", message, ...opts }),
  general: (message, opts = {}) => toast.add({ type: "general", message, ...opts }),
};

export default ToastProvider;
