// frontend/src/pages/ReconciliatorDashboard.jsx
/**
 * ReconciliatorDashboard.jsx
 *
 * Role: Reconciliator
 *
 * Purpose:
 *  - Manage reconciliation meetings (scheduling, status updates)
 *  - Track progress, collect outcomes, export reconciliation reports
 *  - Real-time updates via Socket.IO for meeting changes, participant updates, and notifications
 *
 * Backend expectations:
 *  - GET    /reconciliations          -> list reconciliations (filter by user/role server-side)
 *  - POST   /reconciliations          -> create reconciliation meeting
 *  - PUT    /reconciliations/:id      -> update reconciliation (status, notes)
 *  - GET    /reconciliations/:id/report -> download reconciliation report (PDF)
 *  - Optional: GET /participants or /clients
 *
 * Socket events expected:
 *  - recon:created
 *  - recon:updated
 *  - recon:closed
 *  - notifications:new
 *
 * Env:
 *  - VITE_BACKEND_URL or VITE_API_URL
 *  - VITE_SOCKET_PATH optional
 */

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { io } from "socket.io-client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Handshake,
  Calendar as CalendarIcon,
  Users,
  FileText,
  ArrowUpRight,
  Save,
  X,
  Download,
  Bell,
} from "lucide-react";
import API from "../utils/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";

/* Config */
const SOCKET_PATH = import.meta.env.VITE_SOCKET_PATH || "/socket.io";
const BACKEND_SOCKET_URL =
  import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || "http://localhost:5000";

