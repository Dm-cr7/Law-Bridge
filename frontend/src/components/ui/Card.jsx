// frontend/src/components/ui/Card.jsx
import React from "react";
import clsx from "clsx";

/**
 * LawBridge Card Component
 * -------------------------------------
 * Reusable card component with a clean, legal-grade UI aesthetic.
 * Supports header, title, content, and footer regions.
 */

const baseStyles =
  "rounded-2xl bg-white dark:bg-black-900 shadow-sm border border-black-200 dark:border-black-800 transition-all duration-300";

const hoverableStyles =
  "hover:shadow-md hover:-translate-y-0.5 cursor-pointer";

export const Card = React.forwardRef(
  ({ children, className = "", hoverable = false, bordered = true, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={clsx(
          baseStyles,
          hoverable && hoverableStyles,
          !bordered && "border-transparent",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = "Card";

/* =======================================================
   SUBCOMPONENTS
   ======================================================= */

export const CardHeader = ({ title, subtitle, className = "", children }) => (
  <div className={clsx("px-5 py-4 border-b border-black-100 dark:border-black-800", className)}>
    {title && (
      <h3 className="text-lg font-semibold text-black-900 dark:text-black-100">{title}</h3>
    )}
    {subtitle && (
      <p className="text-sm text-black-500 dark:text-black-400">{subtitle}</p>
    )}
    {children}
  </div>
);

export const CardTitle = ({ children, className = "" }) => (
  <h3 className={clsx("text-lg font-semibold text-black-900 dark:text-black-100", className)}>
    {children}
  </h3>
);

export const CardContent = ({ className = "", children }) => (
  <div className={clsx("px-5 py-4 text-black-800 dark:text-black-200", className)}>
    {children}
  </div>
);

export const CardFooter = ({ className = "", children }) => (
  <div className={clsx("px-5 py-3 border-t border-black-100 dark:border-black-800", className)}>
    {children}
  </div>
);

/* =======================================================
   DEFAULT EXPORT (subcomponent style)
   ======================================================= */
export default Object.assign(Card, {
  Header: CardHeader,
  Title: CardTitle,
  Content: CardContent,
  Footer: CardFooter,
});
