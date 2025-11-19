// frontend/src/components/hearing/HearingsCalendar.jsx
/**
 * HearingsCalendar.jsx — Robust calendar with debounced range fetch + socket updates
 *
 * - Sends date-only params (YYYY-MM-DD) to /api/hearings/calendar by default
 * - Debounces datesSet, cancels in-flight fetches
 * - Uses socket.io for real-time updates
 * - Ignores canceled/aborted requests silently (avoids noisy dev logs)
 */

import React, { useEffect, useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { CalendarDays, Clock } from "lucide-react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import api from "@/utils/api";
import { io } from "socket.io-client";

/**
 * Props:
 *  - onSelect(hearing) optional
 *  - onCreate(dateStr) optional
 *  - initialView optional (default: "dayGridMonth")
 */
export default function HearingsCalendar({
  onSelect = null,
  onCreate = null,
  initialView = "dayGridMonth",
}) {
  const { user } = useAuth() || {};
  const navigate = useNavigate();

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Refs
  const abortRef = useRef(null);
  const debounceRef = useRef(null);
  const socketRef = useRef(null);

  // Defensive formatter for incoming hearing objects
  const formatHearing = useCallback((h) => {
    const id = h._id || h.id || (h._doc && h._doc._id) || null;
    const start = h.start || h.date || h.datetime || null;
    const end = h.end || h.to || null;
    const title = h.title || (h.case && (h.case.title || h.case.name)) || "Untitled Hearing";

    return {
      id,
      title,
      start,
      end,
      extendedProps: {
        raw: h,
        status: h.status || h.state || "scheduled",
        caseId: (h.case && (h.case._id || h.case.id)) || null,
      },
    };
  }, []);

  // Accept either YYYY-MM-DD or ISO or epoch passed in; when given YYYY-MM-DD keep it as-is.
  const normalizeParam = (val) => {
    if (!val) return null;
    // already YYYY-MM-DD
    if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
    const d = val instanceof Date ? val : new Date(val);
    if (!isNaN(d.valueOf())) {
      // prefer date-only for calendar APIs: YYYY-MM-DD
      return d.toISOString().slice(0, 10);
    }
    return null;
  };

  // Fetch events for a visible range (sends date-only by default)
  const fetchCalendarEvents = useCallback(
    async (startParam = null, endParam = null) => {
      // cancel previous
      try {
        if (abortRef.current) abortRef.current.abort();
      } catch (e) {
        // ignore
      }

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        setLoading(true);

        const params = {};
        const s = normalizeParam(startParam);
        const e = normalizeParam(endParam);
        if (s) params.start = s;
        if (e) params.end = e;

        // Use api wrapper (baseURL + auth should be configured in your utils/api)
        const res = await api.get("/hearings/calendar", {
          params,
          signal: controller.signal,
          withCredentials: true,
        });

        const raw = res?.data?.data || res?.data?.events || res?.data || [];
        const arr = Array.isArray(raw) ? raw.map(formatHearing) : [];
        setEvents(arr);
      } catch (err) {
        // ignore cancellations/abort to avoid noisy logs in dev (React StrictMode double-mount)
        const isCanceled =
          err?.name === "AbortError" || err?.name === "CanceledError" || err?.code === "ERR_CANCELED" || err?.message === "canceled";
        if (isCanceled) {
          return;
        }

        const backendMsg = err?.response?.data?.message || err?.response?.data?.error || err?.response?.data || null;
        console.error("❌ Failed to fetch hearings calendar:", err, backendMsg);
        if (backendMsg) toast.error(String(backendMsg));
        else toast.error("Failed to load hearings calendar.");
      } finally {
        setLoading(false);
        abortRef.current = null;
      }
    },
    [formatHearing]
  );

  // Initialize socket + initial fetch
  useEffect(() => {
    // Instead of calling without a range (which some backends reject), pick a sensible default:
    // default => current month visible range: YYYY-MM-01 -> YYYY-MM-last
    const now = new Date();
    const firstDayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const lastDayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
    const defaultStart = firstDayUTC.toISOString().slice(0, 10);
    const defaultEnd = lastDayUTC.toISOString().slice(0, 10);

    fetchCalendarEvents(defaultStart, defaultEnd);

    const SOCKET_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
    const token = (typeof window !== "undefined" && (localStorage.getItem("token") || (user && user.token))) || null;

    const s = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      auth: token ? { token } : undefined,
      reconnectionAttempts: 3,
    });
    socketRef.current = s;

    if (user && (user._id || user.id)) {
      s.emit("joinRoom", `user_${user._id || user.id}`);
    }

    s.on("hearing:new", (payload) => {
      try {
        const ev = formatHearing(payload);
        // add or overwrite
        setEvents((prev) => {
          const exists = prev.some((p) => String(p.id) === String(ev.id));
          if (exists) return prev.map((p) => (String(p.id) === String(ev.id) ? ev : p));
          return [ev, ...prev].sort((a, b) => new Date(a.start) - new Date(b.start));
        });
        toast.success(`New hearing: ${payload.title || "Untitled"}`);
      } catch (e) {
        console.warn("Error handling hearing:new", e);
      }
    });

    s.on("hearing:update", (payload) => {
      try {
        const ev = formatHearing(payload);
        setEvents((prev) => prev.map((p) => (String(p.id) === String(ev.id) ? ev : p)));
        toast.success(`Hearing updated: ${payload.title || "Untitled"}`);
      } catch (e) {
        console.warn("Error handling hearing:update", e);
      }
    });

    s.on("hearing:deleted", (payload) => {
      const id = payload?._id || payload?.id || payload;
      setEvents((prev) => prev.filter((e) => String(e.id) !== String(id)));
      toast("Hearing removed");
    });

    s.on("connect_error", (err) => {
      console.warn("HearingsCalendar socket connect_error:", err);
    });

    return () => {
      try {
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
          debounceRef.current = null;
        }
        if (abortRef.current) {
          abortRef.current.abort();
          abortRef.current = null;
        }
        if (s) {
          s.removeAllListeners();
          s.disconnect();
        }
      } catch (e) {
        // ignore cleanup errors
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchCalendarEvents, user]);

  // Called by FullCalendar when the visible date range changes.
  // Debounce to avoid rapid multiple requests while dragging/scrolling.
  const handleDatesSet = (info) => {
    // Use YYYY-MM-DD for calendar queries
    const start = info.start ? info.start.toISOString().slice(0, 10) : null;
    const end = info.end ? info.end.toISOString().slice(0, 10) : null;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchCalendarEvents(start, end);
      debounceRef.current = null;
    }, 300);
  };

  const handleEventClick = (info) => {
    const raw = info.event.extendedProps?.raw || null;
    try {
      if (onSelect && typeof onSelect === "function") return onSelect(raw || { id: info.event.id });
      const caseId = info.event.extendedProps?.caseId;
      if (caseId) navigate(`/cases/${caseId}`);
      else navigate(`/hearings/${info.event.id}`);
    } catch (err) {
      console.error("Error in handleEventClick", err);
    }
  };

  const handleDateClick = (info) => {
    try {
      if (onCreate && typeof onCreate === "function") return onCreate(info.dateStr || info.date);
      const dateParam = encodeURIComponent(info.dateStr || info.date?.toISOString?.());
      navigate(`/hearings/new?date=${dateParam}`);
    } catch (err) {
      console.error("Error in handleDateClick", err);
    }
  };

  return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-3">
        <CalendarDays className="text-blue-600 w-5 h-5" />
        <h2 className="text-lg font-semibold">Hearings Calendar</h2>
        <div className="text-sm text-slate-500">Click a date to schedule. Click an event to open details.</div>
      </div>

      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-xl shadow p-3">
        {loading ? (
          <div className="text-center py-8 text-slate-500">Loading calendar...</div>
        ) : (
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView={initialView}
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,timeGridWeek,timeGridDay",
            }}
            height="70vh"
            events={events}
            eventClick={handleEventClick}
            dateClick={handleDateClick}
            datesSet={handleDatesSet}
            eventClassNames={(arg) => {
              const status = arg.event.extendedProps?.status;
              switch (status) {
                case "scheduled":
                  return "bg-blue-500 text-white border-0 rounded-md";
                case "in_progress":
                  return "bg-emerald-500 text-white border-0 rounded-md";
                case "adjourned":
                  return "bg-amber-500 text-white border-0 rounded-md";
                case "completed":
                  return "bg-green-500 text-white border-0 rounded-md";
                case "cancelled":
                  return "bg-slate-600 text-white border-0 rounded-md";
                default:
                  return "bg-indigo-400 text-white border-0 rounded-md";
              }
            }}
            eventContent={(arg) => (
              <div className="p-1 text-xs leading-tight">
                <strong>{arg.event.title}</strong>
                {arg.event.start && (
                  <div className="flex items-center gap-1 opacity-80">
                    <Clock size={10} />
                    <span>{new Date(arg.event.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                )}
              </div>
            )}
          />
        )}
      </motion.div>
    </div>
  );
}
