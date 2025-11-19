// frontend/src/pages/dashboard/ParalegalDashboard.jsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { io } from "socket.io-client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, Users, ClipboardList, FileText, Bell, X } from "lucide-react";
import API from "@/utils/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

/**
 * ParalegalDashboard
 *
 * Production-ready, real-time dashboard for Paralegals.
 * - Loads clients & tasks via REST
 * - Subscribes to real-time updates via Socket.IO
 * - Inline "New Client" modal with validation
 * - Defensive handling of API shapes and socket payloads
 *
 * Notes:
 * - If your axios instance (API) has baseURL ending with /api, use API.get("/clients") (this file does that).
 * - If API.baseURL is the root (e.g. http://localhost:5000/), change calls to API.get("/api/clients") and API.get("/api/tasks").
 * - A console.info prints API baseURL to help you debug double-/api issues.
 */

const SOCKET_PATH = import.meta.env.VITE_SOCKET_PATH || "/socket.io";
const BACKEND_SOCKET_URL =
  import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || "http://localhost:5000";

const newClientSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Enter a valid email"),
  phone: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export default function ParalegalDashboard() {
  const { user, token: authToken } = useAuth() || {};
  // token fallback keys often used in projects
  const token = authToken || localStorage.getItem("authToken") || localStorage.getItem("token");

  const [clients, setClients] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);
  const [showClientModal, setShowClientModal] = useState(false);

  // react-hook-form + zod
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(newClientSchema),
    defaultValues: { name: "", email: "", phone: "", notes: "" },
  });

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------
  const unwrapArray = (res) => {
    // Accepts axios response or raw arrays; returns an array or []
    if (!res) return [];
    if (Array.isArray(res)) return res;
    if (Array.isArray(res.data)) return res.data;
    if (Array.isArray(res.data?.data)) return res.data.data;
    if (Array.isArray(res.data?.items)) return res.data.items;
    return [];
  };

  // Debug API baseURL to locate double-/api issues
  useEffect(() => {
    try {
      // safe access - API may not be axios (guard)
      console.info("ParalegalDashboard: API baseURL =", API?.defaults?.baseURL ?? "(no baseURL on API instance)");
    } catch (e) {
      // ignore
    }
  }, []);

  // ------------------------------------------------------------------
  // Load initial data
  // ------------------------------------------------------------------
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // If your API instance already attaches the token, headers isn't necessary.
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

      // NOTE: use "/clients" and "/tasks" (not "/api/clients") if your API baseURL already contains /api.
      const [clientsRes, tasksRes] = await Promise.all([
        API.get("/clients", { headers }),
        API.get("/tasks", { headers }),
      ]);

      setClients(unwrapArray(clientsRes));
      setTasks(unwrapArray(tasksRes));
    } catch (err) {
      console.error("Paralegal dashboard load error:", err);
      toast.error(err?.response?.data?.message || "Failed to load dashboard");
      setClients([]);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ------------------------------------------------------------------
  // Socket.IO realtime connection
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!user || !user._id) return;

    const s = io(BACKEND_SOCKET_URL, {
      path: SOCKET_PATH,
      transports: ["websocket"],
      withCredentials: true,
      auth: { token },
      query: { userId: user._id, role: user.role },
    });

    setSocket(s);

    s.on("connect", () => {
      console.info("ParalegalDashboard: connected to socket", s.id);
    });

    s.on("client:created", (client) => {
      if (!client || !client._id) return;
      setClients((prev) => (prev.some((c) => c._id === client._id) ? prev : [client, ...prev]));
      toast.success(`New client: ${client.name}`);
    });

    s.on("task:created", (task) => {
      if (!task || !task._id) return;
      setTasks((prev) => (prev.some((t) => t._id === task._id) ? prev : [task, ...prev]));
      toast.success(`Task assigned: ${task.title}`);
    });

    s.on("task:updated", (task) => {
      if (!task || !task._id) return;
      setTasks((prev) => prev.map((t) => (t._id === task._id ? task : t)));
    });

    s.on("task:deleted", (payload) => {
      // backend may send { id } or full object
      const id = payload?.id || payload?._id || payload;
      if (!id) return;
      setTasks((prev) => prev.filter((t) => t._id !== id));
      toast.success("Task removed");
    });

    s.on("notifications:new", (notification) => {
      toast.info(notification?.message || "New notification");
    });

    s.on("disconnect", (reason) => {
      console.warn("ParalegalDashboard: socket disconnected", reason);
    });

    s.on("connect_error", (err) => {
      console.error("ParalegalDashboard: socket connect_error", err);
      toast.error("Real-time connection error");
    });

    return () => {
      try {
        s.removeAllListeners();
        s.disconnect();
      } catch (e) {
        // swallow
      }
      setSocket(null);
    };
  }, [user, token]);

  // ------------------------------------------------------------------
  // Derived stats
  // ------------------------------------------------------------------
  const stats = useMemo(() => {
    const safeTasks = Array.isArray(tasks) ? tasks : [];
    const todo = safeTasks.filter((t) => {
      const s = (t.status || "").toLowerCase();
      return s.includes("to do") || s === "todo" || s === "open" || s === "pending";
    }).length;
    const inProgress = safeTasks.filter((t) => (t.status || "").toLowerCase().includes("progress")).length;
    const done = safeTasks.filter((t) => {
      const s = (t.status || "").toLowerCase();
      return s.includes("complete") || s.includes("done") || s === "completed";
    }).length;
    return { todo, inProgress, done };
  }, [tasks]);

  // ------------------------------------------------------------------
  // Create client (modal)
  // ------------------------------------------------------------------
  const onCreateClient = async (payload) => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res = await API.post("/clients", payload, { headers }); // note: "/clients" (no double /api)
      const created = res.data?.client || res.data?.data || res.data || res;
      if (created?._id) {
        setClients((prev) => (prev.some((c) => c._id === created._id) ? prev : [created, ...prev]));
      }
      toast.success("Client created");
      reset();
      setShowClientModal(false);
    } catch (err) {
      console.error("Create client failed:", err);
      toast.error(err?.response?.data?.message || "Failed to create client");
      throw err;
    }
  };

  // ------------------------------------------------------------------
  // Task actions
  // ------------------------------------------------------------------
  const markTaskDone = async (taskId) => {
    const prevTasks = tasks;
    // optimistic UI update
    setTasks((prev) => prev.map((t) => (t._id === taskId ? { ...t, status: "completed" } : t)));
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res = await API.put(`/tasks/${taskId}`, { status: "completed" }, { headers }); // note: "/tasks"
      const updated = res.data?.task || res.data || res;
      if (updated?._id) {
        setTasks((prev) => prev.map((t) => (t._id === updated._id ? updated : t)));
      }
      toast.success("Task marked completed");
    } catch (err) {
      console.error("Mark task done failed:", err);
      toast.error(err?.response?.data?.message || "Failed to update task");
      // rollback
      setTasks(prevTasks);
    }
  };

  const assignTask = async (taskId, assigneeId) => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res = await API.put(`/tasks/${taskId}`, { assignedTo: assigneeId }, { headers });
      const updated = res.data?.task || res.data || res;
      if (updated?._id) {
        setTasks((prev) => prev.map((t) => (t._id === updated._id ? updated : t)));
      }
      toast.success("Task reassigned");
    } catch (err) {
      console.error("Assign task failed:", err);
      toast.error("Failed to assign task");
    }
  };

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <div className="paralegal-dashboard min-h-screen p-6 bg-slate-50">
      {/* New Client Modal */}
      {showClientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Create New Client</h3>
              <button
                onClick={() => setShowClientModal(false)}
                className="p-1 rounded hover:bg-slate-100"
                aria-label="Close"
              >
                <X />
              </button>
            </div>

            <form onSubmit={handleSubmit(onCreateClient)} className="space-y-4" noValidate>
              <div>
                <label className="block text-sm font-medium">Full name</label>
                <input
                  {...register("name")}
                  className="mt-1 w-full rounded-md border border-slate-200 shadow-sm p-2"
                  placeholder="Jane Doe"
                  aria-invalid={!!errors.name}
                />
                {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium">Email</label>
                <input
                  {...register("email")}
                  type="email"
                  className="mt-1 w-full rounded-md border border-slate-200 shadow-sm p-2"
                  placeholder="client@example.com"
                  aria-invalid={!!errors.email}
                />
                {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium">Phone</label>
                <input
                  {...register("phone")}
                  type="tel"
                  className="mt-1 w-full rounded-md border border-slate-200 shadow-sm p-2"
                  placeholder="+2547..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium">Notes (optional)</label>
                <textarea
                  {...register("notes")}
                  rows={3}
                  className="mt-1 w-full rounded-md border border-slate-200 shadow-sm p-2"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowClientModal(false)} className="px-4 py-2 rounded-md bg-slate-100">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 rounded-md bg-blue-600 text-white">
                  {isSubmitting ? "Creating..." : "Create Client"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">Paralegal Dashboard</h1>
          <p className="text-slate-600 mt-1">Client intake, tasks, and document prep — live.</p>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => setShowClientModal(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white">
            <Plus size={16} /> New Client
          </button>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-sm flex items-center gap-4">
          <div className="p-2 bg-blue-50 rounded-md text-blue-600"><ClipboardList /></div>
          <div>
            <p className="text-sm text-slate-500">To Do</p>
            <p className="text-2xl font-bold">{loading ? "—" : stats.todo}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm flex items-center gap-4">
          <div className="p-2 bg-amber-50 rounded-md text-amber-600"><FileText /></div>
          <div>
            <p className="text-sm text-slate-500">In Progress</p>
            <p className="text-2xl font-bold">{loading ? "—" : stats.inProgress}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm flex items-center gap-4">
          <div className="p-2 bg-green-50 rounded-md text-green-600"><Users /></div>
          <div>
            <p className="text-sm text-slate-500">Completed</p>
            <p className="text-2xl font-bold">{loading ? "—" : stats.done}</p>
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tasks area */}
        <section className="lg:col-span-2 space-y-4">
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">All Tasks</h2>
              <div className="text-sm text-slate-500">{Array.isArray(tasks) ? tasks.length : 0}</div>
            </div>

            <div>
              {loading ? (
                <div className="animate-pulse space-y-2">
                  <div className="h-8 bg-slate-200 rounded" />
                  <div className="h-8 bg-slate-200 rounded" />
                  <div className="h-8 bg-slate-200 rounded" />
                </div>
              ) : !Array.isArray(tasks) || tasks.length === 0 ? (
                <div className="text-center text-slate-500">No tasks assigned</div>
              ) : (
                <ul className="space-y-2">
                  {tasks.map((t) => (
                    <li key={t._id} className="flex items-center justify-between p-3 rounded bg-slate-50">
                      <div>
                        <div className="font-medium">{t.title}</div>
                        <div className="text-xs text-slate-500">{t.description}</div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div
                          className={`px-2 py-1 text-xs rounded ${
                            ((t.status || "").toLowerCase().includes("progress"))
                              ? "bg-amber-100"
                              : ((t.status || "").toLowerCase().includes("done") ? "bg-green-100" : "bg-slate-100")
                          }`}
                        >
                          {t.status || "Open"}
                        </div>
                        <button onClick={() => markTaskDone(t._id)} className="px-3 py-1 rounded bg-white border hover:shadow">
                          Mark Done
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Documents / Evidence / Notes */}
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Documents & Evidence</h2>
              <div className="text-sm text-slate-500">Manage uploads & templates</div>
            </div>

            <div className="text-slate-600">
              <p className="mb-2">This section links to the document vault, template automation, and evidence uploader. Use the Documents area to draft templates requested by advocates and attach to cases.</p>
              <div className="flex gap-3">
                <button className="px-3 py-2 rounded bg-blue-50 text-blue-700">Open Document Vault</button>
                <button className="px-3 py-2 rounded bg-slate-100">Upload Evidence</button>
              </div>
            </div>
          </div>
        </section>

        {/* Clients & Notifications */}
        <aside className="space-y-4">
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Clients</h3>
              <button onClick={() => setShowClientModal(true)} className="text-sm text-blue-600">+ New</button>
            </div>

            <div>
              {loading ? (
                <div className="animate-pulse space-y-2">
                  <div className="h-8 bg-slate-200 rounded" />
                  <div className="h-8 bg-slate-200 rounded" />
                </div>
              ) : !Array.isArray(clients) || clients.length === 0 ? (
                <div className="text-slate-500">No clients yet</div>
              ) : (
                <ul className="space-y-2 max-h-72 overflow-auto">
                  {clients.map((c) => (
                    <li key={c._id} className="flex items-center justify-between p-2 rounded hover:bg-slate-50">
                      <div>
                        <div className="font-medium">{c.name}</div>
                        <div className="text-xs text-slate-500">{c.email}</div>
                      </div>
                      <div className="text-xs text-slate-500">{c.phone || "-"}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Notifications</h3>
              <div className="text-sm text-slate-500">Real-time</div>
            </div>

            <div className="space-y-2 max-h-48 overflow-auto text-slate-700">
              <p className="text-sm text-slate-500">New notifications appear as they arrive.</p>
            </div>
          </div>
        </aside>
      </div>

      <style jsx>{`
        .paralegal-dashboard {
          font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
        }
      `}</style>
    </div>
  );
}
