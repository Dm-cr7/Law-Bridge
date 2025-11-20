// frontend\src\components\HearingsCalendar.jsx
/**
 * HearingsCalendar.jsx — Full, robust rewrite
 *
 * - Uses a FullCalendar ref (no DOM hacks)
 * - Debounced range fetch + identical-range short-circuit
 * - Filters (status, case, search)
 * - Drag/drop + resize -> optimistic PATCH with rollback
 * - Export visible range (uses calendar ref)
 * - Socket updates (create/update/delete)
 * - Defensive abort handling
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import { motion } from "framer-motion";
import { CalendarDays, Clock, DownloadCloud, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import api from "@/utils/api";
import { io } from "socket.io-client";
import { useAuth } from "@/context/AuthContext";

/* ------------------------------- Config ------------------------------- */
const DEFAULT_STATUS_COLORS = {
  scheduled: "bg-blue-500",
  in_progress: "bg-emerald-500",
  adjourned: "bg-amber-500",
  completed: "bg-green-600",
  cancelled: "bg-slate-600",
  tentative: "bg-indigo-500",
};

const NON_FATAL_ABORT_NAMES = new Set(["AbortError", "CanceledError", "ERR_CANCELED"]);

/* ------------------------------- Helpers ------------------------------ */
const safeData = (res) => {
  // Always return an array (empty if no events)
  if (!res) return [];
  if (res?.data === undefined) {
    // raw response (maybe already array)
    return Array.isArray(res) ? res : [];
  }
  const d = res.data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.data)) return d.data;
  if (Array.isArray(d?.events)) return d.events;
  return [];
};

const toISO = (v) => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.valueOf())) return null;
  return d.toISOString();
};

const normalizeRangeKey = (s, e, status, caseId, q) => {
  const sk = s ? s.slice(0, 10) : "";
  const ek = e ? e.slice(0, 10) : "";
  return `${sk}::${ek}::status=${status || "All"}::case=${caseId || ""}::q=${q || ""}`;
};

const formatHearing = (h) => {
  if (!h) return null;
  const id = h._id || h.id || (h._doc && h._doc._id) || null;
  const start = h.start || h.date || h.datetime || h.scheduledAt || null;
  const end = h.end || h.to || h.endsAt || null;
  const title = h.title || (h.case && (h.case.title || h.case.name)) || "Untitled Hearing";
  const status = h.status || h.state || "scheduled";
  return {
    id,
    title,
    start,
    end,
    extendedProps: {
      raw: h,
      status,
      caseId: h.case?._id || h.case?.id || h.case || null,
      notes: h.notes || h.description || "",
    },
  };
};

