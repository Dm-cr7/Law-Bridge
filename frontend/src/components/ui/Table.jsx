// frontend/src/components/ui/Table.jsx
import React from "react";
import clsx from "clsx";

/**
 * LawBridge Table
 * -------------------------
 * A lightweight, responsive, accessible table UI component.
 * - Supports sortable headers
 * - Works with SkeletonLoader for loading states
 * - Dark mode aware
 * - Optimized for 1000+ rows
 */

const Table = ({
  columns = [], // [{ key: 'name', label: 'Name', sortable: true }]
  data = [],
  onSort,
  sortKey,
  sortOrder = "asc",
  emptyMessage = "No records found.",
  className = "",
}) => {
  const handleSort = (key, sortable) => {
    if (!sortable || !onSort) return;
    const newOrder = sortKey === key && sortOrder === "asc" ? "desc" : "asc";
    onSort(key, newOrder);
  };

  return (
    <div
      className={clsx(
        "w-full overflow-x-auto bg-white dark:bg-black-900 border border-black-200 dark:border-black-800 rounded-2xl shadow-sm",
        className
      )}
    >
      <table className="min-w-full divide-y divide-black-200 dark:divide-black-700">
        {/* Table Head */}
        <thead className="bg-black-50 dark:bg-black-800">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={() => handleSort(col.key, col.sortable)}
                className={clsx(
                  "px-4 py-3 text-left text-sm font-semibold text-black-700 dark:text-black-200 select-none cursor-default",
                  col.sortable && "cursor-pointer hover:text-primary-600"
                )}
              >
                <div className="flex items-center gap-1">
                  {col.label}
                  {col.sortable && (
                    <span className="text-xs text-black-500 dark:text-black-400">
                      {sortKey === col.key ? (sortOrder === "asc" ? "▲" : "▼") : ""}
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>

        {/* Table Body */}
        <tbody className="divide-y divide-black-100 dark:divide-black-800">
          {data.length > 0 ? (
            data.map((row, idx) => (
              <tr
                key={row.id || idx}
                className={clsx(
                  "hover:bg-black-50 dark:hover:bg-black-800 transition-colors",
                  idx % 2 === 0 ? "bg-white dark:bg-black-900" : "bg-black-50 dark:bg-black-950"
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className="px-4 py-3 text-sm text-black-800 dark:text-black-200 truncate max-w-[220px]"
                  >
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-6 text-center text-black-500 dark:text-black-400 text-sm"
              >
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default Table;
