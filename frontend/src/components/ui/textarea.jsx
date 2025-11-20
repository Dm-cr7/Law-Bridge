// frontend/src/components/ui/textarea.jsx

import React from "react";
import { cn } from "@/lib/utils";

/**
 * Textarea Component
 * ------------------------------------------------------------
 * Styled textarea matching your UI Input + Label components.
 * Supports:
 *  - ref forwarding
 *  - custom className
 *  - all textarea attributes
 */

export const Textarea = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm",
        "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
        "placeholder:text-gray-400",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
      {...props}
    />
  );
});

Textarea.displayName = "Textarea";
