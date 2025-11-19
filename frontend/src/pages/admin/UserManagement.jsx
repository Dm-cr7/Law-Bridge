// frontend/src/pages/admin/UserManagement.jsx
import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import API from "../../utils/api";
import { useAuth } from "../../context/AuthContext";
import { toast } from "sonner";
import { motion as Motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Users,
  Search,
  Plus,
  Edit2,
  Trash2,
  Download,
  Check,
  X,
  RefreshCcw,
  Lock,
} from "lucide-react";

/**
 * Admin User Management
 *
 * Endpoints expected:
 * GET    /users?search=&role=&status=&page=&limit=&sort=
 * POST   /users
 * GET    /users/:id
 * PUT    /users/:id
 * PUT    /users/:id/status    -> { active: true|false }
 * POST   /users/:id/reset-password -> triggers reset (email or return token)
 * DELETE /users/:id (optional)
 *
 * Socket events:
 * user:created, user:updated, user:statusChanged
 */

const SOCKET_PATH = import.meta.env.VITE_SOCKET_PATH || "/socket.io";
const BACKEND_SOCKET_URL =
  import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || "http://localhost:5000";

// Roles that exist in the system
const ROLE_OPTIONS = [
  { value: "advocate", label: "Advocate" },
  { value: "paralegal", label: "Paralegal" },
  { value: "arbitrator", label: "Arbitrator" },
  { value: "reconciliator", label: "Reconciliator" },
  { value: "admin", label: "Admin" },
  { value: "client", label: "Client" },
];

// Validation schema for create/edit
const userSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Enter a valid email"),
  role: z.enum(["advocate","paralegal","arbitrator","reconciliator","admin","client"]),
  password: z.string().min(6).optional(),
  active: z.boolean().optional(),
});

