// frontend/src/components/ui/Modal.jsx
import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import clsx from "clsx";

/**
 * LawBridge Modal Component
 * ------------------------------------
 * Accessible, responsive, and animated modal for dialogs and confirmations.
 */

export const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
  showClose = true,
  overlayClose = true,
  className = "",
}) => {
  // Close on ESC key
  useEffect(() => {
    const handleEsc = (e) => e.key === "Escape" && onClose?.();
    if (isOpen) document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  const sizeClasses = {
    sm: "max-w-sm",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={overlayClose ? onClose : undefined}
          />

          {/* Modal Container */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className={clsx(
              "fixed z-50 inset-0 flex items-center justify-center p-4",
              "overflow-y-auto"
            )}
          >
            <div
              className={clsx(
                "w-full rounded-2xl shadow-xl border border-black-200 dark:border-black-700",
                "bg-white dark:bg-black-900 text-black-900 dark:text-black-100",
                "relative flex flex-col",
                sizeClasses[size],
                className
              )}
            >
              {/* Header */}
              {(title || showClose) && (
                <div className="flex items-center justify-between p-4 border-b border-black-200 dark:border-black-700">
                  {title && (
                    <h2 className="text-lg font-semibold text-black-800 dark:text-black-200">
                      {title}
                    </h2>
                  )}

                  {showClose && (
                    <button
                      onClick={onClose}
                      className="text-black-400 hover:text-black-600 dark:hover:text-black-300 transition"
                      aria-label="Close modal"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              )}

              {/* Content */}
              <div className="p-5 overflow-y-auto max-h-[85vh]">{children}</div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
