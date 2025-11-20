// frontend/src/pages/HearingsPage.jsx
import React, { lazy, Suspense, useEffect, useState, useCallback, useRef } from "react";
const HearingsCalendar = lazy(() => import("../components/HearingsCalendar.jsx")); // normalized path
import HearingChatPanel from "@/components/hearing/HearingChatPanel.jsx";
import HearingScheduler from "@/components/arbitrator/HearingScheduler";
import { useAuth } from "@/context/AuthContext";
import api from "@/utils/api";
import { io } from "socket.io-client";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { CalendarDays, List, PlusCircle, Trash2, Edit2, X } from "lucide-react";
import { toast } from "sonner";

const SOCKET_ORIGIN = (import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/+$/, "");
const PAGE_LIMIT = 25;

export default function HearingsPage() {
  const { user } = useAuth() || {};
  const [socket, setSocket] = useState(null);

  const [hearings, setHearings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const [selected, setSelected] = useState(null);
  const [showScheduler, setShowScheduler] = useState(false);
  const [editing, setEditing] = useState(false);
  const [noteText, setNoteText] = useState("");

  // refs for abort controllers & stable data
  const controllersRef = useRef([]);
  const hearingsRef = useRef([]);
  hearingsRef.current = hearings;

  // token detection (be resilient to different storage keys)
  const token = typeof window !== "undefined" && (localStorage.getItem("authToken") || localStorage.getItem("token") || sessionStorage.getItem("authToken") || sessionStorage.getItem("token"));

  // ===========================
  // Fetch hearings (page)
  // ===========================
  const fetchHearings = useCallback(
    async (p = 1) => {
      try {
        controllersRef.current.forEach((c) => c.abort?.());
      } catch (e) {}
      const ctrl = new AbortController();
      controllersRef.current = [ctrl];

      setLoading(true);
      try {
        // api baseURL already contains /api
        const res = await api.get("/hearings", {
          params: { page: p, limit: PAGE_LIMIT },
          signal: ctrl.signal,
        });

        // normalise payload shape
        const list = Array.isArray(res.data) ? res.data : res.data?.data ?? [];
        setHearings(list);
        setHasMore(list.length === PAGE_LIMIT);
        setPage(p);
      } catch (err) {
        const isCanceled = err?.code === "ERR_CANCELED" || (err?.message && err.message.toLowerCase().includes("canceled"));
        if (!isCanceled) {
          console.error("Fetch hearings failed", err);
          toast.error("Failed to load hearings");
        }
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // ===========================
  // Socket setup (mount once)
  // ===========================
  useEffect(() => {
    fetchHearings(1);

    const s = io(SOCKET_ORIGIN, {
      transports: ["websocket", "polling"],
      auth: token ? { token } : undefined,
      reconnectionAttempts: 5,
      timeout: 20000,
    });

    s.on("connect", () => {
      if (user && (user._id || user.id)) {
        try {
          s.emit("joinRoom", `user_${user._id || user.id}`);
        } catch {}
      }
    });

    s.on("hearing:new", (h) => {
      setHearings((prev) => {
        const exists = prev.some((x) => String(x._id) === String(h._id));
        if (exists) return prev.map((x) => (String(x._id) === String(h._id) ? h : x));
        return [h, ...prev].sort((a, b) => new Date(b.date || b.start || 0) - new Date(a.date || a.start || 0));
      });
      toast.success(`New hearing scheduled: ${h.title || "Untitled"}`);
    });

    s.on("hearing:update", (h) => {
      setHearings((prev) => prev.map((x) => (String(x._id) === String(h._id) ? h : x)));
      if (selected && String(selected._id) === String(h._id)) setSelected(h);
    });

    s.on("hearing:deleted", ({ _id }) => {
      setHearings((prev) => prev.filter((x) => String(x._id) !== String(_id)));
      if (selected && String(selected._1d) === String(_id)) setSelected(null);
    });

    s.on("connect_error", (err) => {
      console.warn("Socket connect_error:", err?.message || err);
    });

    setSocket(s);

    return () => {
      try {
        s.off("hearing:new");
        s.off("hearing:update");
        s.off("hearing:deleted");
        s.disconnect();
      } catch {}
      controllersRef.current.forEach((c) => c.abort?.());
      controllersRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // ===========================
  // Load single hearing details (robust & 403-aware)
  // ===========================
  const loadHearingDetails = useCallback(
    async (id) => {
      if (!id) {
        setSelected(null);
        return;
      }

      // quick local fallback: if we already have the object in list, use it as summary first
      const local = hearingsRef.current.find((h) => String(h._id) === String(id));
      if (local) {
        setSelected((prev) => ({ ...(prev || {}), ...local, _localSummary: true }));
      } else {
        setSelected(null); // clear while loading
      }

      try {
        const res = await api.get(`/hearings/${id}`);
        const payload = res.data?.data ?? res.data;
        setSelected(payload);
      } catch (err) {
        // Normalize various Axios shapes
        const status = err?.response?.status ?? err?.status ?? (err?.code === "ERR_BAD_REQUEST" ? 400 : undefined);

        if (status === 403) {
          // Not authorized — show friendly message, keep a read-only summary if available
          toast.error("Not authorized to view this hearing");
          // If we already set local summary, keep it; else build a tiny safe summary
          if (!local) {
            setSelected({ _id: id, title: "Private hearing", status: "Private", description: "", _readOnly: true });
          }
          return;
        }

        console.error("Failed to load hearing details", err);
        toast.error("Failed to load hearing details");
      }
    },
    []
  );

  // wrapper used by calendar/list clicks
  const onSelectFromList = (h) => {
    if (!h) return;
    setSelected(h);
    loadHearingDetails(h._id || h.id);
  };

  // ===========================
  // Delete hearing (soft)
  // ===========================
  const handleDelete = async (id) => {
    if (!confirm("Cancel this hearing?")) return;
    const backup = hearingsRef.current;
    setHearings((prev) => prev.filter((x) => String(x._id) !== String(id)));
    if (selected && String(selected._id) === String(id)) setSelected(null);

    try {
      await api.delete(`/hearings/${id}`);
      toast.success("Hearing cancelled");
    } catch (err) {
      console.error("Delete failed", err);
      setHearings(backup);
      toast.error("Failed to cancel hearing");
    }
  };

  // ===========================
  // Update hearing
  // ===========================
  const handleUpdate = async (id, updates) => {
    try {
      const res = await api.put(`/hearings/${id}`, updates);
      const updated = res.data?.data ?? res.data;
      setHearings((prev) => prev.map((h) => (String(h._id) === String(id) ? updated : h)));
      setSelected(updated);
      toast.success("Updated successfully");
    } catch (err) {
      console.error("Update failed", err);
      toast.error("Update failed");
    }
  };

  // ===========================
  // Add note
  // ===========================
  const addNote = async () => {
    if (!noteText.trim() || !selected) return;
    const temp = {
      _id: `tmp-${Date.now()}`,
      content: noteText.trim(),
      createdBy: { name: user?.name || user?.email },
      createdAt: new Date().toISOString(),
      _optimistic: true,
    };
    setNoteText("");
    setSelected((s) => ({ ...s, notes: [...(s.notes || []), temp] }));

    try {
      const res = await api.post(`/hearings/${selected._id}/notes`, { content: temp.content });
      const saved = res.data?.data ?? res.data;
      setSelected((s) => ({ ...s, notes: s.notes.map((n) => (String(n._id).startsWith("tmp-") ? saved : n)) }));
    } catch (err) {
      console.error("Add note failed", err);
      toast.error("Failed to add note");
      loadHearingDetails(selected._id);
    }
  };

  // =========================== render ===========================
  return (
    <div className="min-h-screen p-6 bg-slate-50">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Header */}
        <div className="lg:col-span-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CalendarDays className="text-blue-600 w-6 h-6" />
            <h1 className="text-2xl font-semibold">Hearings</h1>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => setShowScheduler(true)} className="inline-flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-md">
              <PlusCircle className="w-4 h-4" /> New
            </button>

            <button onClick={() => fetchHearings(1)} className="inline-flex items-center gap-2 bg-slate-200 px-3 py-2 rounded-md">
              <List className="w-4 h-4" /> Refresh
            </button>
          </div>
        </div>

        {/* Left: Calendar */}
        <div className="lg:col-span-6 bg-white rounded-xl shadow p-4">
          <Suspense fallback={<div>Loading calendar…</div>}>
            <HearingsCalendar onSelect={onSelectFromList} />
          </Suspense>
        </div>

        {/* Center: List */}
        <div className="lg:col-span-3 bg-white rounded-xl shadow p-4 overflow-auto max-h-[70vh]">
          {loading ? (
            <div className="text-center py-10">Loading...</div>
          ) : (
            <ul className="space-y-2">
              {hearings.map((h) => (
                <li
                  key={h._id}
                  onClick={() => onSelectFromList(h)}
                  className={`p-3 rounded border cursor-pointer ${selected?._id === h._id ? "bg-blue-50 border-blue-300" : "hover:bg-slate-50"}`}
                >
                  <div className="font-medium">{h.title}</div>
                  <div className="text-xs text-slate-500">{h.date ? format(new Date(h.date || h.start), "PPP p") : "TBD"}</div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 flex justify-between">
            <button disabled={page <= 1} onClick={() => fetchHearings(page - 1)} className="px-3 py-1 bg-slate-100 rounded">
              Prev
            </button>
            <button disabled={!hasMore} onClick={() => fetchHearings(page + 1)} className="px-3 py-1 bg-slate-100 rounded">
              Next
            </button>
          </div>
        </div>

        {/* Right: Details + Chat */}
        <div className="lg:col-span-3 bg-white rounded-xl shadow p-4 flex flex-col">
          {!selected ? (
            <div className="text-center text-slate-500 py-10">Select a hearing</div>
          ) : (
            <>
              <div className="flex justify-between mb-3">
                <div>
                  <div className="text-lg font-semibold">{selected.title}</div>
                  <div className="text-sm text-slate-500">{selected.status}</div>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => setEditing(true)} className="px-2 py-1 bg-slate-100 rounded"><Edit2 size={14} /></button>
                  <button onClick={() => handleDelete(selected._id)} className="px-2 py-1 bg-red-100 text-red-600 rounded"><Trash2 size={14} /></button>
                </div>
              </div>

              {/* Notes */}
              <div className="mb-3">
                <h3 className="text-sm font-medium mb-1">Notes</h3>
                <div className="max-h-32 overflow-auto space-y-2">
                  {(selected.notes || []).map((n) => (
                    <div key={n._id} className="bg-slate-50 p-2 rounded">
                      <div className="text-xs text-slate-600">{n.createdBy?.name} – {n.createdAt ? format(new Date(n.createdAt), "PPP p") : ""}</div>
                      <div className="text-sm">{n.content}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-2 flex gap-2">
                  <input value={noteText} onChange={(e) => setNoteText(e.target.value)} className="flex-1 border rounded px-2 py-1" placeholder="Add note..." />
                  <button onClick={addNote} className="px-3 py-1 bg-blue-600 text-white rounded">Add</button>
                </div>
              </div>

              {/* Chat */}
              <HearingChatPanel arbitrationId={selected._id} room={`hearing:${selected._id}`} />
            </>
          )}
        </div>
      </div>

      {/* Scheduler Modal */}
      {showScheduler && (
        <Modal onClose={() => setShowScheduler(false)}>
          <div className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Schedule Hearing</h3>
              <button onClick={() => setShowScheduler(false)} className="p-1 bg-slate-200 rounded"><X size={16} /></button>
            </div>

            <HearingScheduler arbitrationId={null} socket={socket} />
          </div>
        </Modal>
      )}
    </div>
  );
}

/* Simple Modal (kept local for brevity) */
function Modal({ children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="relative bg-white w-full max-w-2xl rounded-lg shadow-xl p-4">
        {children}
      </motion.div>
    </div>
  );
}
