// frontend/src/components/ui/Label.jsx

import React from "react";
import { cn } from "@/lib/utils";

/**
 * Label Component
 * ------------------------------------------------------------
 * A simple accessible label wrapper that:
 *  - Supports htmlFor
 *  - Supports custom className merging
 *  - Matches your design system
 */

export const Label = React.forwardRef(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn(
      "block text-sm font-medium text-gray-700 mb-1",
      className
    )}
    {...props}
  />
));

Label.displayName = "Label";
