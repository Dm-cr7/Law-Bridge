// frontend/src/pages/Clients.jsx
import React, { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import {
  Plus,
  X,
  Pencil,
  Trash2,
  UserPlus2,
  Mail,
  Users,
  CheckSquare,
  Square,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import API from "@/utils/api"; // shared axios instance used across the app
import { useAuth } from "@/context/AuthContext";

/* ===========================================================
   Small reusable UI pieces (Button, Modal, FormField)
   =========================================================== */

const Button = ({ children, variant = "primary", className = "", ...props }) => {
  const styles = {
    primary: "bg-blue-600 hover:bg-blue-700 text-white",
    secondary: "bg-gray-100 hover:bg-gray-200 text-black",
    danger: "bg-red-600 hover:bg-red-700 text-white",
  };
  return (
    <button
      {...props}
      className={`px-4 py-2 rounded-md text-sm font-medium transition ${styles[variant] || styles.primary} ${className}`}
    >
      {children}
    </button>
  );
};

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="p-2 rounded hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

const FormField = ({ label, name, register, type = "text", error, required = false, defaultValue }) => (
  <div>
    <label className="block text-sm font-medium mb-1">
      {label}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
    <input
      {...(register ? register(name) : {})}
      name={name}
      type={type}
      defaultValue={defaultValue}
      className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
    {error && <p className="text-xs text-red-600 mt-1">{error.message || error}</p>}
  </div>
);

/* ===========================================================
   Helper: Normalize API response into an array
   - Accepts many shapes: [] | { data: [] } | { items: [] } | { clients: [] } | { client: {...} } | single object
   =========================================================== */
function normalizeToArray(res) {
  if (!res) return [];
  const payload = res?.data ?? res;

  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.clients)) return payload.clients;

  // If single client object returned
  if (payload?.client && typeof payload.client === "object") return [payload.client];

  // If payload looks like a client object
  if (payload && typeof payload === "object") {
    const likelyClientKeys = ["_id", "email", "name", "firstName", "lastName"];
    if (likelyClientKeys.some((k) => Object.prototype.hasOwnProperty.call(payload, k))) {
      return [payload];
    }
  }

  return [];
}

/* ===========================================================
   New Client Modal
   - posts to POST /api/clients
   - calls onCreated(client) with normalized client object
   =========================================================== */
