// frontend/src/components/ui/ScrollArea.jsx
import React from "react";
import PropTypes from "prop-types";

/**
 * 📜 ScrollArea Component
 * ------------------------
 * A lightweight, accessible scroll container with styled scrollbars and optional fade effect.
 *
 * ✅ Props:
 * - children: ReactNode — content to display inside the scrollable area
 * - className: string (optional) — additional styles (e.g. height, width, padding)
 * - maxHeight: string (optional) — max height for scroll container (e.g. "400px", "70vh")
 * - fadeTop: boolean (optional) — adds a top fade overlay when scrolling
 * - fadeBottom: boolean (optional) — adds a bottom fade overlay when scrollable
 *
 * 🧪 Example:
 * <ScrollArea className="w-full" maxHeight="400px" fadeBottom>
 *   <div>Lots of content...</div>
 * </ScrollArea>
 */

export const ScrollArea = ({
  children,
  className = "",
  maxHeight = "70vh",
  fadeTop = false,
  fadeBottom = false,
}) => {
  return (
    <div className="relative w-full">
      {/* Top fade overlay */}
      {fadeTop && (
        <div className="pointer-events-none absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-background to-transparent z-10" />
      )}

      <div
        className={`
          relative overflow-y-auto scrollbar-thin scrollbar-thumb-rounded-md
          scrollbar-thumb-black-400 hover:scrollbar-thumb-black-500
          dark:scrollbar-thumb-black-600 dark:hover:scrollbar-thumb-black-500
          ${className}
        `}
        style={{ maxHeight }}
      >
        {children}
      </div>

      {/* Bottom fade overlay */}
      {fadeBottom && (
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-background to-transparent z-10" />
      )}
    </div>
  );
};

ScrollArea.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  maxHeight: PropTypes.string,
  fadeTop: PropTypes.bool,
  fadeBottom: PropTypes.bool,
};

export default ScrollArea;
