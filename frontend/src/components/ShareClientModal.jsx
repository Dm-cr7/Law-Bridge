import React, { useEffect, useState } from "react";
import { X, Share2, Users, Loader2, CheckSquare, Square } from "lucide-react";
import { toast } from "sonner";
import API from "../api/axios";

/* ==========================================================
   SHARE CLIENT ACCESS MODAL
   ========================================================== */

export default function ShareClientModal({ isOpen, onClose, client, token, onShared }) {
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  /* Fetch users when modal opens */
  useEffect(() => {
    if (isOpen && token) {
      setLoading(true);
      API.get("/users", {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => {
          setUsers(res.data.filter((u) => u._id !== client?.createdBy?._id));
          const sharedIds = client?.sharedWith?.map((u) => u._id) || [];
          setSelected(sharedIds);
        })
        .catch((err) => {
          console.error(err);
          toast.error("Failed to load users");
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, token, client]);

  /* Toggle user selection */
  const toggleUser = (userId) => {
    setSelected((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  /* Share access */
  const handleShare = async () => {
    try {
      setSaving(true);
      const res = await API.patch(
        `/clients/${client._id}/share`,
        { userIds: selected },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success("👥 Client access shared successfully");
      onShared?.(res.data);
      onClose();
    } catch (err) {
      console.error("❌ Share client error:", err);
      toast.error(err.response?.data?.message || "Failed to share client");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  /* ==========================================================
     🎨 UI
     ========================================================== */
  return (
    <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative animate-fadeIn">
        {/* Header */}
        <div className="flex justify-between items-center mb-4 border-b pb-2">
          <div className="flex items-center gap-2">
            <Share2 className="text-blue-600" size={20} />
            <h3 className="text-lg font-semibold text-black-800">
              Share Client Access
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-black-100 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Client Info */}
        <div className="mb-4">
          <p className="text-sm text-black-700">
            Sharing access for:{" "}
            <strong className="text-black-900">{client?.name}</strong>
          </p>
          <p className="text-xs text-black-500 mt-1">{client?.email}</p>
        </div>

        {/* User List */}
        <div className="border rounded-md max-h-64 overflow-y-auto divide-y divide-black-100">
          {loading ? (
            <div className="flex justify-center py-6 text-black-500">
              <Loader2 className="animate-spin w-5 h-5" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-sm text-black-500 text-center py-4">
              No other users available to share with.
            </p>
          ) : (
            users.map((user) => (
              <label
                key={user._id}
                className="flex items-center justify-between p-3 cursor-pointer hover:bg-black-50 transition"
                onClick={() => toggleUser(user._id)}
              >
                <div>
                  <p className="text-sm font-medium text-black-800">
                    {user.name}
                  </p>
                  <p className="text-xs text-black-500">
                    {user.role} — {user.email}
                  </p>
                </div>
                {selected.includes(user._id) ? (
                  <CheckSquare className="text-blue-600" size={18} />
                ) : (
                  <Square className="text-black-400" size={18} />
                )}
              </label>
            ))
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md bg-black-100 text-black-800 hover:bg-black-200 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleShare}
            disabled={saving}
            className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition flex items-center gap-2"
          >
            {saving && <Loader2 className="animate-spin w-4 h-4" />}
            {saving ? "Saving..." : "Share Access"}
          </button>
        </div>
      </div>

      {/* Animation */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.96);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.25s ease-out;
        }
      `}</style>
    </div>
  );
}
