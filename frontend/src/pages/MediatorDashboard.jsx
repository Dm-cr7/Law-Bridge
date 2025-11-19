// frontend/src/pages/dashboard/MediatorDashboard.jsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { io } from "socket.io-client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Calendar as CalendarIcon,
  Users,
  Play,
  CheckCircle,
  X,
  FileText,
  Link as LinkIcon,
  MessageSquare,
} from "lucide-react";
import API from "../utils/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";

/**
 * MediatorDashboard.jsx
 *
 * Features:
 *  - Realtime (Socket.IO) subscription to session events
 *  - CRUD for mediation sessions (create, edit, cancel)
 *  - Party directory & quick search
 *  - Virtual hearing join links
 *  - Session notes/outcomes and report export
 *
 * Backend expectations:
 *  - GET  /sessions            -> list sessions (filterable by mediator id)
 *  - POST /sessions            -> create session
 *  - PUT  /sessions/:id        -> update session
 *  - DELETE /sessions/:id      -> cancel/delete session
 *  - GET  /parties OR /clients -> list parties/clients
 *  - GET  /reports/sessions    -> download session reports (PDF)
 *
 * Socket events expected:
 *  - session:created
 *  - session:updated
 *  - session:cancelled
 *  - notifications:new
 */

const SOCKET_PATH = import.meta.env.VITE_SOCKET_PATH || "/socket.io";
const BACKEND_SOCKET_URL =
  import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || "http://localhost:5000";

