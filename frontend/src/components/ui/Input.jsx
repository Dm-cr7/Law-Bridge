// frontend/src/components/ui/Input.jsx
import React from "react";
import clsx from "clsx";

/**
 * LawBridge Input Component
 * -------------------------------------
 * A clean, accessible, and reusable input for forms.
 */

export const Input = React.forwardRef(
  (
    {
      id,
      label,
      type = "text",
      placeholder = "",
      error,
      description,
      className = "",
      disabled = false,
      required = false,
      icon: Icon,
      ...props
    },
    ref
  ) => {
    return (
      <div className={clsx("w-full", className)}>
        {/* Label */}
        {label && (
          <label
            htmlFor={id}
            className="block mb-1.5 text-sm font-medium text-black-700 dark:text-black-300"
          >
            {label}
            {required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
        )}

        {/* Input wrapper (for icons, focus, etc.) */}
        <div
          className={clsx(
            "relative flex items-center rounded-lg border transition-all duration-200",
            "bg-white dark:bg-black-900 text-black-900 dark:text-black-100",
            disabled
              ? "opacity-50 cursor-not-allowed bg-black-100 dark:bg-black-800"
              : "focus-within:ring-2 focus-within:ring-blue-500 border-black-300 dark:border-black-700",
            error &&
              "border-red-500 focus-within:ring-red-500 focus-within:ring-1"
          )}
        >
          {/* Icon (optional) */}
          {Icon && (
            <span className="pl-3 text-black-400 dark:text-black-500">
              <Icon className="w-4 h-4" />
            </span>
          )}

          {/* Input Field */}
          <input
            id={id}
            ref={ref}
            type={type}
            placeholder={placeholder}
            disabled={disabled}
            required={required}
            className={clsx(
              "w-full px-3 py-2 rounded-lg bg-transparent outline-none text-sm placeholder-black-400",
              Icon && "pl-2",
              "focus:outline-none focus:ring-0"
            )}
            {...props}
          />
        </div>

        {/* Description or Error */}
        {error ? (
          <p className="mt-1 text-sm text-red-500">{error}</p>
        ) : description ? (
          <p className="mt-1 text-sm text-black-500 dark:text-black-400">
            {description}
          </p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = "Input";
