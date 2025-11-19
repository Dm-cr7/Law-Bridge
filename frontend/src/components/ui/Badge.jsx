// frontend/src/components/ui/Badge.jsx
import React from "react";
import clsx from "clsx";

/**
 * LawBridge Badge Component
 * --------------------------------------
 * Clean, accessible, color-coded labels for status, roles, or tags.
 * Variants: primary, success, warning, danger, info, neutral, outline
 */

export const Badge = ({
  children,
  variant = "neutral",
  size = "md",
  icon: Icon = null,
  className = "",
}) => {
  const baseStyles =
    "inline-flex items-center justify-center font-medium rounded-full select-none transition-colors duration-200";

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-3 py-1",
    lg: "text-base px-4 py-1.5",
  };

  const variantClasses = {
    primary:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-300 dark:border-blue-700",
    success:
      "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border border-green-300 dark:border-green-700",
    warning:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-700",
    danger:
      "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border border-red-300 dark:border-red-700",
    info:
      "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-700",
    neutral:
      "bg-black-100 text-black-800 dark:bg-black-800 dark:text-black-200 border border-black-300 dark:border-black-700",
    outline:
      "bg-transparent text-black-700 dark:text-black-300 border border-black-400/50 dark:border-black-600 hover:bg-black-100/10",
  };

  return (
    <span
      className={clsx(
        baseStyles,
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
    >
      {Icon && <Icon className="w-4 h-4 mr-1" />}
      {children}
    </span>
  );
};
