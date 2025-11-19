/**
 * frontend/src/pages/Cases.jsx
 * ------------------------------------------------------------
 * Cases — production-ready, role-aware case management page
 * Supports: listing, search, filters, pagination, realtime sync,
 * exports, create/share/attach/timeline modals, and owner checks.
 * ------------------------------------------------------------
 */

import React, { useEffect, useState, useCallback, useRef } from "react";
import { Plus, FileDown, RefreshCw } from "lucide-react";
import { toast } from "react-hot-toast";
import API from "../api/axios"; // axios instance (optional auth header handled globally)
import { useAuth } from "../context/AuthContext";
import { socket } from "../utils/socket";

// UI components / modals
import NewCaseModal from "../components/NewCaseModal";
import ShareCaseModal from "../components/ShareCaseModal";
import CaseCard from "../components/CaseCard";
import SkeletonLoader from "../components/ui/SkeletonLoader";
import CaseTimelineModal from "../components/CaseTimelineModal";
import AttachEvidenceModal from "../components/AttachEvidenceModal";

export default function Cases() {
  const { user, token } = useAuth();

  // data
  const [cases, setCases] = useState([]);
  const [filteredCases, setFilteredCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // UI state
  const [showNewCaseModal, setShowNewCaseModal] = useState(false);
  const [shareCase, setShareCase] = useState(null);
  const [timelineCase, setTimelineCase] = useState(null);
  const [attachCase, setAttachCase] = useState(null);

  // filters / search / pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [page, setPage] = useState(1);
  const [limit] = useState(24);
  const totalRef = useRef(0);

  // small debounce for search
  const searchRef = useRef(null);

  /* =======================================================
     Fetch Cases — uses backend to return accessible cases
     Supports query params: ?page=&limit=&mine=true (optional)
  ======================================================= */
  const fetchCases = useCallback(
    async ({ p = page, q = searchQuery, category = filterCategory, status = filterStatus } = {}) => {
      if (!token) return;
      setLoading(true);
      setError(null);

      try {
        const params = {
          page: p,
          limit,
        };

        // If advocates want to see only their own cases we can pass mine=true
        // For admins, fetch all
        if (user?.role === "advocate") params.mine = true;

        // Apply server-side filters if backend supports them (safer/perf)
        if (category && category !== "All") params.category = category.toLowerCase();
        if (status && status !== "All") params.status = status.toLowerCase();
        if (q) params.q = q;

        const res = await API.get("/cases", {
          headers: { Authorization: token ? `Bearer ${token}` : undefined },
          params,
        });

        // backend returns either array or { items, total }
        const payload = res.data || [];
        let items = [];
        let total = 0;

        if (Array.isArray(payload)) {
          items = payload;
          total = payload.length;
        } else {
          items = payload.items || payload.data || [];
          total = payload.total || items.length;
        }

        totalRef.current = total;
        setCases(items);
        setFilteredCases(items);
        setPage(p);
      } catch (err) {
        console.error("❌ Fetch cases error:", err);
        const message = err?.response?.data?.message || "Error fetching cases.";
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    },
    [token, user, limit, page, searchQuery, filterCategory, filterStatus]
  );

  /* =======================================================
     Filters & Search (client-side refinements for speed)
  ======================================================= */
  useEffect(() => {
    // client-side debounce for search typing
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => {
      // Re-fetch from server to allow server-side searches
      fetchCases({ p: 1, q: searchQuery, category: filterCategory, status: filterStatus });
    }, 300);

    return () => clearTimeout(searchRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, filterCategory, filterStatus, fetchCases]);

  /* =======================================================
     Socket.IO realtime sync
  ======================================================= */
  useEffect(() => {
    if (!user || !token || !socket) return;

    // join personal room to receive private updates from server
    socket.on("connect", () => {
      try {
        socket.emit("joinRoom", user._id?.toString());
      } catch {}
    });

    // initial fetch
    fetchCases({ p: 1 });

    const onNew = (newCase) => {
      // only add if user should see it (backend may already filter, but double-check)
      const isVisible =
        newCase.filedBy?._id === user._id ||
        (newCase.sharedWith || []).some((s) => s._id === user._id) ||
        user.role === "admin";
      if (isVisible) {
        setCases((prev) => [newCase, ...prev]);
        setFilteredCases((prev) => [newCase, ...prev]);
        toast.success(`🆕 New case: ${newCase.title}`);
      }
    };

    const onUpdate = (updated) => {
      setCases((prev) => prev.map((c) => (c._id === updated._id ? updated : c)));
      setFilteredCases((prev) => prev.map((c) => (c._id === updated._id ? updated : c)));
    };

    const onStatus = ({ caseId, status }) => {
      setCases((prev) => prev.map((c) => (c._id === caseId ? { ...c, status } : c)));
    };

    const onDeleted = ({ caseId }) => {
      setCases((prev) => prev.filter((c) => c._id !== caseId));
      setFilteredCases((prev) => prev.filter((c) => c._id !== caseId));
    };

    const onRestored = (restored) => {
      setCases((prev) => [restored, ...prev]);
      setFilteredCases((prev) => [restored, ...prev]);
    };

    const onShared = ({ caseId, sharedWith }) => {
      setCases((prev) => prev.map((c) => (c._id === caseId ? { ...c, sharedWith } : c)));
    };

    socket.on("case:new", onNew);
    socket.on("case:update", onUpdate);
    socket.on("case:statusUpdate", onStatus);
    socket.on("case:deleted", onDeleted);
    socket.on("case:restored", onRestored);
    socket.on("case:shared", onShared);

    return () => {
      socket.off("case:new", onNew);
      socket.off("case:update", onUpdate);
      socket.off("case:statusUpdate", onStatus);
      socket.off("case:deleted", onDeleted);
      socket.off("case:restored", onRestored);
      socket.off("case:shared", onShared);
    };
  }, [user, token, fetchCases]);

  /* =======================================================
     Local handlers (used by child components)
  ======================================================= */
  const handleCaseCreated = (newCase) => {
    setCases((prev) => [newCase, ...prev]);
    setFilteredCases((prev) => [newCase, ...prev]);
  };

  const handleCaseUpdatedLocal = (updated) => {
    setCases((prev) => prev.map((c) => (c._id === updated._id ? updated : c)));
    setFilteredCases((prev) => prev.map((c) => (c._id === updated._id ? updated : c)));
  };

  const handleCaseDeletedLocal = (deletedId) => {
    setCases((prev) => prev.filter((c) => c._id !== deletedId));
    setFilteredCases((prev) => prev.filter((c) => c._id !== deletedId));
  };

  const handleShareClick = (caseData) => {
    // only owner or admin can share - UI guard (backend enforces)
    const isOwner = String(caseData.filedBy?._id || "") === String(user?._id || "");
    if (!isOwner && user.role !== "admin") {
      toast.error("Only the case owner or an admin can share this case.");
      return;
    }
    setShareCase(caseData);
  };

  /* =======================================================
     Export CSV (server-side)
  ======================================================= */
  const handleExportCases = async () => {
    try {
      const res = await API.get("/reports/export?type=cases&format=csv", {
        headers: { Authorization: token ? `Bearer ${token}` : undefined },
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cases_${user?.name || "cases"}_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("📁 Cases exported!");
    } catch (err) {
      console.error("❌ Export failed", err);
      toast.error(err?.response?.data?.message || "Export failed");
    }
  };

  /* =======================================================
     Pagination helpers
  ======================================================= */
  const totalPages = Math.max(1, Math.ceil((totalRef.current || cases.length) / limit));
  const goNext = () => {
    if (page < totalPages) fetchCases({ p: page + 1 });
  };
  const goPrev = () => {
    if (page > 1) fetchCases({ p: page - 1 });
  };

  /* =======================================================
     Render
  ======================================================= */
  return (
    <div style={styles.page}>
      {/* Modals */}
      <NewCaseModal
        isOpen={showNewCaseModal}
        onClose={() => setShowNewCaseModal(false)}
        onCreated={handleCaseCreated}
      />

      {shareCase && (
        <ShareCaseModal
          caseData={shareCase}
          onClose={() => setShareCase(null)}
          onShared={handleCaseUpdatedLocal}
        />
      )}

      {timelineCase && (
        <CaseTimelineModal caseData={timelineCase} onClose={() => setTimelineCase(null)} />
      )}

      {attachCase && (
        <AttachEvidenceModal caseData={attachCase} onClose={() => setAttachCase(null)} onUpdated={handleCaseUpdatedLocal} />
      )}

      {/* Header */}
      <header style={styles.header}>
        <div>
          <h1 style={styles.heading}>Case Management</h1>
          <p style={styles.subtext}>
            Create, update, and manage cases. Realtime updates and role-based access.
          </p>
        </div>

        <div style={styles.headerActions}>
          <button style={styles.iconBtn} onClick={() => fetchCases({ p: 1 })} title="Refresh">
            <RefreshCw size={16} />
          </button>
          <button style={styles.iconBtn} onClick={handleExportCases} title="Export CSV">
            <FileDown size={16} />
          </button>

          <button
            style={styles.newBtn}
            onClick={() => setShowNewCaseModal(true)}
            title="Create new case"
          >
            <Plus size={18} style={{ marginRight: 8 }} /> New Case
          </button>
        </div>
      </header>

      {/* Filters */}
      <div style={styles.filterBar}>
        <input
          type="text"
          placeholder="Search by title..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={styles.searchInput}
        />

        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} style={styles.select}>
          <option>All</option>
          <option value="civil">Civil</option>
          <option value="criminal">Criminal</option>
          <option value="adr">ADR</option>
          <option value="other">Other</option>
        </select>

        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={styles.select}>
          <option>All</option>
          {/* map to your case statuses — keep labels friendly */}
          <option value="filed">Filed</option>
          <option value="under_review">Under Review</option>
          <option value="hearing_scheduled">Hearing Scheduled</option>
          <option value="hearing_in_progress">Hearing (In Progress)</option>
          <option value="award_issued">Award Issued</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {/* Cases grid */}
      {loading ? (
        <SkeletonLoader />
      ) : error ? (
        <div style={styles.errorBox}>{error}</div>
      ) : cases.length === 0 ? (
        <div style={styles.emptyBox}>No cases found.</div>
      ) : (
        <>
          <div style={styles.grid}>
            {filteredCases.map((c) => (
              <CaseCard
                key={c._id}
                c={c}
                user={user}
                onShare={() => handleShareClick(c)}
                onUpdated={handleCaseUpdatedLocal}
                onDeleted={handleCaseDeletedLocal}
                onTimeline={() => setTimelineCase(c)}
                onAttach={() => setAttachCase(c)}
              />
            ))}
          </div>

          {/* Pagination */}
          <div style={styles.pagination}>
            <div>
              Page {page} / {totalPages}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={goPrev} disabled={page <= 1} style={styles.pageBtn}>
                Prev
              </button>
              <button onClick={goNext} disabled={page >= totalPages} style={styles.pageBtn}>
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* =======================================================
   Styles (inline to match existing project)
   ======================================================= */
const styles = {
  page: {
    padding: "2rem",
    backgroundColor: "#f0f9ff",
    minHeight: "100vh",
    fontFamily: "Inter, sans-serif",
    color: "#0f172a",
  },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" },
  heading: { fontSize: "1.8rem", fontWeight: 700 },
  subtext: { fontSize: "0.9rem", color: "#475569" },
  headerActions: { display: "flex", gap: "0.75rem", alignItems: "center" },
  newBtn: {
    display: "flex",
    alignItems: "center",
    backgroundColor: "#3b82f6",
    color: "white",
    padding: "0.5rem 1rem",
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
  },
  iconBtn: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f5f9",
    color: "#0f172a",
    padding: "0.5rem",
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
  },
  filterBar: { display: "flex", gap: "0.75rem", marginBottom: "1.5rem", alignItems: "center" },
  searchInput: { flex: 1, padding: "0.5rem 0.75rem", border: "1px solid #cbd5e1", borderRadius: "6px" },
  select: { padding: "0.5rem 0.75rem", border: "1px solid #cbd5e1", borderRadius: "6px", background: "white" },
  grid: { display: "grid", gap: "1.25rem", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))" },
  emptyBox: { textAlign: "center", color: "#64748b", padding: "2rem", background: "#f8fafc", borderRadius: "8px" },
  errorBox: { color: "#b91c1c", textAlign: "center", padding: "1rem" },
  pagination: { marginTop: "1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center" },
  pageBtn: { padding: "0.4rem 0.75rem", borderRadius: 6, border: "1px solid #cbd5e1", background: "white", cursor: "pointer" },
};
