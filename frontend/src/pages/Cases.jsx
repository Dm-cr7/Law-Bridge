// frontend/src/pages/Cases.jsx
/**
 * Cases.jsx — extended
 * ------------------------------------------------------------
 * Adds:
 *  - Edit case (opens NewCaseModal in edit mode via initialData)
 *  - Pause / Resume (PATCH /api/cases/:id/status { status: 'paused' | ... })
 *  - Mark resolved (PATCH /api/cases/:id/status { status: 'resolved' })
 *  - Delete (soft) (DELETE /api/cases/:id)
 *  - UI badges: status, hearings count, attachments count, lastActivity
 *  - Optimistic UI with rollback on failure
 *
 * Notes for backend:
 *  - Ensure PATCH /api/cases/:id/status exists and accepts { status }
 *  - Ensure PUT /api/cases/:id exists to update case fields
 *  - Soft delete uses DELETE /api/cases/:id (your case routes have this)
 * ------------------------------------------------------------
 */

import React, { useEffect, useState, useCallback, useRef } from "react";
import { Plus, FileDown, RefreshCw, Edit2, Pause, Play, Trash2, Check } from "lucide-react";
import toast from "react-hot-toast";
import API from "@/utils/api";
import { useAuth } from "@/context/AuthContext";
import { socket } from "@/utils/socket"; // ensure exported

// UI components / modals
import NewCaseModal from "@/components/NewCaseModal";
import ShareCaseModal from "@/components/ShareCaseModal";
import CaseCard from "@/components/CaseCard";
import SkeletonLoader from "@/components/ui/SkeletonLoader";
import CaseTimelineModal from "@/components/CaseTimelineModal";
import AttachEvidenceModal from "@/components/AttachEvidenceModal";

/* ----------------------------- Helpers ----------------------------- */
function parseListResponse(res) {
  if (!res) return { items: [], meta: {} };
  const body = res?.data ?? res;
  if (body && typeof body === "object" && body.data !== undefined) {
    const items = Array.isArray(body.data) ? body.data : body.data.items || body.data || [];
    const meta = body.meta || { total: items.length };
    return { items, meta };
  }
  if (Array.isArray(body)) {
    return { items: body, meta: { total: body.length } };
  }
  if (body && typeof body === "object") {
    const items = body.items || body.data || [];
    return { items: Array.isArray(items) ? items : [], meta: body.meta || { total: items.length } };
  }
  return { items: [], meta: {} };
}

