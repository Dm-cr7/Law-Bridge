import React, { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

/**
 * A fully accessible, modern Select component for TailwindCSS + React.
 * Usage:
 *  <Select value={role} onChange={setRole}>
 *    <SelectTrigger placeholder="Choose a role" />
 *    <SelectContent>
 *      <SelectItem value="admin">Admin</SelectItem>
 *      <SelectItem value="judge">Judge</SelectItem>
 *      <SelectItem value="advocate">Advocate</SelectItem>
 *    </SelectContent>
 *  </Select>
 */

export const Select = ({ value, onChange, children }) => {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);

  const toggle = () => setOpen((prev) => !prev);
  const close = () => setOpen(false);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target)) {
        close();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Context for children
  return (
    <div className="relative inline-block w-full" ref={triggerRef}>
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return null;
        return React.cloneElement(child, {
          open,
          toggle,
          close,
          value,
          onChange,
        });
      })}
    </div>
  );
};

// ────────────────────────────────────────────────
// Trigger
export const SelectTrigger = ({ open, toggle, placeholder, value }) => {
  return (
    <button
      type="button"
      onClick={toggle}
      className={`flex w-full items-center justify-between rounded-xl border border-black-300 bg-white px-4 py-2 text-left shadow-sm transition-all hover:border-black-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
        open ? "ring-2 ring-blue-500" : ""
      }`}
    >
      <span className="truncate text-black-700">
        {value ? value : placeholder || "Select..."}
      </span>
      <ChevronDown
        className={`h-4 w-4 text-black-500 transition-transform ${
          open ? "rotate-180" : ""
        }`}
      />
    </button>
  );
};

// ────────────────────────────────────────────────
// Content
export const SelectContent = ({ open, children }) => {
  if (!open) return null;

  return (
    <div
      className="absolute z-50 mt-2 w-full rounded-xl border border-black-200 bg-white shadow-lg animate-in fade-in slide-in-from-top-2"
      role="listbox"
    >
      <div className="max-h-60 overflow-y-auto py-2">{children}</div>
    </div>
  );
};

// ────────────────────────────────────────────────
// Item
export const SelectItem = ({ value, onChange, close, children }) => {
  const handleSelect = () => {
    onChange(value);
    close();
  };

  return (
    <div
      onClick={handleSelect}
      role="option"
      className="cursor-pointer select-none px-4 py-2 text-sm text-black-700 hover:bg-blue-50 hover:text-blue-600 transition-all"
    >
      {children}
    </div>
  );
};

// ────────────────────────────────────────────────
// Value (for compatibility)
export const SelectValue = ({ value }) => (
  <span className="truncate">{value}</span>
);

export default Select;
