/**
 * Separator.jsx
 * ------------------------------------------------------------
 * A minimalist, accessible horizontal separator line component.
 * ------------------------------------------------------------
 * ✅ Fully compatible with Tailwind CSS
 * ✅ Supports vertical or horizontal orientation
 * ✅ Customizable thickness, color, and spacing via props
 * ✅ Used across layouts and cards for clean section separation
 */

import React from "react";
import PropTypes from "prop-types";

/**
 * Separator Component
 * @param {Object} props
 * @param {"horizontal" | "vertical"} props.orientation - Direction of the separator
 * @param {string} props.className - Additional Tailwind or custom classes
 * @param {string} props.color - Optional override for border color
 */
export function Separator({
  orientation = "horizontal",
  className = "",
  color = "border-gray-200 dark:border-gray-700",
}) {
  const base =
    orientation === "vertical"
      ? `h-full w-px mx-2 ${color}`
      : `w-full h-px my-2 ${color}`;

  return <div className={`${base} ${className}`} role="separator" />;
}

/* ===========================================================
   ✅ PropTypes for better IDE hints & runtime validation
   =========================================================== */
Separator.propTypes = {
  orientation: PropTypes.oneOf(["horizontal", "vertical"]),
  className: PropTypes.string,
  color: PropTypes.string,
};

export default Separator;