const NewClientModal = ({ isOpen, onClose, onCreated }) => {
  const { register, handleSubmit, reset, formState } = useForm();
  const { isSubmitting } = formState;

  useEffect(() => {
    if (!isOpen) reset();
  }, [isOpen, reset]);

  const onSubmit = async (data) => {
    try {
      const res = await API.post("/clients", data);
      const created = (res?.data?.client) ? res.data.client : (res?.data ?? res);
      const clients = normalizeToArray(created);
      const client = clients[0] || created;
      toast.success(`Client ${client?.name || "(unnamed)"} created`);
      onCreated(client);
      reset();
      onClose();
    } catch (err) {
      console.error("Create client failed:", err);
      toast.error(err?.response?.data?.message || "Failed to create client");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Client">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormField label="Full name" name="name" register={register} required />
        <FormField label="Email" name="email" register={register} type="email" />
        <FormField label="Phone" name="phone" register={register} />
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
          <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Creating..." : "Create Client"}</Button>
        </div>
      </form>
    </Modal>
  );
};

/* ===========================================================
   Edit Client Modal
   - PUT /api/clients/:id
   - calls onUpdated(updatedClient)
   =========================================================== */
const EditClientModal = ({ isOpen, onClose, client, onUpdated }) => {
  const { register, handleSubmit, reset, formState } = useForm({ defaultValues: client || {} });
  const { isSubmitting } = formState;

  useEffect(() => {
    if (client) reset(client);
  }, [client, reset]);

  if (!client) return null;

  const onSubmit = async (data) => {
    try {
      const res = await API.put(`/clients/${client._id}`, data);
      const updated = res?.data ?? res;
      onUpdated(updated);
      toast.success("Client updated");
      onClose();
    } catch (err) {
      console.error("Update client error:", err);
      toast.error(err?.response?.data?.message || "Failed to update client");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Client">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormField label="Full name" name="name" register={register} />
        <FormField label="Email" name="email" register={register} type="email" />
        <FormField label="Phone" name="phone" register={register} />
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
          <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Save Changes"}</Button>
        </div>
      </form>
    </Modal>
  );
};

/* ===========================================================
   Delete Client Modal
   - DELETE /api/clients/:id (soft delete)
   =========================================================== */
const DeleteClientModal = ({ isOpen, onClose, client, onDeleted }) => {
  if (!client) return null;

  const handleDelete = async () => {
    try {
      await API.delete(`/clients/${client._id}`);
      toast.success("Client deleted");
      onDeleted(client._id);
      onClose();
    } catch (err) {
      console.error("Delete client failed:", err);
      toast.error(err?.response?.data?.message || "Failed to delete client");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Client">
      <p>Are you sure you want to delete <strong>{client.name}</strong>? This action is reversible by admins.</p>
      <div className="flex justify-end gap-2 mt-4">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="danger" onClick={handleDelete}>Delete</Button>
      </div>
    </Modal>
  );
};

/* ===========================================================
   Share Client Modal
   - PATCH /api/clients/:id/share
   =========================================================== */
const ShareClientModal = ({ isOpen, onClose, client, onShared }) => {
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let mounted = true;
    setLoading(true);
    API.get("/users")
      .then((res) => {
        const data = res?.data ?? [];
        if (mounted) {
          const others = data.filter((u) => u._id !== client?.createdBy?._id);
          setUsers(others);
          setSelected((client?.sharedWith || []).map((u) => (typeof u === "string" ? u : u._id)));
        }
      })
      .catch((err) => {
        console.error("Load users for sharing failed:", err);
        toast.error("Failed to load users");
      })
      .finally(() => mounted && setLoading(false));
    return () => (mounted = false);
  }, [isOpen, client]);

  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const saveShare = async () => {
    try {
      setSaving(true);
      const res = await API.patch(`/clients/${client._id}/share`, { userIds: selected });
      toast.success("Client shared");
      onShared(res.data);
      onClose();
    } catch (err) {
      console.error("Share failed:", err);
      toast.error(err?.response?.data?.message || "Failed to share client");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Share "${client?.name}"`}>
      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="animate-spin" /></div>
      ) : users.length === 0 ? (
        <p>No other users available to share with.</p>
      ) : (
        <div className="max-h-64 overflow-auto divide-y">
          {users.map((u) => {
            const id = u._id;
            const isSel = selected.includes(id);
            return (
              <div key={id} className="flex items-center justify-between p-3">
                <div>
                  <div className="font-medium">{u.name}</div>
                  <div className="text-xs text-gray-500">{u.role} • {u.email}</div>
                </div>
                <button onClick={() => toggle(id)} className="p-2">
                  {isSel ? <CheckSquare className="text-blue-600" /> : <Square />}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex justify-end gap-2 mt-4">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={saveShare} disabled={saving}>{saving ? "Saving..." : "Share"}</Button>
      </div>
    </Modal>
  );
};

/* ===========================================================
   Main Clients Page Component
   =========================================================== */
export default function Clients() {
  const { user } = useAuth();
  const [clients, setClients] = useState([]); // always array
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showNewModal, setShowNewModal] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [deletingClient, setDeletingClient] = useState(null);
  const [sharingClient, setSharingClient] = useState(null);

  const loadClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await API.get("/clients");
      const arr = normalizeToArray(res);
      setClients(arr);
    } catch (err) {
      console.error("Load clients error:", err);
      setError(err?.response?.data?.message || "Failed to load clients");
      toast.error(err?.response?.data?.message || "Failed to load clients");
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const handleClientCreated = (client) => setClients((prev) => [client, ...prev]);
  const handleClientUpdated = (updated) => setClients((prev) => prev.map((c) => (c._id === updated._id ? updated : c)));
  const handleClientDeleted = (id) => setClients((prev) => prev.filter((c) => c._id !== id));

  return (
    <div className="p-6 min-h-screen bg-slate-50">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Client Management</h1>
          <p className="text-sm text-gray-600">Manage clients, linked accounts and sharing.</p>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={() => setShowNewModal(true)} className="inline-flex items-center gap-2">
            <Plus size={14} /> New Client
          </Button>
          <Button variant="secondary" onClick={loadClients}>Refresh</Button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="py-3 px-4 font-medium">Name</th>
              <th className="py-3 px-4 font-medium">Email</th>
              <th className="py-3 px-4 font-medium">Phone</th>
              <th className="py-3 px-4 font-medium">Intaked By</th>
              <th className="py-3 px-4 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-gray-500">Loading...</td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-red-500">{error}</td>
              </tr>
            ) : clients.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-gray-500">No clients found</td>
              </tr>
            ) : (
              clients.map((client) => {
                const createdBy = client?.createdBy ? (typeof client.createdBy === "string" ? client.createdBy : (client.createdBy.name || client.createdBy.email)) : "-";
                return (
                  <tr key={client._id} className="border-t hover:bg-gray-50">
                    <td className="py-3 px-4">{client.name || `${client.firstName || ""} ${client.lastName || ""}`.trim() || "(Unnamed)"}</td>
                    <td className="py-3 px-4 flex items-center gap-2 text-gray-700"><Mail size={14} /> {client.email || "-"}</td>
                    <td className="py-3 px-4 text-gray-700">{client.phone || client.primaryPhone || "-"}</td>
                    <td className="py-3 px-4 text-gray-600">{createdBy}</td>
                    <td className="py-3 px-4 text-right space-x-3">
                      <button onClick={() => setSharingClient(client)} className="text-green-600 hover:underline inline-flex items-center gap-1"><Users size={14} /> Share</button>
                      <button onClick={() => setEditingClient(client)} className="text-blue-600 hover:underline inline-flex items-center gap-1"><Pencil size={14} /> Edit</button>
                      <button onClick={() => setDeletingClient(client)} className="text-red-600 hover:underline inline-flex items-center gap-1"><Trash2 size={14} /> Delete</button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      <NewClientModal isOpen={showNewModal} onClose={() => setShowNewModal(false)} onCreated={handleClientCreated} />
      {editingClient && <EditClientModal isOpen={!!editingClient} client={editingClient} onClose={() => setEditingClient(null)} onUpdated={handleClientUpdated} />}
      {deletingClient && <DeleteClientModal isOpen={!!deletingClient} client={deletingClient} onClose={() => setDeletingClient(null)} onDeleted={handleClientDeleted} />}
      {sharingClient && <ShareClientModal isOpen={!!sharingClient} client={sharingClient} onClose={() => setSharingClient(null)} onShared={(updated) => { handleClientUpdated(updated); setSharingClient(null); }} />}
    </div>
  );
}
