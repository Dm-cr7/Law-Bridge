// frontend/src/pages/HearingsPage.jsx

import React, { useEffect, useState, useCallback, useRef } from "react";
import HearingsCalendar from "@/components/hearing/HearingsCalendar";
import HearingChatPanel from "@/components/hearing/HearingChatPanel";
import HearingScheduler from "@/components/hearing/HearingScheduler";
import { useAuth } from "@/context/AuthContext";
import API from "@/utils/api";
import { io } from "socket.io-client";
import { format } from "date-fns";
import { motion } from "framer-motion";
import {
  CalendarDays,
  List,
  PlusCircle,
  Trash2,
  Edit2,
  Clock,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

const SOCKET_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
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

  const controllersRef = useRef([]);
  const hearingsRef = useRef([]);

  useEffect(() => {
    hearingsRef.current = hearings;
  }, [hearings]);

  /* ==========================================================
     FETCH HEARINGS
  ========================================================== */
  const fetchHearings = useCallback(
    async (p = 1) => {
      const ctrl = new AbortController();
      controllersRef.current.push(ctrl);

      try {
        setLoading(true);

        const res = await API.get("/api/hearings", {
          params: { page: p, limit: PAGE_LIMIT },
          signal: ctrl.signal,
        });

        const list = Array.isArray(res.data)
          ? res.data
          : res.data?.data || [];

        setHearings(list);
        setHasMore(list.length === PAGE_LIMIT);
        setPage(p);
      } catch (err) {
        if (!err.message?.includes("canceled")) {
          toast.error("Failed to load hearings");
        }
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /* ==========================================================
     SOCKET SETUP
  ========================================================== */
  useEffect(() => {
    fetchHearings(1);

    const s = io(SOCKET_URL, {
      transports: ["websocket"],
      auth: { token: localStorage.getItem("token") },
    });

    if (user?._id) s.emit("joinRoom", `user_${user._id}`);

    s.on("hearing:new", (h) => {
      setHearings((prev) =>
        [h, ...prev].sort((a, b) => new Date(b.date) - new Date(a.date))
      );
      toast.success(`New hearing scheduled: ${h.title}`);
    });

    s.on("hearing:update", (h) => {
      setHearings((prev) =>
        prev.map((x) => (String(x._id) === String(h._id) ? h : x))
      );
      if (selected && selected._id === h._id) setSelected(h);
    });

    s.on("hearing:deleted", ({ _id }) => {
      setHearings((prev) => prev.filter((x) => x._id !== _id));
      if (selected && selected._id === _id) setSelected(null);
    });

    setSocket(s);

    return () => {
      s.disconnect();
      controllersRef.current.forEach((c) => c.abort?.());
      controllersRef.current = [];
    };
  }, [fetchHearings, user, selected]);

  /* ==========================================================
     LOAD HEARING DETAILS
  ========================================================== */
  const loadHearingDetails = useCallback(async (id) => {
    if (!id) return;

    try {
      const res = await API.get(`/api/hearings/${id}`);
      setSelected(res.data?.data || res.data);
    } catch {
      toast.error("Failed to load hearing details");
    }
  }, []);

  /* ==========================================================
     DELETE
  ========================================================== */
  const handleDelete = async (id) => {
    if (!confirm("Cancel this hearing?")) return;

    const backup = hearingsRef.current;
    setHearings((prev) => prev.filter((x) => x._id !== id));

    if (selected?._id === id) setSelected(null);

    try {
      await API.delete(`/api/hearings/${id}`);
      toast.success("Hearing cancelled");
    } catch (err) {
      toast.error("Failed to cancel");
      setHearings(backup);
    }
  };

  /* ==========================================================
     UPDATE
  ========================================================== */
  const handleUpdate = async (id, updates) => {
    try {
      const res = await API.put(`/api/hearings/${id}`, updates);
      const updated = res.data?.data || res.data;

      setHearings((prev) =>
        prev.map((h) => (h._id === id ? updated : h))
      );
      setSelected(updated);
      toast.success("Updated successfully");
    } catch {
      toast.error("Update failed");
    }
  };

  /* ==========================================================
     ADD NOTE
  ========================================================== */
  const addNote = async () => {
    if (!noteText.trim() || !selected) return;

    const temp = {
      _id: `tmp-${Date.now()}`,
      content: noteText.trim(),
      createdBy: { name: user.name || user.email },
      createdAt: new Date().toISOString(),
      _optimistic: true,
    };

    setNoteText("");
    setSelected((s) => ({
      ...s,
      notes: [...(s.notes || []), temp],
    }));

    try {
      const res = await API.post(
        `/api/hearings/${selected._id}/notes`,
        { content: temp.content }
      );
      const saved = res.data?.data || res.data;

      setSelected((s) => ({
        ...s,
        notes: s.notes.map((n) =>
          n._id.startsWith("tmp-") ? saved : n
        ),
      }));
    } catch {
      toast.error("Failed to add note");
      loadHearingDetails(selected._id);
    }
  };

  /* ==========================================================
     SELECT FROM LIST
  ========================================================== */
  const onSelectFromList = (h) => {
    setSelected(h);
    loadHearingDetails(h._id);
  };

  /* ==========================================================
     RENDER UI
  ========================================================== */
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
            <button
              onClick={() => setShowScheduler(true)}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-md"
            >
              <PlusCircle className="w-4 h-4" /> New
            </button>

            <button
              onClick={() => fetchHearings(1)}
              className="inline-flex items-center gap-2 bg-slate-200 px-3 py-2 rounded-md"
            >
              <List className="w-4 h-4" /> Refresh
            </button>
          </div>
        </div>

        {/* Left: Calendar */}
        <div className="lg:col-span-6 bg-white rounded-xl shadow p-4">
          <HearingsCalendar onSelect={onSelectFromList} />
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
                  className={`p-3 rounded border cursor-pointer ${
                    selected?._id === h._id
                      ? "bg-blue-50 border-blue-300"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <div className="font-medium">{h.title}</div>
                  <div className="text-xs text-slate-500">
                    {h.date ? format(new Date(h.date), "PPP p") : "TBD"}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Pagination */}
          <div className="mt-4 flex justify-between">
            <button
              disabled={page <= 1}
              onClick={() => fetchHearings(page - 1)}
              className="px-3 py-1 bg-slate-100 rounded"
            >
              Prev
            </button>
            <button
              disabled={!hasMore}
              onClick={() => fetchHearings(page + 1)}
              className="px-3 py-1 bg-slate-100 rounded"
            >
              Next
            </button>
          </div>
        </div>

        {/* Right: Details + Chat */}
        <div className="lg:col-span-3 bg-white rounded-xl shadow p-4 flex flex-col">
          {!selected ? (
            <div className="text-center text-slate-500 py-10">
              Select a hearing
            </div>
          ) : (
            <>
              <div className="flex justify-between mb-3">
                <div>
                  <div className="text-lg font-semibold">
                    {selected.title}
                  </div>
                  <div className="text-sm text-slate-500">
                    {selected.status}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setEditing(true)}
                    className="px-2 py-1 bg-slate-100 rounded"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(selected._id)}
                    className="px-2 py-1 bg-red-100 text-red-600 rounded"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Notes */}
              <div className="mb-3">
                <h3 className="text-sm font-medium mb-1">Notes</h3>
                <div className="max-h-32 overflow-auto space-y-2">
                  {(selected.notes || []).map((n) => (
                    <div key={n._id} className="bg-slate-50 p-2 rounded">
                      <div className="text-xs text-slate-600">
                        {n.createdBy?.name} –{" "}
                        {format(new Date(n.createdAt), "PPP p")}
                      </div>
                      <div className="text-sm">{n.content}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-2 flex gap-2">
                  <input
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    className="flex-1 border rounded px-2 py-1"
                    placeholder="Add note..."
                  />
                  <button
                    onClick={addNote}
                    className="px-3 py-1 bg-blue-600 text-white rounded"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Chat */}
              <HearingChatPanel
                arbitrationId={selected._id}
                room={`hearing:${selected._id}`}
              />
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
              <button
                onClick={() => setShowScheduler(false)}
                className="p-1 bg-slate-200 rounded"
              >
                <X size={16} />
              </button>
            </div>

            <HearingScheduler arbitrationId={null} socket={socket} />
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ==========================================================
   MODAL COMPONENT
========================================================== */
function Modal({ children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative bg-white w-full max-w-2xl rounded-lg shadow-xl p-4"
      >
        {children}
      </motion.div>
    </div>
  );
}
