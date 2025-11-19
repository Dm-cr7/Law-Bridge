import React from "react";
import { Loader2 } from "lucide-react";
import clsx from "clsx";

/**
 * LawBridge Button Component
 * -------------------------------------
 * Accessible, theme-aware, and React 19-safe button
 * with loading state and variant/size support.
 */

const baseStyles =
  "inline-flex items-center justify-center rounded-2xl font-medium transition-all " +
  "focus:outline-none focus:ring-2 focus:ring-offset-2 " +
  "disabled:opacity-50 disabled:cursor-not-allowed shadow-sm";

const variants = {
  primary:
    "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 " +
    "dark:bg-blue-500 dark:hover:bg-blue-600",
  secondary:
    "bg-black-100 text-black-900 hover:bg-black-200 focus:ring-black-400 " +
    "dark:bg-black-800 dark:text-black-100 dark:hover:bg-black-700",
  outline:
    "border border-black-300 text-black-800 hover:bg-black-100 focus:ring-black-400 " +
    "dark:border-black-700 dark:text-black-100 dark:hover:bg-black-800",
  danger:
    "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 " +
    "dark:bg-red-500 dark:hover:bg-red-600",
  ghost:
    "bg-transparent text-black-700 hover:bg-black-100 " +
    "dark:text-black-300 dark:hover:bg-black-800",
  link: "bg-transparent text-blue-600 hover:underline dark:text-blue-400",
};

const sizes = {
  sm: "text-sm px-3 py-1.5",
  md: "text-base px-4 py-2",
  lg: "text-lg px-5 py-2.5",
};

/**
 * @param {Object} props
 * @param {'primary'|'secondary'|'outline'|'danger'|'ghost'|'link'} [props.variant]
 * @param {'sm'|'md'|'lg'} [props.size]
 * @param {boolean} [props.loading]
 * @param {React.ReactNode} [props.children]
 * @param {string} [props.className]
 */
export const Button = React.forwardRef(
  (
    {
      children,
      variant = "primary",
      size = "md",
      loading = false,
      className = "",
      disabled,
      asChild, // 🧩 ignore unknown prop safely
      ...props
    },
    ref
  ) => {
    // Remove unsupported props before spreading to DOM
    const safeProps = { ...props };
    delete safeProps.asChild;

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={clsx(baseStyles, variants[variant], sizes[size], className)}
        {...safeProps}
      >
        {loading && (
          <Loader2 className="animate-spin mr-2 h-4 w-4 text-current" />
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export default Button;
