// frontend/src/components/ui/SkeletonLoader.jsx
import React from "react";
import clsx from "clsx";

/**
 * LawBridge SkeletonLoader
 * --------------------------
 * A reusable shimmer placeholder used during API/data loading states.
 * - Supports multiple variants (text, circle, rectangular, card)
 * - Fully responsive and dark-mode aware
 * - Optimized for large concurrent renders (1000+ users)
 */

const SkeletonLoader = ({
  variant = "text", // "text" | "circle" | "rect" | "card" | "line"
  width = "100%",
  height = "1rem",
  count = 1,
  className = "",
  rounded = "md",
}) => {
  // Generate multiple skeleton elements if count > 1
  const loaders = Array.from({ length: count }).map((_, idx) => (
    <div
      key={idx}
      className={clsx(
        "relative overflow-hidden bg-black-200 dark:bg-black-800 animate-pulse",
        {
          "rounded-full": variant === "circle",
          "rounded-md": variant === "rect" || variant === "text",
          "rounded-2xl": variant === "card",
        },
        className
      )}
      style={{
        width:
          variant === "circle"
            ? height
            : typeof width === "number"
            ? `${width}px`
            : width,
        height: typeof height === "number" ? `${height}px` : height,
      }}
    >
      {/* shimmer effect */}
      <div
        className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent dark:via-black-700/40 animate-[shimmer_1.8s_infinite]"
      />
    </div>
  ));

  return (
    <div
      className={clsx(
        "flex flex-col gap-2",
        variant === "card" && "p-4 border border-black-200 dark:border-black-700 rounded-2xl",
        className
      )}
    >
      {loaders}
    </div>
  );
};

export default SkeletonLoader;