/* ----------------------------- Component --------------------------- */
export default function Cases() {
  const { user, token: authToken } = useAuth() || {};
  const token = authToken || localStorage.getItem("token") || localStorage.getItem("authToken") || null;

  // Data
  const [cases, setCases] = useState([]);
  const [filteredCases, setFilteredCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modals & UI
  const [showNewCaseModal, setShowNewCaseModal] = useState(false);
  const [editCaseData, setEditCaseData] = useState(null); // when set -> open NewCaseModal in edit mode
  const [shareCase, setShareCase] = useState(null);
  const [timelineCase, setTimelineCase] = useState(null);
  const [attachCase, setAttachCase] = useState(null);

  // Filters / search / pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [page, setPage] = useState(1);
  const [limit] = useState(24);
  const totalRef = useRef(0);
  const searchRef = useRef(null);
  const fetchCtrlRef = useRef(null);

  /* --------------------------- fetchCases --------------------------- */
  const fetchCases = useCallback(
    async ({ p = 1, q = "", category = "All", status = "All" } = {}) => {
      if (fetchCtrlRef.current) {
        try { fetchCtrlRef.current.abort(); } catch (_) {}
      }
      const ctrl = new AbortController();
      fetchCtrlRef.current = ctrl;

      setLoading(true);
      setError(null);
      try {
        const params = { page: p, limit };
        if (user?.role === "advocate") params.mine = true;
        if (category && category !== "All") params.category = category.toLowerCase();
        if (status && status !== "All") params.status = status.toLowerCase();
        if (q) params.q = q;

        const res = await API.get("/cases", { params, signal: ctrl.signal });
        const { items, meta } = parseListResponse(res);

        totalRef.current = meta?.total ?? (Array.isArray(items) ? items.length : 0);
        setCases(items);
        setFilteredCases(items);
        setPage(p);
      } catch (err) {
        const isAbort = err?.name === "AbortError" || err?.code === "ERR_CANCELED" || err?.message === "canceled";
        if (!isAbort) {
          console.error("❌ Fetch cases error:", err);
          const message = err?.response?.data?.message || err?.message || "Error fetching cases.";
          setError(message);
          toast.error(message);
        }
      } finally {
        setLoading(false);
        fetchCtrlRef.current = null;
      }
    },
    [user, limit]
  );

  useEffect(() => {
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => {
      fetchCases({ p: 1, q: searchQuery, category: filterCategory, status: filterStatus });
    }, 300);
    return () => { if (searchRef.current) clearTimeout(searchRef.current); };
  }, [searchQuery, filterCategory, filterStatus, fetchCases]);

  /* ------------------------- socket realtime ------------------------ */
  useEffect(() => {
    if (!user || !socket) return;

    const tryJoin = () => {
      try { socket.emit("joinRoom", `user_${String(user._id)}`); } catch {}
    };
    if (socket.connected) tryJoin();
    socket.on("connect", tryJoin);

    fetchCases({ p: 1 });

    const onNew = (newCase) => {
      try {
        const isVisible =
          String(newCase?.filedBy?._id || newCase?.filedBy) === String(user?._id) ||
          (Array.isArray(newCase?.sharedWith) && newCase.sharedWith.some((s) => String(s._id || s) === String(user?._id))) ||
          user?.role === "admin";
        if (isVisible) {
          setCases((prev) => [newCase, ...prev]);
          setFilteredCases((prev) => [newCase, ...prev]);
          toast.success(`🆕 New case: ${newCase.title || "Case created"}`);
        }
      } catch (e) { console.warn("case:new handler error", e); }
    };

    const onUpdate = (updated) => {
      setCases((prev) => prev.map((c) => (c._id === updated._id ? updated : c)));
      setFilteredCases((prev) => prev.map((c) => (c._id === updated._id ? updated : c)));
    };

    const onStatus = ({ caseId, status }) => {
      setCases((prev) => prev.map((c) => (c._id === caseId ? { ...c, status } : c)));
      setFilteredCases((prev) => prev.map((c) => (c._id === caseId ? { ...c, status } : c)));
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
      setFilteredCases((prev) => prev.map((c) => (c._id === caseId ? { ...c, sharedWith } : c)));
    };

    socket.on("case:new", onNew);
    socket.on("case:updated", onUpdate);
    socket.on("case:status", onStatus);
    socket.on("case:deleted", onDeleted);
    socket.on("case:restored", onRestored);
    socket.on("case:shared", onShared);

    return () => {
      try {
        socket.off("connect", tryJoin);
        socket.off("case:new", onNew);
        socket.off("case:updated", onUpdate);
        socket.off("case:status", onStatus);
        socket.off("case:deleted", onDeleted);
        socket.off("case:restored", onRestored);
        socket.off("case:shared", onShared);
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, fetchCases]);

  /* -------------------------- local handlers ------------------------- */
  const handleCaseCreated = (newCaseObj) => {
    const created = newCaseObj?.data ?? newCaseObj;
    setCases((prev) => [created, ...prev]);
    setFilteredCases((prev) => [created, ...prev]);
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
    const isOwner = String(caseData.filedBy?._id || "") === String(user?._id || "");
    if (!isOwner && user?.role !== "admin") {
      toast.error("Only the case owner or an admin can share this case.");
      return;
    }
    setShareCase(caseData);
  };

  /* ------------------------- Case actions --------------------------- */

  // Open edit modal (assumes NewCaseModal supports initialData + mode="edit")
  const openEdit = (c) => {
    setEditCaseData(c);
    setShowNewCaseModal(true);
    // NewCaseModal should detect editCaseData and mode accordingly
  };

  // Soft delete case
  const deleteCase = async (c) => {
    if (!confirm(`Are you sure you want to delete case "${c.title}"? This is a soft delete.`)) return;
    const before = cases.slice();
    setCases((prev) => prev.filter((x) => x._id !== c._id));
    setFilteredCases((prev) => prev.filter((x) => x._id !== c._id));
    try {
      await API.delete(`/cases/${c._id}`);
      toast.success("Case deleted");
      // emit socket if available
      try { socket?.emit("case:deleted", { caseId: c._id }); } catch {}
    } catch (err) {
      console.error("Delete failed:", err);
      setCases(before);
      setFilteredCases(before);
      toast.error(err?.response?.data?.message || "Failed to delete case");
    }
  };

  // Pause (set status 'paused') or Resume (set status 'filed')
  const togglePause = async (c) => {
    // using 'paused' as status — backend must accept this; otherwise map to available status
    const willPause = c.status !== "paused";
    const target = willPause ? "paused" : "filed"; // resume -> filed (fallback)
    const prev = c;
    const updated = { ...c, status: target };
    setCases((prevList) => prevList.map((x) => (x._id === c._id ? updated : x)));
    setFilteredCases((prevList) => prevList.map((x) => (x._id === c._id ? updated : x)));
    try {
      await API.patch(`/cases/${c._id}/status`, { status: target });
      toast.success(willPause ? "Case paused" : "Case resumed");
      try { socket?.emit("case:status", { caseId: c._id, status: target }); } catch {}
    } catch (err) {
      console.error("Pause/resume failed:", err);
      // rollback
      setCases((prevList) => prevList.map((x) => (x._id === c._id ? prev : x)));
      setFilteredCases((prevList) => prevList.map((x) => (x._id === c._id ? prev : x)));
      toast.error(err?.response?.data?.message || "Failed to change case status");
    }
  };

  // Mark resolved / successful
  const markResolved = async (c) => {
    if (!confirm(`Mark case "${c.title}" as resolved/closed?`)) return;
    const prev = c;
    const updated = { ...c, status: "resolved" };
    setCases((prevList) => prevList.map((x) => (x._id === c._id ? updated : x)));
    setFilteredCases((prevList) => prevList.map((x) => (x._id === c._id ? updated : x)));
    try {
      await API.patch(`/cases/${c._id}/status`, { status: "resolved" });
      toast.success("Case marked resolved");
      try { socket?.emit("case:status", { caseId: c._id, status: "resolved" }); } catch {}
    } catch (err) {
      console.error("Mark resolved failed:", err);
      setCases((prevList) => prevList.map((x) => (x._id === c._id ? prev : x)));
      setFilteredCases((prevList) => prevList.map((x) => (x._id === c._id ? prev : x)));
      toast.error(err?.response?.data?.message || "Failed to resolve case");
    }
  };

  // Edit submit handler — used when NewCaseModal returns created/updated case
  const onEditSuccess = (serverResponse) => {
    const updated = serverResponse?.data ?? serverResponse;
    if (!updated) return;
    handleCaseUpdatedLocal(updated);
    setEditCaseData(null);
    setShowNewCaseModal(false);
    toast.success("Case updated");
  };

  /* ------------------------- export CSV ---------------------------- */
  const handleExportCases = async () => {
    try {
      const res = await API.get("/reports/export?type=cases&format=csv", { responseType: "blob" });
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
      toast.error(err?.response?.data?.message || err?.message || "Export failed");
    }
  };

  /* ------------------------- pagination helpers --------------------- */
  const totalPages = Math.max(1, Math.ceil((totalRef.current || cases.length) / limit));
  const goNext = () => {
    if (page < totalPages) fetchCases({ p: page + 1, q: searchQuery, category: filterCategory, status: filterStatus });
  };
  const goPrev = () => {
    if (page > 1) fetchCases({ p: page - 1, q: searchQuery, category: filterCategory, status: filterStatus });
  };

  /* ----------------------------- render ---------------------------- */
  return (
    <div style={styles.page}>
      {/* New Case modal (create) */}
      <NewCaseModal
        isOpen={showNewCaseModal && !editCaseData}
        onClose={() => {
          setShowNewCaseModal(false);
          setEditCaseData(null);
        }}
        onSuccess={(created) => {
          const createdObj = created?.data ?? created;
          handleCaseCreated(createdObj);
          setShowNewCaseModal(false);
        }}
      />

      {/* Edit Case modal (re-use NewCaseModal in edit mode) */}
      {editCaseData && (
        <NewCaseModal
          isOpen={!!editCaseData}
          initialData={editCaseData}
          mode="edit"
          onClose={() => {
            setShowNewCaseModal(false);
            setEditCaseData(null);
          }}
          onSuccess={onEditSuccess}
        />
      )}

      {/* Share modal */}
      {shareCase && <ShareCaseModal caseData={shareCase} onClose={() => setShareCase(null)} onShared={handleCaseUpdatedLocal} />}

      {/* Timeline */}
      {timelineCase && <CaseTimelineModal caseData={timelineCase} onClose={() => setTimelineCase(null)} />}

      {/* Attach evidence */}
      {attachCase && <AttachEvidenceModal caseData={attachCase} onClose={() => setAttachCase(null)} onUpdated={handleCaseUpdatedLocal} />}

      {/* Header */}
      <header style={styles.header}>
        <div>
          <h1 style={styles.heading}>Case Management</h1>
          <p style={styles.subtext}>Create, update, and manage cases. Realtime updates and role-based access.</p>
        </div>

        <div style={styles.headerActions}>
          <button
            style={styles.iconBtn}
            onClick={() => fetchCases({ p: 1, q: searchQuery, category: filterCategory, status: filterStatus })}
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>

          <button style={styles.iconBtn} onClick={handleExportCases} title="Export CSV">
            <FileDown size={16} />
          </button>

          <button
            style={styles.newBtn}
            onClick={() => {
              setEditCaseData(null);
              setShowNewCaseModal(true);
            }}
            title="Create new case"
          >
            <Plus size={18} style={{ marginRight: 8 }} />
            New Case
          </button>
        </div>
      </header>

      {/* Filters */}
      <div style={styles.filterBar}>
        <input type="text" placeholder="Search by title..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={styles.searchInput} />

        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} style={styles.select}>
          <option>All</option>
          <option value="civil">Civil</option>
          <option value="criminal">Criminal</option>
          <option value="adr">ADR</option>
          <option value="other">Other</option>
        </select>

        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={styles.select}>
          <option>All</option>
          <option value="filed">Filed</option>
          <option value="under_review">Under Review</option>
          <option value="hearing_scheduled">Hearing Scheduled</option>
          <option value="hearing_in_progress">Hearing (In Progress)</option>
          <option value="award_issued">Award Issued</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
          <option value="paused">Paused</option>
        </select>
      </div>

      {/* Content */}
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
              <div key={c._id} style={styles.cardWrapper}>
                <CaseCard
                  c={c}
                  user={user}
                  onShare={() => handleShareClick(c)}
                  onUpdated={handleCaseUpdatedLocal}
                  onDeleted={() => handleCaseDeletedLocal(c._id)}
                  onTimeline={() => setTimelineCase(c)}
                  onAttach={() => setAttachCase(c)}
                />

                {/* Inline action bar (edit / pause / resolve / delete) */}
                <div style={styles.cardActions}>
                  {/* status badge + meta */}
                  <div style={styles.meta}>
                    <span style={{ ...styles.badge, ...(badgeColor(c.status) || {}) }}>{formatStatusLabel(c.status)}</span>
                    <span style={styles.metaItem}>📅 {Array.isArray(c.hearings) ? c.hearings.length : (c.hearings ? c.hearings.length : 0)} hearings</span>
                    <span style={styles.metaItem}>📎 {Array.isArray(c.attachments) ? c.attachments.length : (c.attachments ? c.attachments.length : 0)} attachments</span>
                    {c.metrics?.lastActivityAt && <span style={styles.metaItem}>⏱ {new Date(c.metrics.lastActivityAt).toLocaleString()}</span>}
                  </div>

                  <div style={styles.actionsRow}>
                    <button title="Edit" onClick={() => openEdit(c)} style={styles.actionBtn}>
                      <Edit2 size={14} /> Edit
                    </button>

                    <button
                      title={c.status === "paused" ? "Resume" : "Pause"}
                      onClick={() => togglePause(c)}
                      style={styles.actionBtn}
                    >
                      {c.status === "paused" ? <Play size={14} /> : <Pause size={14} />} {c.status === "paused" ? "Resume" : "Pause"}
                    </button>

                    <button title="Mark resolved" onClick={() => markResolved(c)} style={styles.actionBtn}>
                      <Check size={14} /> Resolve
                    </button>

                    <button title="Delete" onClick={() => deleteCase(c)} style={styles.deleteBtn}>
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

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

/* ----------------------------- Utilities --------------------------- */
function formatStatusLabel(status) {
  if (!status) return "unknown";
  switch (status) {
    case "filed":
      return "Filed";
    case "under_review":
      return "Under review";
    case "hearing_scheduled":
      return "Hearing scheduled";
    case "hearing_in_progress":
      return "Hearing (in progress)";
    case "award_issued":
      return "Award issued";
    case "resolved":
      return "Resolved";
    case "closed":
      return "Closed";
    case "paused":
      return "Paused";
    default:
      return status;
  }
}

function badgeColor(status) {
  switch (status) {
    case "filed":
      return { backgroundColor: "#eff6ff", color: "#1e40af" };
    case "under_review":
      return { backgroundColor: "#fffbeb", color: "#92400e" };
    case "hearing_scheduled":
      return { backgroundColor: "#ecfeff", color: "#006d6d" };
    case "hearing_in_progress":
      return { backgroundColor: "#fff7ed", color: "#92400e" };
    case "award_issued":
      return { backgroundColor: "#ecfccb", color: "#365314" };
    case "resolved":
      return { backgroundColor: "#ecfccb", color: "#065f46" };
    case "closed":
      return { backgroundColor: "#f3f4f6", color: "#374151" };
    case "paused":
      return { backgroundColor: "#fff1f2", color: "#9f1239" };
    default:
      return { backgroundColor: "#f8fafc", color: "#0f172a" };
  }
}

/* ----------------------------- Styles ----------------------------- */
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
  cardWrapper: { display: "flex", flexDirection: "column", gap: 8, background: "white", borderRadius: 8, padding: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" },
  cardActions: { marginTop: 8, display: "flex", flexDirection: "column", gap: 8 },
  meta: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" },
  badge: { padding: "0.25rem 0.5rem", borderRadius: 8, fontSize: 12, fontWeight: 600 },
  metaItem: { fontSize: 12, color: "#475569" },
  actionsRow: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 },
  actionBtn: {
    display: "inline-flex",
    gap: 6,
    alignItems: "center",
    padding: "0.35rem 0.6rem",
    borderRadius: 6,
    border: "1px solid #e5e7eb",
    background: "#fff",
    cursor: "pointer",
    fontSize: 13,
  },
  deleteBtn: {
    display: "inline-flex",
    gap: 6,
    alignItems: "center",
    padding: "0.35rem 0.6rem",
    borderRadius: 6,
    border: "1px solid #fee2e2",
    background: "#fff",
    color: "#b91c1c",
    cursor: "pointer",
    fontSize: 13,
  },
  emptyBox: { textAlign: "center", color: "#64748b", padding: "2rem", background: "#f8fafc", borderRadius: "8px" },
  errorBox: { color: "#b91c1c", textAlign: "center", padding: "1rem" },
  pagination: { marginTop: "1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center" },
  pageBtn: { padding: "0.4rem 0.75rem", borderRadius: 6, border: "1px solid #cbd5e1", background: "white", cursor: "pointer" },
};
