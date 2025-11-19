// frontend/src/components/AnalyticsCards.jsx
import React from "react";
import PropTypes from "prop-types";
import { Clock, Loader2, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";

/**
 * AnalyticsCards Component
 * ----------------------------------------------------------
 * Displays key workflow metrics — Pending, In Progress, Done.
 * Responsive, color-coded, dark-mode friendly, and animated.
 */
export default function AnalyticsCards({ pending = 0, inProgress = 0, done = 0 }) {
  const cards = [
    {
      title: "Pending",
      value: pending,
      bg: "bg-blue-50 dark:bg-blue-900/30",
      border: "border-blue-200 dark:border-blue-800",
      icon: <Clock size={26} className="text-blue-600 dark:text-blue-400" />,
      text: "text-blue-700 dark:text-blue-300",
    },
    {
      title: "In Progress",
      value: inProgress,
      bg: "bg-amber-50 dark:bg-amber-900/30",
      border: "border-amber-200 dark:border-amber-800",
      icon: <Loader2 size={26} className="text-amber-600 dark:text-amber-400" />,
      text: "text-amber-700 dark:text-amber-300",
    },
    {
      title: "Done",
      value: done,
      bg: "bg-green-50 dark:bg-green-900/30",
      border: "border-green-200 dark:border-green-800",
      icon: <CheckCircle size={26} className="text-green-600 dark:text-green-400" />,
      text: "text-green-700 dark:text-green-300",
    },
  ];

  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4"
      aria-label="Analytics Summary Cards"
    >
      {cards.map((card) => (
        <motion.div
          key={card.title}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.98 }}
          className={`rounded-xl border shadow-sm ${card.bg} ${card.border} 
                      transition-all duration-300 p-5 flex flex-col 
                      items-center justify-center text-center`}
        >
          <div className="mb-2" aria-hidden="true">
            {card.icon}
          </div>
          <h2 className={`text-base font-semibold ${card.text}`}>{card.title}</h2>
          <p
            className="text-3xl font-bold text-black-900 dark:text-black-100 mt-1"
            aria-label={`${card.title} count`}
          >
            {Number.isFinite(card.value) ? card.value.toLocaleString() : "—"}
          </p>
        </motion.div>
      ))}
    </div>
  );
}

AnalyticsCards.propTypes = {
  pending: PropTypes.number,
  inProgress: PropTypes.number,
  done: PropTypes.number,
};
