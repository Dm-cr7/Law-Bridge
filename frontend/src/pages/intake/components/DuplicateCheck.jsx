// frontend/src/pages/intake/components/DuplicateCheck.jsx
import React, { useEffect, useState, useRef, useCallback } from "react";
import PropTypes from "prop-types";
import API from "@/utils/api";
import { toast } from "sonner";
import { Search, ExternalLink, X } from "lucide-react";

/**
 * DuplicateCheck.jsx
 *
 * Small, focused component that queries the backend for possible duplicate clients
 * based on a user-supplied query string (email, phone, name fragment).
 *
 * Features
 * - Debounced queries to `/clients?q=...&limit=...`
 * - Shows loading / empty / error states
 * - Presents clickable results with "Open" link and "Select" button
 * - Calls onSelect(client) when user picks a client (caller decides what to do)
 * - Exposes a manual refresh button
 *
 * Usage:
 * <DuplicateCheck
 *    query={emailOrPhone}
 *    minQueryLength={3}
 *    onSelect={(client) => { /* open or prefill form */ 
export default function DuplicateCheck({
  query,
  minQueryLength = 3,
  debounceMs = 600,
  limit = 5,
  autoShow = true,
  onSelect = () => {},
  showOpenLink = true,
}) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);
  const lastQueryRef = useRef("");

  const fetchMatches = useCallback(
    async (q) => {
      if (!q || q.length < minQueryLength) {
        setResults([]);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const res = await API.get(`/clients?q=${encodeURIComponent(q)}&limit=${limit}`);
        const data = Array.isArray(res.data) ? res.data : res.data?.items || res.data || [];
        setResults(data || []);
      } catch (err) {
        console.error("Duplicate fetch error:", err);
        setError(err?.response?.data?.message || "Failed to fetch duplicates");
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [limit, minQueryLength]
  );

  useEffect(() => {
    // debounce queries
    if (timerRef.current) clearTimeout(timerRef.current);
    const q = (query || "").trim();
    lastQueryRef.current = q;

    if (!q || q.length < minQueryLength) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }

    timerRef.current = setTimeout(() => {
      // guard against stale queries
      if (lastQueryRef.current !== q) return;
      fetchMatches(q);
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, debounceMs, fetchMatches, minQueryLength]);

  const handleSelect = (client) => {
    try {
      onSelect(client);
    } catch (err) {
      console.error("onSelect handler error:", err);
      toast.error("Action failed");
    }
  };

  const handleRefresh = () => {
    const q = (query || "").trim();
    if (!q || q.length < minQueryLength) {
      toast.error(`Enter at least ${minQueryLength} characters to search`);
      return;
    }
    fetchMatches(q);
  };

  // Minimal inline UI
  return (
    <div className="duplicate-check text-sm">
      <div className="flex items-center gap-2 mb-2">
        <div className="flex items-center gap-2 px-2 py-1 rounded bg-gray-50 border border-gray-200">
          <Search size={14} />
          <div className="text-xs text-gray-600">
            {loading ? "Searching for duplicates…" : results.length ? `${results.length} possible match(es)` : "No matches"}
          </div>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          className="ml-auto text-xs px-2 py-1 rounded bg-white border border-gray-200 hover:shadow"
          title="Refresh"
        >
          Refresh
        </button>
      </div>

      <div className="bg-white border border-gray-100 rounded">
        {error ? (
          <div className="p-3 text-xs text-red-600">{error}</div>
        ) : loading ? (
          <div className="p-3 text-xs text-gray-500">Looking up possible duplicates…</div>
        ) : !results || results.length === 0 ? (
          autoShow ? <div className="p-3 text-xs text-gray-500">No similar clients found.</div> : null
        ) : (
          <ul className="divide-y">
            {results.map((c) => (
              <li key={c._id} className="p-3 flex items-start justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-medium truncate">{(c.firstName || c.name || "") + (c.lastName ? ` ${c.lastName}` : "")}</div>
                    <div className="text-xs text-gray-500 truncate"> {c.email || c.primaryPhone || c.phone || ""}</div>
                  </div>
                  {c.address?.line1 && <div className="text-xs text-gray-400 mt-1 truncate">{c.address.line1}</div>}
                </div>

                <div className="flex items-center gap-2 ml-3">
                  <button
                    type="button"
                    onClick={() => handleSelect(c)}
                    className="px-2 py-1 text-xs bg-blue-600 text-white rounded"
                    title="Select this client"
                  >
                    Select
                  </button>

                  {showOpenLink && (
                    <a
                      href={`/dashboard/clients/${c._id}`}
                      title="Open client"
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                    >
                      Open <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

DuplicateCheck.propTypes = {
  query: PropTypes.string,
  minQueryLength: PropTypes.number,
  debounceMs: PropTypes.number,
  limit: PropTypes.number,
  autoShow: PropTypes.bool,
  onSelect: PropTypes.func,
  showOpenLink: PropTypes.bool,
};