/* Form schema */
const reconSchema = z.object({
  title: z.string().min(3, "Title is required"),
  participants: z.string().min(3, "Provide at least one participant identifier"),
  scheduledAt: z.string().min(1, "Date & time required"),
  durationMinutes: z.preprocess((v) => Number(v), z.number().min(5, "Duration at least 5 minutes")),
  mode: z.enum(["virtual", "in-person"]),
  linkOrLocation: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export default function ReconciliatorDashboard() {
  const { user } = useAuth() || {};
  const [recons, setRecons] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);

  // Modal & editing state
  const [showNewModal, setShowNewModal] = useState(false);
  const [editingRecon, setEditingRecon] = useState(null);

  // react-hook-form for new/edit reconciliation
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(reconSchema),
    defaultValues: {
      title: "",
      participants: "",
      scheduledAt: "",
      durationMinutes: 30,
      mode: "virtual",
      linkOrLocation: "",
      notes: "",
    },
  });

  /* Load initial data */
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [reconRes, participantsRes] = await Promise.all([
        API.get("/reconciliations"),
        API.get("/participants").catch(() => API.get("/clients").catch(() => ({ data: [] }))),
      ]);
      setRecons(Array.isArray(reconRes.data) ? reconRes.data : []);
      setParticipants(Array.isArray(participantsRes.data) ? participantsRes.data : []);
    } catch (err) {
      console.error("Failed to load reconciliator dashboard:", err);
      toast.error(err?.response?.data?.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* Real-time socket */
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
      console.info("Reconciliator socket connected:", s.id);
      s.emit("join", { room: `reconciliator:${user._id}` });
    });

    s.on("recon:created", (payload) => {
      if (!payload) return;
      setRecons((prev) => [payload, ...prev]);
      toast.success(`Reconciliation scheduled: ${payload.title}`);
    });

    s.on("recon:updated", (payload) => {
      if (!payload) return;
      setRecons((prev) => prev.map((r) => (r._id === payload._id ? payload : r)));
      toast.success(`Reconciliation updated: ${payload.title}`);
    });

    s.on("recon:closed", ({ id, result }) => {
      setRecons((prev) => prev.map((r) => (r._id === id ? { ...r, status: "closed", result } : r)));
      toast.success("Reconciliation closed");
    });

    s.on("notifications:new", (n) => {
      toast.info(n?.message || "New notification");
    });

    s.on("disconnect", (reason) => {
      console.warn("Socket disconnected:", reason);
    });

    s.on("connect_error", (err) => {
      console.error("Socket connection error:", err);
      toast.error("Real-time connection failed");
    });

    return () => {
      s.removeAllListeners();
      s.disconnect();
      setSocket(null);
    };
  }, [user]);

  /* Create or update a reconciliation meeting */
  const submitRecon = async (vals) => {
    try {
      const payload = {
        ...vals,
        durationMinutes: Number(vals.durationMinutes),
      };

      if (editingRecon) {
        const { data } = await API.put(`/reconciliations/${editingRecon._id}`, payload);
        setRecons((prev) => prev.map((r) => (r._id === data._id ? data : r)));
        toast.success("Reconciliation updated");
      } else {
        const { data } = await API.post("/reconciliations", payload);
        setRecons((prev) => [data, ...prev]);
        toast.success("Reconciliation scheduled");
      }

      reset();
      setEditingRecon(null);
      setShowNewModal(false);
    } catch (err) {
      console.error("Submit reconciliation failed:", err);
      toast.error(err?.response?.data?.message || "Failed to save reconciliation");
      throw err;
    }
  };

  /* Open edit modal with existing data */
  const startEdit = (r) => {
    setEditingRecon(r);
    setShowNewModal(true);
    setValue("title", r.title || "");
    setValue("participants", (r.participants || []).join(", "));
    setValue("scheduledAt", r.scheduledAt ? new Date(r.scheduledAt).toISOString().slice(0, 16) : "");
    setValue("durationMinutes", r.durationMinutes || 30);
    setValue("mode", r.mode || "virtual");
    setValue("linkOrLocation", r.linkOrLocation || "");
    setValue("notes", r.notes || "");
  };

  /* Close reconciliation (record outcome) */
  const closeRecon = async (id, result) => {
    try {
      const { data } = await API.put(`/reconciliations/${id}`, { status: "closed", result });
      setRecons((prev) => prev.map((r) => (r._id === data._id ? data : r)));
      toast.success("Reconciliation closed");
    } catch (err) {
      console.error("Close reconciliation failed:", err);
      toast.error("Failed to close reconciliation");
    }
  };

  /* Download reconciliation report */
  const downloadReport = async (id) => {
    try {
      const res = await API.get(`/reconciliations/${id}/report`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `reconciliation-${id}-report.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Report downloaded");
    } catch (err) {
      console.error("Download report failed:", err);
      toast.error("Failed to download report");
    }
  };

  /* Join (virtual) or open location */
  const joinMeeting = (r) => {
    if (r.mode === "virtual") {
      const url = r.linkOrLocation || r.virtualRoomUrl;
      if (!url) {
        toast.error("No virtual link provided");
        return;
      }
      window.open(url, "_blank");
    } else {
      if (r.linkOrLocation) {
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.linkOrLocation)}`, "_blank");
      } else {
        toast.error("No physical location provided");
      }
    }
  };

  /* Derived stats */
  const stats = useMemo(() => {
    const total = recons.length;
    const open = recons.filter((r) => (r.status || "").toLowerCase() === "open" || !r.status).length;
    const closed = recons.filter((r) => (r.status || "").toLowerCase() === "closed").length;
    return { total, open, closed };
  }, [recons]);

  /* Group by date for UI */
  const reconsByDate = useMemo(() => {
    const groups = {};
    for (const r of recons) {
      const key = r.scheduledAt ? new Date(r.scheduledAt).toLocaleDateString() : "Unscheduled";
      groups[key] = groups[key] || [];
      groups[key].push(r);
    }
    const orderedKeys = Object.keys(groups).sort((a, b) => {
      if (a === "Unscheduled") return 1;
      if (b === "Unscheduled") return -1;
      return new Date(a) - new Date(b);
    });
    return { groups, orderedKeys };
  }, [recons]);

  return (
    <div className="reconciliator-dashboard min-h-screen p-6 bg-black-50">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900"><Handshake /> Reconciliator Dashboard</h1>
          <p className="text-slate-600 mt-1">Schedule reconciliation meetings, track progress and record outcomes — realtime.</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => { setEditingRecon(null); reset(); setShowNewModal(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white"
          >
            <CalendarIcon size={16} /> New Meeting
          </button>

          <button
            onClick={loadData}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-white border"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard icon={<Handshake />} label="Total Meetings" value={stats.total} />
        <StatCard icon={<Bell />} label="Open" value={stats.open} />
        <StatCard icon={<CheckCirclePlaceholder />} label="Closed" value={stats.closed} />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Meetings */}
        <section className="lg:col-span-2 space-y-4">
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Upcoming & Recent Meetings</h2>
              <div className="text-sm text-slate-500">{recons.length} total</div>
            </div>

            {loading ? (
              <div className="space-y-2 animate-pulse">
                <div className="h-8 bg-black-200 rounded" />
                <div className="h-8 bg-black-200 rounded" />
              </div>
            ) : recons.length === 0 ? (
              <div className="text-slate-500">No meetings scheduled.</div>
            ) : (
              reconsByDate.orderedKeys.map((key) => (
                <div key={key} className="mb-4">
                  <div className="text-sm font-medium text-slate-700 mb-2">{key}</div>
                  <div className="space-y-2">
                    {reconsByDate.groups[key].sort((a,b) => new Date(a.scheduledAt || 0) - new Date(b.scheduledAt || 0)).map((r) => (
                      <div key={r._id} className="p-3 rounded-md bg-slate-50 flex items-start justify-between">
                        <div>
                          <div className="font-semibold">{r.title}</div>
                          <div className="text-xs text-slate-500 mt-1">{(r.participants || []).join(", ")}</div>
                          <div className="text-xs text-slate-400 mt-1">{r.scheduledAt ? new Date(r.scheduledAt).toLocaleString() : "Unscheduled"}</div>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <div className="flex gap-2">
                            <button onClick={() => joinMeeting(r)} className="px-3 py-1 rounded bg-blue-600 text-white text-xs flex items-center gap-1">
                              <ArrowUpRight size={12} /> Join
                            </button>
                            <button onClick={() => startEdit(r)} className="px-3 py-1 rounded bg-white border text-xs">Edit</button>
                            <button onClick={() => downloadReport(r._id)} className="px-3 py-1 rounded bg-white border text-xs flex items-center gap-1">
                              <Download size={12} /> Report
                            </button>
                          </div>

                          <div className="text-xs text-slate-500">
                            <span className={`px-2 py-1 rounded ${statusBadgeClass(r.status)}`}>{r.status || "open"}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="bg-white p-4 rounded-lg shadow-sm">
            <h3 className="font-semibold mb-2">Progress & Outcomes</h3>
            <p className="text-sm text-slate-600">Record outcomes when a meeting completes — these are tracked and can be exported as reports.</p>
            <div className="mt-3 text-sm">
              <p>To close a meeting, click Edit → change status to "closed" and add the outcome in notes.</p>
            </div>
          </div>
        </section>

        {/* Right: Participants & Notifications */}
        <aside className="space-y-4">
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2"><Users /> Participants</h3>
              <div className="text-sm text-slate-500">{participants.length}</div>
            </div>

            {loading ? (
              <div className="space-y-2 animate-pulse">
                <div className="h-8 bg-black-200 rounded" />
                <div className="h-8 bg-black-200 rounded" />
              </div>
            ) : participants.length === 0 ? (
              <div className="text-slate-500">No participants found</div>
            ) : (
              <ul className="max-h-64 overflow-auto space-y-2 text-sm">
                {participants.map((p) => (
                  <li key={p._id || p.email} className="flex items-center justify-between p-2 rounded hover:bg-slate-50">
                    <div>
                      <div className="font-medium">{p.name || p.fullName || p.email}</div>
                      <div className="text-xs text-slate-500">{p.email || p.phone}</div>
                    </div>
                    <button onClick={() => window.open(`/messages/compose?to=${encodeURIComponent(p._id || p.email)}`, "_blank")} className="text-slate-600">Message</button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-white p-4 rounded-lg shadow-sm">
            <h3 className="font-semibold mb-2">Notifications</h3>
            <p className="text-sm text-slate-500">Live notifications arrive automatically. For persistence, implement /notifications endpoint and fetch here.</p>
          </div>
        </aside>
      </div>

      {/* New/Edit modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{editingRecon ? "Edit Meeting" : "Schedule Meeting"}</h3>
              <button onClick={() => { setShowNewModal(false); setEditingRecon(null); reset(); }} className="p-2 rounded hover:bg-slate-100"><X /></button>
            </div>

            <form onSubmit={handleSubmit(submitRecon)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium">Title</label>
                <input {...register("title")} className="mt-1 w-full rounded-md border p-2" />
                {errors.title && <p className="text-xs text-red-600">{errors.title.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium">Participants (comma-separated identifiers)</label>
                <input {...register("participants")} className="mt-1 w-full rounded-md border p-2" placeholder="Party A, Party B" />
                {errors.participants && <p className="text-xs text-red-600">{errors.participants.message}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium">Date & Time</label>
                  <input {...register("scheduledAt")} type="datetime-local" className="mt-1 w-full rounded-md border p-2" />
                  {errors.scheduledAt && <p className="text-xs text-red-600">{errors.scheduledAt.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium">Duration (minutes)</label>
                  <input {...register("durationMinutes", { valueAsNumber: true })} type="number" min={5} className="mt-1 w-full rounded-md border p-2" />
                  {errors.durationMinutes && <p className="text-xs text-red-600">{errors.durationMinutes.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium">Mode</label>
                  <select {...register("mode")} className="mt-1 w-full rounded-md border p-2">
                    <option value="virtual">Virtual</option>
                    <option value="in-person">In-person</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium">Link or Location (optional)</label>
                  <input {...register("linkOrLocation")} className="mt-1 w-full rounded-md border p-2" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium">Notes</label>
                <textarea {...register("notes")} rows={4} className="mt-1 w-full rounded-md border p-2" />
              </div>

              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => { setShowNewModal(false); setEditingRecon(null); reset(); }} className="px-4 py-2 rounded bg-black-100">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 rounded bg-blue-600 text-white">{isSubmitting ? "Saving..." : (editingRecon ? "Save changes" : "Schedule")}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* small scoped styles */}
      <style jsx>{`
        .reconciliator-dashboard { font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial; }
      `}</style>
    </div>
  );

  /* -- helper components & functions -- */

  function StatCard({ icon, label, value }) {
    return (
      <div className="bg-white p-4 rounded-lg shadow-sm flex items-center gap-4">
        <div className="p-2 bg-blue-50 rounded-md text-blue-600">{icon}</div>
        <div>
          <div className="text-sm text-slate-500">{label}</div>
          <div className="text-2xl font-bold text-slate-900">{value}</div>
        </div>
      </div>
    );
  }

  function statusBadgeClass(status = "") {
    const s = (status || "").toString().toLowerCase();
    if (s.includes("closed")) return "bg-green-100 text-green-800";
    if (s.includes("open")) return "bg-amber-100 text-amber-800";
    if (s.includes("scheduled")) return "bg-blue-100 text-blue-800";
    return "bg-slate-100 text-slate-600";
  }

  function CheckCirclePlaceholder() {
    // small local icon wrapper to avoid extra import duplication in JSX above
    return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-green-600"><path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/></svg>;
  }
}