/* ------------------------------ Component ------------------------------ */
export default function HearingsCalendar({
  onSelect = null,
  onCreate = null,
  initialView = "dayGridMonth",
  showControls = true,
}) {
  const { user } = useAuth() || {};
  const navigate = useNavigate();

  // state
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);

  const [statusFilter, setStatusFilter] = useState("All");
  const [caseFilter, setCaseFilter] = useState("");
  const [searchQ, setSearchQ] = useState("");

  // refs
  const mountedRef = useRef(true);
  const abortRef = useRef(null);
  const debounceRef = useRef(null);
  const lastRangeKeyRef = useRef("");
  const calendarRef = useRef(null);
  const socketRef = useRef(null);
  const optimisticMapRef = useRef(new Map());

  /* --------------------------- Fetch events --------------------------- */
  const fetchEventsForRange = useCallback(
    async (startISO = null, endISO = null) => {
      const key = normalizeRangeKey(startISO, endISO, statusFilter, caseFilter, searchQ);
      if (key === lastRangeKeyRef.current) return;

      // abort previous
      try {
        if (abortRef.current) abortRef.current.abort();
      } catch {}

      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);

      try {
        const params = {};
        if (startISO && endISO) {
          params.start = startISO.slice(0, 10);
          params.end = endISO.slice(0, 10);
        }
        if (statusFilter && statusFilter !== "All") params.status = statusFilter;
        if (caseFilter) params.caseId = caseFilter;
        if (searchQ) params.q = searchQ;

        const res = await api.get("/hearings/calendar", { params, signal: controller.signal });
        const raw = safeData(res);
        const arr = raw.map(formatHearing).filter(Boolean);
        if (!mountedRef.current) return;
        setEvents(arr);
        lastRangeKeyRef.current = key;
      } catch (err) {
        const nonFatal = NON_FATAL_ABORT_NAMES.has(err?.name) || err?.code === "ERR_CANCELED" || err?.message === "canceled";
        if (!nonFatal) {
          console.error("Failed to fetch hearings:", err);
          const msg = err?.response?.data?.message || err?.message || "Failed to load hearings.";
          toast.error(String(msg));
        }
      } finally {
        if (mountedRef.current) setLoading(false);
        abortRef.current = null;
      }
    },
    [statusFilter, caseFilter, searchQ]
  );

  /* ---------------------------- Socket setup -------------------------- */
  useEffect(() => {
    mountedRef.current = true;

    const SOCKET_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
    const token = typeof window !== "undefined" && (localStorage.getItem("token") || null);
    const s = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      auth: token ? { token } : undefined,
      reconnectionAttempts: 5,
    });
    socketRef.current = s;

    s.on("connect_error", (err) => console.warn("Hearings socket connect_error:", err));
    s.on("connect", () => {
      if (user?.id || user?._id) {
        try {
          s.emit("joinRoom", `user_${user._id || user.id}`);
        } catch {}
      }
    });

    s.on("hearing:new", (payload) => {
      try {
        const ev = formatHearing(payload);
        if (!ev) return;
        setEvents((prev) => {
          const exists = prev.some((p) => String(p.id) === String(ev.id));
          if (exists) return prev.map((p) => (String(p.id) === String(ev.id) ? ev : p));
          return [ev, ...prev].sort((a, b) => new Date(a.start) - new Date(b.start));
        });
        toast.success(`New hearing: ${payload.title || "Untitled"}`);
      } catch (e) {
        console.warn("hearing:new handler error", e);
      }
    });

    s.on("hearing:update", (payload) => {
      try {
        const ev = formatHearing(payload);
        if (!ev) return;
        setEvents((prev) => prev.map((p) => (String(p.id) === String(ev.id) ? ev : p)));
        toast.success(`Hearing updated: ${payload.title || "Untitled"}`);
      } catch (e) {
        console.warn("hearing:update handler error", e);
      }
    });

    s.on("hearing:deleted", (payload) => {
      const id = payload?._id || payload?.id || payload;
      setEvents((prev) => prev.filter((p) => String(p.id) !== String(id)));
      toast.success("Hearing removed");
    });

    return () => {
      mountedRef.current = false;
      try {
        if (abortRef.current) abortRef.current.abort();
        if (debounceRef.current) clearTimeout(debounceRef.current);
        s.removeAllListeners();
        s.disconnect();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  /* ---------------------- initial month load ------------------------- */
  useEffect(() => {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    fetchEventsForRange(toISO(first), toISO(last));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchEventsForRange]);

  /* ------------------------- calendar callbacks ---------------------- */
  const handleDatesSet = (arg) => {
    const sISO = arg.start ? toISO(arg.start) : null;
    const eISO = arg.end ? toISO(arg.end) : null;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchEventsForRange(sISO, eISO);
      debounceRef.current = null;
    }, 300);
  };

  const openHearing = (ev) => {
    const raw = ev.extendedProps?.raw || null;
    if (onSelect) return onSelect(raw || ev);
    const qp = new URLSearchParams({ hearing: ev.id }).toString();
    navigate(`/dashboard/hearings/page?${qp}`);
  };

  const handleEventClick = (info) => {
    try {
      openHearing(info.event);
    } catch (err) {
      console.error("eventClick error", err);
    }
  };

  const handleDateClick = (info) => {
    try {
      if (onCreate) return onCreate(info.dateStr || info.date);
      const dateVal = info.dateStr || (info.date && info.date.toISOString().slice(0, 10));
      const qp = new URLSearchParams({ date: dateVal }).toString();
      navigate(`/dashboard/hearings/scheduler?${qp}`);
    } catch (err) {
      console.error("dateClick error", err);
    }
  };

  /* ------------------------ drag & resize handlers ------------------- */
  const patchHearingDate = async (id, patch) => {
    const prev = events.find((e) => String(e.id) === String(id));
    optimisticMapRef.current.set(id, prev);
    setEvents((prevList) => prevList.map((e) => (String(e.id) === String(id) ? { ...e, ...(patch.start ? { start: patch.start } : {}), ...(patch.end ? { end: patch.end } : {}) } : e)));

    try {
      await api.patch(`/hearings/${id}`, patch);
      optimisticMapRef.current.delete(id);
      toast.success("Hearing rescheduled");
    } catch (err) {
      console.error("Reschedule failed:", err);
      const message = err?.response?.data?.message || err?.message || "Failed to update hearing";
      toast.error(message);
      const original = optimisticMapRef.current.get(id);
      if (original) {
        setEvents((prevList) => prevList.map((e) => (String(e.id) === String(id) ? original : e)));
        optimisticMapRef.current.delete(id);
      }
    }
  };

  const handleEventDrop = (info) => {
    const id = info.event.id;
    const start = info.event.start ? toISO(info.event.start) : null;
    const end = info.event.end ? toISO(info.event.end) : null;
    patchHearingDate(id, { start, end });
  };

  const handleEventResize = (info) => {
    const id = info.event.id;
    const start = info.event.start ? toISO(info.event.start) : null;
    const end = info.event.end ? toISO(info.event.end) : null;
    patchHearingDate(id, { start, end });
  };

  /* ---------------------------- deletion ----------------------------- */
  const deleteHearing = async (id) => {
    try {
      await api.delete(`/hearings/${id}`);
      setEvents((prev) => prev.filter((e) => String(e.id) !== String(id)));
      toast.success("Hearing deleted");
    } catch (err) {
      console.error("Delete hearing failed", err);
      const message = err?.response?.data?.message || err?.message || "Failed to delete hearing";
      toast.error(message);
    }
  };

  /* ------------------------- export visible range --------------------- */
  const exportVisibleRange = async () => {
    try {
      const fc = calendarRef.current;
      const apiObj = fc?.getApi ? fc.getApi() : null;
      const view = apiObj?.view;
      const start = view?.activeStart ? view.activeStart.toISOString().slice(0, 10) : null;
      const end = view?.activeEnd ? view.activeEnd.toISOString().slice(0, 10) : null;
      const params = new URLSearchParams({ start, end, format: "csv" }).toString();
      const res = await api.get(`/hearings/export?${params}`, { responseType: "blob" });
      const blob = new Blob([res.data], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `hearings_${start || "all"}_${end || "all"}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("Export started");
    } catch (err) {
      console.error("Export failed", err);
      const message = err?.response?.data?.message || err?.message || "Export failed";
      toast.error(message);
    }
  };

  /* --------------------------- render UI ----------------------------- */
  return (
    <div className="p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <CalendarDays className="text-blue-600 w-5 h-5" />
          <div>
            <h2 className="text-lg font-semibold">Hearings Calendar</h2>
            <div className="text-sm text-slate-500">Click a date to schedule. Drag events to reschedule.</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {showControls && (
            <>
              <input
                aria-label="Search hearings"
                placeholder="Search hearings..."
                value={searchQ}
                onChange={(e) => {
                  setSearchQ(e.target.value);
                  // clear last key so next datesSet triggers
                  lastRangeKeyRef.current = "";
                }}
                className="px-3 py-1 border rounded-md text-sm"
              />

              <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); lastRangeKeyRef.current = ""; }} className="px-2 py-1 border rounded-md text-sm">
                <option>All</option>
                <option value="scheduled">Scheduled</option>
                <option value="in_progress">In Progress</option>
                <option value="adjourned">Adjourned</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>

              <button
                title="Refresh"
                className="p-2 rounded-md bg-slate-100 hover:bg-slate-200"
                onClick={() => {
                  lastRangeKeyRef.current = "";
                  const now = new Date();
                  const first = new Date(now.getFullYear(), now.getMonth(), 1);
                  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                  fetchEventsForRange(toISO(first), toISO(last));
                }}
              >
                <RefreshCw size={16} />
              </button>
            </>
          )}

          <button
            title="Export visible range"
            className="p-2 rounded-md bg-slate-100 hover:bg-slate-200 ml-2"
            onClick={() => exportVisibleRange()}
          >
            <DownloadCloud size={16} />
          </button>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-xl shadow p-3">
        {loading ? (
          <div className="text-center py-8 text-slate-500">Loading calendar...</div>
        ) : (
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
            initialView={initialView}
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek",
            }}
            height="70vh"
            events={events}
            eventClick={handleEventClick}
            dateClick={handleDateClick}
            datesSet={handleDatesSet}
            editable={true}
            eventDrop={handleEventDrop}
            eventResize={handleEventResize}
            eventDidMount={(info) => {
              // attach a namespaced contextmenu that we can remove later
              const handler = (e) => {
                e.preventDefault();
                setContextMenuState(info, e);
              };
              info.el.__fc_ctx_handler = handler;
              info.el.addEventListener("contextmenu", handler);
            }}
            eventWillUnmount={(info) => {
              // cleanup attached listener if any
              try {
                if (info.el && info.el.__fc_ctx_handler) {
                  info.el.removeEventListener("contextmenu", info.el.__fc_ctx_handler);
                  delete info.el.__fc_ctx_handler;
                }
              } catch {}
            }}
            eventClassNames={(arg) => {
              const status = arg.event.extendedProps?.status || "scheduled";
              const css = DEFAULT_STATUS_COLORS[status] || DEFAULT_STATUS_COLORS.tentative;
              return `${css} text-white border-0 rounded-md`;
            }}
            eventContent={(arg) => (
              <div className="p-1 text-xs leading-tight">
                <strong>{arg.event.title}</strong>
                {arg.event.start && (
                  <div className="flex items-center gap-1 opacity-90">
                    <Clock size={10} />
                    <span>{new Date(arg.event.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                )}
              </div>
            )}
            longPressDelay={100}
          />
        )}
      </motion.div>

      {/* legend */}
      <div className="flex gap-3 mt-3 items-center text-sm">
        {Object.keys(DEFAULT_STATUS_COLORS).map((k) => (
          <div key={k} className="flex items-center gap-2">
            <span className={`${DEFAULT_STATUS_COLORS[k]} w-3 h-3 rounded-sm inline-block`}></span>
            <span className="capitalize">{k.replace("_", " ")}</span>
          </div>
        ))}
      </div>
    </div>
  );

  /* -------------------- local helpers inside component -------------------- */

  // set context menu state helper (kept inline to access state setter)
  function setContextMenuState(info, e) {
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      event: info.event,
    });
  }
}
