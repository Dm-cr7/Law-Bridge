// frontend/src/components/ui/StatCard.jsx
import React from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import clsx from "clsx";

/**
 * LawBridge StatCard
 * -------------------
 * Displays key performance stats for cases, users, evidence, etc.
 * Includes optional trend indicators, icons, and loading states.
 */

const StatCard = ({
  title,
  value,
  icon: Icon,
  change,
  changeType = "neutral", // "increase", "decrease", "neutral"
  description,
  isLoading = false,
  color = "blue", // Can be: blue, green, red, yellow, purple, black
}) => {
  const colorClasses = {
    blue: "from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20",
    green: "from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20",
    red: "from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20",
    yellow: "from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20",
    purple: "from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20",
    black: "from-black-50 to-black-100 dark:from-black-900/20 dark:to-black-800/20",
  };

  const trendColor =
    changeType === "increase"
      ? "text-green-600 dark:text-green-400"
      : changeType === "decrease"
      ? "text-red-600 dark:text-red-400"
      : "text-black-500 dark:text-black-400";

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={clsx(
        "p-5 rounded-2xl shadow-sm border border-black-200 dark:border-black-800 bg-gradient-to-br transition-all duration-300 hover:shadow-lg hover:border-black-300 dark:hover:border-black-700",
        colorClasses[color]
      )}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <h4 className="text-sm font-semibold text-black-600 dark:text-black-400">{title}</h4>
        </div>
        {Icon && (
          <div
            className={clsx(
              "p-2 rounded-lg bg-white/70 dark:bg-black-900/40 shadow-sm",
              color.startsWith("blue")
                ? "text-blue-500"
                : color.startsWith("green")
                ? "text-green-500"
                : color.startsWith("red")
                ? "text-red-500"
                : color.startsWith("yellow")
                ? "text-yellow-500"
                : color.startsWith("purple")
                ? "text-purple-500"
                : "text-black-500"
            )}
          >
            <Icon size={20} />
          </div>
        )}
      </div>

      {/* Main Value */}
      <div className="flex items-end justify-between">
        {isLoading ? (
          <div className="h-7 w-24 bg-black-200 dark:bg-black-700 animate-pulse rounded-md" />
        ) : (
          <p className="text-3xl font-bold text-black-900 dark:text-black-100">{value}</p>
        )}

        {/* Trend Indicator */}
        {change && (
          <div className={clsx("flex items-center text-sm font-medium", trendColor)}>
            {changeType === "increase" && <ArrowUpRight size={16} className="mr-1" />}
            {changeType === "decrease" && <ArrowDownRight size={16} className="mr-1" />}
            {change}
          </div>
        )}
      </div>

      {/* Description */}
      {description && (
        <p className="text-xs text-black-500 dark:text-black-400 mt-2">{description}</p>
      )}
    </motion.div>
  );
};

export default StatCard;