const sessionSchema = z.object({
  title: z.string().min(3, "Title is required"),
  parties: z.array(z.string()).min(1, "Select at least one party"),
  scheduledAt: z.string().min(1, "Date and time required"),
  durationMinutes: z.number().min(10, "Duration must be at least 10 minutes"),
  mode: z.enum(["virtual", "in-person"]),
  locationOrUrl: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export default function MediatorDashboard() {
  const { user } = useAuth() || {};
  const [sessions, setSessions] = useState([]);
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);

  // Modal state
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [editingSession, setEditingSession] = useState(null);

  // RHF + Zod for create/edit session
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
    setValue,
  } = useForm({
    resolver: zodResolver(sessionSchema),
    defaultValues: {
      title: "",
      parties: [],
      scheduledAt: "",
      durationMinutes: 60,
      mode: "virtual",
      locationOrUrl: "",
      notes: "",
    },
  });

  // Load sessions and parties
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Backend should scope sessions to mediator (e.g., /sessions?mediator=me)
      const [sessionsRes, partiesRes] = await Promise.all([
        API.get("/sessions"),
        // prefer /parties, fallback to /clients
        API.get("/parties").catch(() => API.get("/clients").catch(() => ({ data: [] }))),
      ]);
      setSessions(Array.isArray(sessionsRes.data) ? sessionsRes.data : []);
      setParties(Array.isArray(partiesRes.data) ? partiesRes.data : partiesRes.data || []);
    } catch (err) {
      console.error("Failed to load mediator dashboard:", err);
      toast.error(err?.response?.data?.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-time: connect socket when user present
  useEffect(() => {
    if (!user || !user._id) return;

    const s = io(BACKEND_SOCKET_URL, {
      path: SOCKET_PATH,
      transports: ["websocket"],
      withCredentials: true,
      auth: { token: localStorage.getItem("token") },
      query: { userId: user._id, role: user.role },
    });

    setSocket(s);

    s.on("connect", () => {
      console.info("Mediator socket connected:", s.id);
      // join mediator room if backend uses rooms
      s.emit("join", { room: `mediator:${user._id}` });
    });

    s.on("session:created", (payload) => {
      if (!payload) return;
      setSessions((prev) => [payload, ...prev]);
      toast.success(`New session scheduled: ${payload.title}`);
    });

    s.on("session:updated", (payload) => {
      if (!payload) return;
      setSessions((prev) => prev.map((sesh) => (sesh._id === payload._id ? payload : sesh)));
      toast.success(`Session updated: ${payload.title}`);
    });

    s.on("session:cancelled", ({ id, reason }) => {
      setSessions((prev) => prev.filter((sesh) => sesh._id !== id));
      toast.success("Session cancelled");
    });

    s.on("notifications:new", (n) => {
      toast.info(n?.message || "New notification");
    });

    s.on("disconnect", (reason) => {
      console.warn("Socket disconnected:", reason);
    });

    s.on("connect_error", (err) => {
      console.error("Socket connect error:", err);
      toast.error("Realtime connection error");
    });

    return () => {
      s.removeAllListeners();
      s.disconnect();
      setSocket(null);
    };
  }, [user]);

  // Create or update session
  const submitSession = async (formData) => {
    try {
      const payload = {
        ...formData,
        durationMinutes: Number(formData.durationMinutes),
      };
      if (editingSession) {
        const { data } = await API.put(`/sessions/${editingSession._id}`, payload);
        // server should emit session:updated; update UI optimistically
        setSessions((prev) => prev.map((s) => (s._id === data._id ? data : s)));
        toast.success("Session updated");
      } else {
        const { data } = await API.post("/sessions", payload);
        // server should emit session:created; update UI optimistically
        setSessions((prev) => [data, ...prev]);
        toast.success("Session created");
      }
      reset();
      setEditingSession(null);
      setShowSessionModal(false);
    } catch (err) {
      console.error("Failed to save session:", err);
      toast.error(err?.response?.data?.message || "Failed to save session");
      throw err;
    }
  };

  // Edit flow
  const startEdit = (sesh) => {
    setEditingSession(sesh);
    setShowSessionModal(true);
    // set form values
    setValue("title", sesh.title || "");
    setValue("parties", sesh.parties?.map((p) => p._id ? p._id : p) || []);
    setValue("scheduledAt", new Date(sesh.scheduledAt).toISOString().slice(0, 16)); // local datetime-local
    setValue("durationMinutes", sesh.durationMinutes || 60);
    setValue("mode", sesh.mode || "virtual");
    setValue("locationOrUrl", sesh.locationOrUrl || "");
    setValue("notes", sesh.notes || "");
  };

  // Cancel (delete) session
  const cancelSession = async (sessionId) => {
    if (!confirm("Are you sure you want to cancel this session?")) return;
    try {
      await API.delete(`/sessions/${sessionId}`);
      setSessions((prev) => prev.filter((s) => s._id !== sessionId));
      toast.success("Session cancelled");
    } catch (err) {
      console.error("Cancel failed:", err);
      toast.error("Failed to cancel session");
    }
  };

  // Join virtual hearing
  const joinSession = (sesh) => {
    if (sesh.mode === "virtual") {
      const url = sesh.locationOrUrl || sesh.virtualRoomUrl;
      if (!url) {
        toast.error("No virtual room link available");
        return;
      }
      window.open(url, "_blank");
    } else {
      // for in-person, open maps if location provided
      if (sesh.locationOrUrl) {
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(sesh.locationOrUrl)}`, "_blank");
      } else {
        toast("In-person location not provided");
      }
    }
  };

  // Report download
  const downloadReport = async (sessionId) => {
    try {
      const res = await API.get(`/reports/sessions/${sessionId}`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `session-${sessionId}-report.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Report downloaded");
    } catch (err) {
      console.error("Report error:", err);
      toast.error("Failed to download report");
    }
  };

  // Derived: sessions grouped by date
  const sessionsByDate = useMemo(() => {
    const groups = {};
    for (const s of sessions) {
      const d = new Date(s.scheduledAt);
      if (Number.isNaN(d.getTime())) continue;
      const key = d.toLocaleDateString();
      groups[key] = groups[key] || [];
      groups[key].push(s);
    }
    // sort keys descending (closest upcoming first)
    const orderedKeys = Object.keys(groups).sort((a, b) => new Date(a) - new Date(b));
    return { groups, orderedKeys };
  }, [sessions]);

  return (
    <div className="mediator-dashboard min-h-screen p-6 bg-black-50">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">Mediator Dashboard</h1>
          <p className="text-slate-600 mt-1">Manage mediation sessions, parties and outcomes in real time.</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => { setEditingSession(null); reset(); setShowSessionModal(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white"
          >
            <Play size={16} /> New Session
          </button>
          <button
            onClick={() => {
              // download a dashboard report (all sessions)
              (async () => {
                try {
                  const res = await API.get("/reports/sessions", { responseType: "blob" });
                  const url = window.URL.createObjectURL(new Blob([res.data]));
                  const link = document.createElement("a");
                  link.href = url;
                  link.setAttribute("download", "mediator_sessions_report.pdf");
                  document.body.appendChild(link);
                  link.click();
                  link.remove();
                  toast.success("Report downloaded");
                } catch (err) {
                  console.error("Failed to download sessions report", err);
                  toast.error("Failed to download report");
                }
              })();
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-black-700 text-white"
          >
            <FileText size={16} /> Export Reports
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Upcoming sessions by date */}
        <section className="lg:col-span-2 space-y-4">
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Upcoming Sessions</h2>
              <div className="text-sm text-slate-500">{sessions.length} total</div>
            </div>

            {loading ? (
              <div className="space-y-3 animate-pulse">
                <div className="h-6 bg-black-200 rounded" />
                <div className="h-6 bg-black-200 rounded" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-slate-500">No sessions scheduled.</div>
            ) : (
              sessionsByDate.orderedKeys.map((dateKey) => (
                <div key={dateKey} className="mb-4">
                  <div className="text-sm font-medium text-slate-700 mb-2">{dateKey}</div>
                  <div className="space-y-2">
                    {sessionsByDate.groups[dateKey].sort((a,b) => new Date(a.scheduledAt)-new Date(b.scheduledAt)).map((sesh) => (
                      <div key={sesh._id} className="p-3 rounded-md bg-slate-50 flex items-start justify-between">
                        <div>
                          <div className="font-semibold">{sesh.title}</div>
                          <div className="text-xs text-slate-500">
                            {new Date(sesh.scheduledAt).toLocaleTimeString()} • {sesh.durationMinutes} mins • {sesh.mode}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">{(sesh.parties || []).map(p => (p.name || p)).join(", ")}</div>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <div className="flex gap-2">
                            <button
                              onClick={() => joinSession(sesh)}
                              className="px-3 py-1 rounded bg-blue-600 text-white text-xs flex items-center gap-1"
                            >
                              <LinkIcon size={12} /> Join
                            </button>
                            <button
                              onClick={() => startEdit(sesh)}
                              className="px-3 py-1 rounded bg-white border text-xs"
                            >
                              Edit
                            </button>
                          </div>
                          <div className="flex gap-2 items-center">
                            <button
                              onClick={() => downloadReport(sesh._id)}
                              className="text-xs text-slate-600 hover:text-slate-800"
                              title="Download session report"
                            >
                              <FileText size={14} />
                            </button>
                            <button
                              onClick={() => cancelSession(sesh._id)}
                              className="text-xs text-red-600 hover:text-red-800"
                              title="Cancel session"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Notes / outcomes */}
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Session Notes / Outcomes</h2>
              <div className="text-sm text-slate-500">Record final outcomes</div>
            </div>
            <div className="text-slate-600">
              <p className="mb-2">Select a session to add notes or mark outcome. Session notes are saved to the session record and synced to all participants in real time.</p>
              <p className="text-sm text-slate-500">Open any session and use the Edit button to add notes or outcome.</p>
            </div>
          </div>
        </section>

        {/* Right: Party Directory + notifications */}
        <aside className="space-y-4">
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2"><Users /> Parties</h3>
              <div className="text-sm text-slate-500">{parties.length}</div>
            </div>

            <div>
              {loading ? (
                <div className="space-y-2 animate-pulse">
                  <div className="h-8 bg-black-200 rounded" />
                  <div className="h-8 bg-black-200 rounded" />
                </div>
              ) : parties.length === 0 ? (
                <div className="text-slate-500">No parties found</div>
              ) : (
                <ul className="max-h-64 overflow-auto space-y-2">
                  {parties.map((p) => (
                    <li key={p._id || p.email || p.id} className="flex items-center justify-between p-2 rounded hover:bg-slate-50">
                      <div>
                        <div className="font-medium">{p.name || p.fullName || p.title || p.email}</div>
                        <div className="text-xs text-slate-500">{p.email || p.phone || ""}</div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            // quick message (open external chat if implemented)
                            window.open(`/messages/compose?to=${encodeURIComponent(p._id || p.email)}`, "_blank");
                          }}
                          className="text-slate-600"
                          title="Message"
                        >
                          <MessageSquare size={16} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2"><CalendarIcon /> Today</h3>
              <div className="text-sm text-slate-500">{new Date().toLocaleDateString()}</div>
            </div>

            <div className="text-sm text-slate-600">
              <p className="mb-2">Today's sessions are highlighted in the main list. Click Join to start or view details.</p>
            </div>
          </div>
        </aside>
      </div>

      {/* Session modal */}
      {showSessionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{editingSession ? "Edit Session" : "New Session"}</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setShowSessionModal(false); setEditingSession(null); }}
                  className="p-2 rounded hover:bg-slate-100"
                >
                  <X />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit(submitSession)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium">Title</label>
                <input {...register("title")} className="mt-1 w-full rounded-md border p-2" />
                {errors.title && <p className="text-xs text-red-600">{errors.title.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium">Parties</label>
                <select {...register("parties")} multiple className="mt-1 w-full rounded-md border p-2" size={4}>
                  {parties.map((p) => (
                    <option key={p._id || p.email} value={p._id || p.email}>
                      {p.name || p.email}
                    </option>
                  ))}
                </select>
                {errors.parties && <p className="text-xs text-red-600">{errors.parties.message}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium">Date & Time</label>
                  <input
                    {...register("scheduledAt")}
                    type="datetime-local"
                    className="mt-1 w-full rounded-md border p-2"
                  />
                  {errors.scheduledAt && <p className="text-xs text-red-600">{errors.scheduledAt.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium">Duration (minutes)</label>
                  <input
                    {...register("durationMinutes", { valueAsNumber: true })}
                    type="number"
                    min={10}
                    className="mt-1 w-full rounded-md border p-2"
                  />
                  {errors.durationMinutes && <p className="text-xs text-red-600">{errors.durationMinutes.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium">Mode</label>
                  <select {...register("mode")} className="mt-1 w-full rounded-md border p-2">
                    <option value="virtual">Virtual (video link)</option>
                    <option value="in-person">In-person</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium">Location / Video URL</label>
                  <input {...register("locationOrUrl")} className="mt-1 w-full rounded-md border p-2" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium">Notes (optional)</label>
                <textarea {...register("notes")} rows={3} className="mt-1 w-full rounded-md border p-2" />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => { setShowSessionModal(false); setEditingSession(null); }}
                  className="px-4 py-2 rounded-md bg-black-100"
                >
                  Cancel
                </button>
                <button disabled={isSubmitting} type="submit" className="px-4 py-2 rounded-md bg-blue-600 text-white">
                  {isSubmitting ? "Saving..." : (editingSession ? "Save changes" : "Create session")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Simple scoped styles */}
      <style jsx>{`
        .mediator-dashboard { font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial; }
      `}</style>
    </div>
  );
}
