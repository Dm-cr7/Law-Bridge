/**
 * utils.js
 * ------------------------------------------------------------------
 * Universal utility functions used across the LawBridge frontend.
 * - Tailwind className merging (cn)
 * - String & Date helpers
 * - Object safety utilities
 * - ID & random token generators
 * - Formatting helpers (currency, date)
 * ------------------------------------------------------------------
 */

/* =======================================================
   ✅ Tailwind ClassName Merger
   ------------------------------------------------------- */
export function cn(...classes) {
  return classes
    .flat(Infinity)
    .filter(Boolean)
    .join(" ");
}

/* =======================================================
   ✅ String Helpers
   ------------------------------------------------------- */
export function capitalize(str = "") {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function truncate(str = "", length = 100) {
  if (!str) return "";
  return str.length > length ? str.slice(0, length) + "..." : str;
}

/* =======================================================
   ✅ Date Helpers
   ------------------------------------------------------- */
export function formatDate(date, opts = {}) {
  if (!date) return "—";
  try {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      ...opts,
    });
  } catch {
    return "Invalid date";
  }
}

export function timeAgo(date) {
  if (!date) return "";
  const seconds = Math.floor((Date.now() - new Date(date)) / 1000);
  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60,
  };

  for (const [key, value] of Object.entries(intervals)) {
    const count = Math.floor(seconds / value);
    if (count >= 1) return `${count} ${key}${count > 1 ? "s" : ""} ago`;
  }
  return "just now";
}

/* =======================================================
   ✅ Object & Validation Utilities
   ------------------------------------------------------- */
export function isEmpty(obj) {
  return !obj || Object.keys(obj).length === 0;
}

export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export function safeGet(obj, path, fallback = undefined) {
  try {
    return path.split(".").reduce((acc, key) => acc && acc[key], obj) ?? fallback;
  } catch {
    return fallback;
  }
}

/* =======================================================
   ✅ ID & Token Generators
   ------------------------------------------------------- */
export function generateId(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
}

export function randomToken(length = 32) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join("");
}

/* =======================================================
   ✅ Formatting Helpers
   ------------------------------------------------------- */
export function formatCurrency(amount, currency = "USD") {
  if (isNaN(amount)) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

export function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

/* =======================================================
   ✅ Async Helpers
   ------------------------------------------------------- */
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function tryCatch(promise) {
  try {
    const data = await promise;
    return [data, null];
  } catch (error) {
    return [null, error];
  }
}