export default function UserManagement() {
  const { user: me } = useAuth();
  const socketRef = useRef(null);

  // UI state
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  // Query state (server-friendly)
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState(""); // "active" | "inactive" | ""
  const [sort, setSort] = useState("createdAt:desc");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  // Selection / bulk
  const [selected, setSelected] = useState(new Set());
  const [selectAllOnPage, setSelectAllOnPage] = useState(false);

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // local cache ref to avoid stale closures on socket events
  const usersRef = useRef(users);
  useEffect(() => { usersRef.current = users; }, [users]);

  // Socket: real-time updates
  useEffect(() => {
    if (!me) return;

    const s = io(BACKEND_SOCKET_URL, {
      path: SOCKET_PATH,
      transports: ["websocket"],
      withCredentials: true,
      auth: { token: localStorage.getItem("token") },
      query: { userId: me._id, role: me.role },
    });

    socketRef.current = s;
    s.on("connect", () => console.info("Admin socket connected", s.id));
    s.on("user:created", (payload) => {
      // Prepend created user if it matches current filters (simple check)
      setUsers((prev) => [payload, ...prev]);
      setTotal((t) => t + 1);
      toast.success(`User created: ${payload.name}`);
    });
    s.on("user:updated", (payload) => {
      setUsers((prev) => prev.map((u) => (u._id === payload._id ? payload : u)));
      toast.success(`User updated: ${payload.name}`);
    });
    s.on("user:statusChanged", ({ id, active }) => {
      setUsers((prev) => prev.map((u) => (u._id === id ? { ...u, active } : u)));
      toast.success(`User ${active ? "activated" : "deactivated"}`);
    });

    s.on("disconnect", () => console.warn("Admin socket disconnected"));

    return () => {
      s.removeAllListeners();
      s.disconnect();
      socketRef.current = null;
    };
  }, [me]);

  // Fetch users (server-side pagination)
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        search: search || undefined,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
        page,
        limit,
        sort,
      };
      const res = await API.get("/users", { params });
      // Expect response shape { data: [...], total, page, limit }
      const data = res.data;
      setUsers(Array.isArray(data.data) ? data.data : data);
      setTotal(data.total ?? (Array.isArray(data.data) ? data.data.length : 0));
      setSelected(new Set());
      setSelectAllOnPage(false);
    } catch (err) {
      console.error("Failed to load users", err);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, statusFilter, page, limit, sort]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Pagination controls
  const totalPages = Math.max(1, Math.ceil(total / limit));

  // Selection helpers
  const toggleSelect = (id) => {
    setSelected((prev) => {
      const copy = new Set(prev);
      if (copy.has(id)) copy.delete(id);
      else copy.add(id);
      return copy;
    });
  };

  const toggleSelectAllOnPage = () => {
    if (selectAllOnPage) {
      setSelected(new Set());
      setSelectAllOnPage(false);
      return;
    }
    const ids = users.map((u) => u._id);
    setSelected(new Set(ids));
    setSelectAllOnPage(true);
  };

  // Create / edit forms (react-hook-form + zod)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(userSchema),
    defaultValues: { name: "", email: "", role: "paralegal", password: "", active: true },
  });

  useEffect(() => {
    if (editingUser) {
      reset({
        name: editingUser.name,
        email: editingUser.email,
        role: editingUser.role,
        password: "",
        active: editingUser.active ?? true,
      });
    } else {
      reset({
        name: "",
        email: "",
        role: "paralegal",
        password: "",
        active: true,
      });
    }
  }, [editingUser, reset]);

  // Create user
  const onCreate = async (vals) => {
    setSubmitting(true);
    try {
      const payload = { ...vals };
      // If password empty, let backend decide (e.g., send invite email)
      if (!payload.password) delete payload.password;
      const res = await API.post("/users", payload);
      // Backend ideally emits socket event — but optimistically prepend
      setUsers((prev) => [res.data, ...prev]);
      setTotal((t) => t + 1);
      setShowCreate(false);
      toast.success("User created");
    } catch (err) {
      console.error("Create failed", err);
      toast.error(err?.response?.data?.message || "Failed to create user");
    } finally {
      setSubmitting(false);
    }
  };

  // Update user
  const onUpdate = async (vals) => {
    if (!editingUser) return;
    setSubmitting(true);
    try {
      const payload = { name: vals.name, email: vals.email, role: vals.role, active: vals.active };
      // Password update is separate - backend might support password in put; if provided, include
      if (vals.password) payload.password = vals.password;
      const res = await API.put(`/users/${editingUser._id}`, payload);
      setUsers((prev) => prev.map((u) => (u._id === res.data._id ? res.data : u)));
      setEditingUser(null);
      toast.success("User updated");
    } catch (err) {
      console.error("Update failed", err);
      toast.error(err?.response?.data?.message || "Failed to update user");
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle active status for single user (activate/deactivate)
  const toggleActive = async (u) => {
    const confirmMsg = u.active ? `Deactivate ${u.name}?` : `Reactivate ${u.name}?`;
    if (!window.confirm(confirmMsg)) return;
    try {
      await API.put(`/users/${u._id}/status`, { active: !u.active });
      setUsers((prev) => prev.map((x) => (x._id === u._1d ? { ...x, active: !x.active } : x)));
      // fetch to be safe
      fetchUsers();
    } catch (err) {
      console.error("Toggle status failed", err);
      toast.error("Failed to change user status");
    }
  };

  // Bulk actions
  const bulkDeactivate = async () => {
    if (selected.size === 0) return toast.warning("No users selected");
    if (!window.confirm(`Deactivate ${selected.size} users?`)) return;
    try {
      const ids = Array.from(selected);
      await API.put("/users/bulk/status", { ids, active: false });
      toast.success("Users deactivated");
      fetchUsers();
    } catch (err) {
      console.error("Bulk deactivate failed", err);
      toast.error("Bulk deactivation failed");
    }
  };

  const bulkReactivate = async () => {
    if (selected.size === 0) return toast.warning("No users selected");
    if (!window.confirm(`Reactivate ${selected.size} users?`)) return;
    try {
      const ids = Array.from(selected);
      await API.put("/users/bulk/status", { ids, active: true });
      toast.success("Users reactivated");
      fetchUsers();
    } catch (err) {
      console.error("Bulk reactivate failed", err);
      toast.error("Bulk reactivation failed");
    }
  };

  const bulkExportCSV = () => {
    if (selected.size === 0) return toast.warning("No users selected");
    const selectedUsers = usersRef.current.filter((u) => selected.has(u._id));
    const csv = convertToCSV(selectedUsers);
    downloadBlob(csv, "users-export.csv", "text/csv");
  };

  // Reset password (admin action) for a user
  const resetPassword = async (u) => {
    if (!window.confirm(`Send password reset for ${u.email}?`)) return;
    try {
      await API.post(`/users/${u._id}/reset-password`);
      toast.success("Password reset requested (email sent)");
    } catch (err) {
      console.error("Reset password failed", err);
      toast.error("Failed to request password reset");
    }
  };

  // Export all (current search result) to CSV
  const exportAll = async () => {
    try {
      // If server has a CSV export endpoint, prefer it; otherwise export client-side
      const res = await API.get("/users/export", { params: { search, role: roleFilter, status: statusFilter }, responseType: "blob" });
      // If backend returned a CSV blob:
      if (res.data) {
        const filename = `users-export-${new Date().toISOString().slice(0,10)}.csv`;
        downloadBlob(res.data, filename, "text/csv");
        return;
      }
    } catch (_) {
      // fallback to client-side CSV of currently loaded users
      const csv = convertToCSV(usersRef.current);
      downloadBlob(csv, `users-export-${new Date().toISOString().slice(0,10)}.csv`, "text/csv");
    }
  };

  // Helper: download blob / text
  function downloadBlob(content, filename, mime = "text/plain") {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // Helper CSV converter (simple)
  function convertToCSV(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return "";
    const keys = ["_id","name","email","role","active","createdAt"];
    const lines = [keys.join(",")];
    for (const it of arr) {
      const row = keys.map((k) => {
        let v = it[k] ?? "";
        if (v === true) v = "true";
        if (v === false) v = "false";
        // escape quotes
        return `"${String(v).replace(/"/g, '""')}"`;
      });
      lines.push(row.join(","));
    }
    return lines.join("\n");
  }

  // Utility: safe sort toggles
  const toggleSort = (field) => {
    const [f, dir] = sort.split(":");
    if (f === field) {
      setSort(`${field}:${dir === "desc" ? "asc" : "desc"}`);
    } else {
      setSort(`${field}:desc`);
    }
  };

  // Render
  return (
    <div className="min-h-screen p-6 bg-black-50">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 rounded text-blue-600">
              <Users size={26} />
            </div>
            <div>
              <h1 className="text-2xl font-bold">User Management</h1>
              <p className="text-sm text-slate-500">Create, edit, and manage platform users in real time.</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => { setShowCreate(true); setEditingUser(null); }} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded">
              <Plus size={16} /> Create user
            </button>
            <button onClick={fetchUsers} className="inline-flex items-center gap-2 px-3 py-2 bg-white border rounded">
              <RefreshCcw size={16} /> Refresh
            </button>
          </div>
        </div>

        {/* Filters / Search */}
        <div className="bg-white p-4 rounded mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-2 w-full md:w-1/2">
            <Search />
            <input
              aria-label="Search users"
              placeholder="Search by name, email..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div className="flex items-center gap-2">
            <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }} className="border rounded px-2 py-2">
              <option value="">All roles</option>
              {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>

            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="border rounded px-2 py-2">
              <option value="">All status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }} className="border rounded px-2 py-2">
              <option value={10}>10 / page</option>
              <option value={20}>20 / page</option>
              <option value={50}>50 / page</option>
            </select>

            <button onClick={exportAll} title="Export current list (server-side if available)" className="px-3 py-2 bg-white border rounded inline-flex items-center gap-2">
              <Download size={16} /> Export
            </button>
          </div>
        </div>

        {/* Bulk actions */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={selectAllOnPage} onChange={toggleSelectAllOnPage} />
              <span className="text-sm">Select all on page</span>
            </label>

            <div className="flex gap-2">
              <button onClick={bulkDeactivate} className="px-3 py-2 bg-red-600 text-white rounded inline-flex items-center gap-2"><Trash2 size={14} /> Deactivate</button>
              <button onClick={bulkReactivate} className="px-3 py-2 bg-green-600 text-white rounded inline-flex items-center gap-2"><Check size={14} /> Reactivate</button>
              <button onClick={bulkExportCSV} className="px-3 py-2 bg-white border rounded inline-flex items-center gap-2"><Download size={14} /> Export CSV</button>
            </div>
          </div>

          <div className="text-sm text-slate-500">{total} users</div>
        </div>

        {/* Table */}
        <div className="bg-white rounded shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="p-2"><input type="checkbox" checked={selected.size === users.length && users.length > 0} onChange={() => {
                  if (selected.size === users.length) setSelected(new Set());
                  else setSelected(new Set(users.map(u => u._id)));
                }} /></th>
                <th className="p-2 text-left cursor-pointer" onClick={() => toggleSort("name")}>Name</th>
                <th className="p-2 text-left cursor-pointer" onClick={() => toggleSort("email")}>Email</th>
                <th className="p-2 text-left">Role</th>
                <th className="p-2 text-left cursor-pointer" onClick={() => toggleSort("createdAt")}>Created</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="p-6 text-center">Loading users...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={7} className="p-6 text-center">No users found</td></tr>
              ) : users.map((u) => (
                <tr key={u._id} className="border-b last:border-0 hover:bg-slate-50">
                  <td className="p-2"><input checked={selected.has(u._id)} onChange={() => toggleSelect(u._id)} type="checkbox" /></td>
                  <td className="p-2">
                    <div className="font-medium">{u.name}</div>
                    <div className="text-xs text-slate-500">{u.email}</div>
                  </td>
                  <td className="p-2">{u.email}</td>
                  <td className="p-2">{u.role}</td>
                  <td className="p-2">{new Date(u.createdAt).toLocaleString()}</td>
                  <td className="p-2">
                    {u.active ? <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">Active</span> : <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs">Inactive</span>}
                  </td>
                  <td className="p-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button title="Edit" onClick={() => { setEditingUser(u); setShowCreate(true); }} className="px-2 py-1 bg-white border rounded inline-flex items-center gap-1"><Edit2 size={14} /></button>
                      <button title="Reset password" onClick={() => resetPassword(u)} className="px-2 py-1 bg-white border rounded inline-flex items-center gap-1"><Lock size={14} /></button>
                      <button title={u.active ? "Deactivate" : "Reactivate"} onClick={() => toggleActive(u)} className={`px-2 py-1 rounded inline-flex items-center gap-1 ${u.active ? "bg-red-600 text-white" : "bg-green-600 text-white"}`}>
                        {u.active ? <Trash2 size={14}/> : <Check size={14}/>}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-slate-500">Page {page} of {totalPages}</div>
          <div className="flex items-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-3 py-1 border rounded">Prev</button>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="px-3 py-1 border rounded">Next</button>
          </div>
        </div>

        {/* Create / Edit Modal */}
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <Motion.div initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">{editingUser ? "Edit user" : "Create user"}</h3>
                <button onClick={() => { setShowCreate(false); setEditingUser(null); }} className="p-2 rounded hover:bg-slate-100"><X /></button>
              </div>

              <form onSubmit={handleSubmit(editingUser ? onUpdate : onCreate)} className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Full name</label>
                  <input {...register("name")} className="w-full border rounded px-3 py-2" />
                  {errors.name && <div className="text-xs text-red-600 mt-1">{errors.name.message}</div>}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <input {...register("email")} className="w-full border rounded px-3 py-2" />
                  {errors.email && <div className="text-xs text-red-600 mt-1">{errors.email.message}</div>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Role</label>
                    <select {...register("role")} className="w-full border rounded px-3 py-2">
                      {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                    {errors.role && <div className="text-xs text-red-600 mt-1">{errors.role.message}</div>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Active</label>
                    <label className="inline-flex items-center gap-2">
                      <input type="checkbox" {...register("active")} />
                      <span className="text-sm">Active</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">{editingUser ? "Reset password (optional)" : "Password"}</label>
                  <input {...register("password")} type="password" placeholder={editingUser ? "Leave blank to keep current password" : ""} className="w-full border rounded px-3 py-2" />
                  {errors.password && <div className="text-xs text-red-600 mt-1">{errors.password.message}</div>}
                </div>

                <div className="flex justify-end gap-3 mt-4">
                  <button type="button" onClick={() => { setShowCreate(false); setEditingUser(null); }} className="px-4 py-2 rounded bg-black-100">Cancel</button>
                  <button type="submit" disabled={submitting} className="px-4 py-2 rounded bg-blue-600 text-white">
                    {submitting ? "Saving..." : (editingUser ? "Save changes" : "Create")}
                  </button>
                </div>
              </form>
            </Motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
