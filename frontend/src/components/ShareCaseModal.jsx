/**
 * ShareCaseModal.jsx
 * ------------------------------------------------------------
 * Purpose:
 *   Allows the case owner or admin to share case access
 *   with other registered users.
 *
 * Features:
 *   ✅ Fetch all users (excludes current user)
 *   ✅ Search and select users
 *   ✅ PATCH to /api/cases/:id/share
 *   ✅ UI polish + error handling
 * ------------------------------------------------------------
 */

import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { XCircle, Users } from "lucide-react";
import toast from "react-hot-toast";
import axios from "@/utils/axiosInstance";
import { useAuth } from "@/context/AuthContext";

export default function ShareCaseModal({ caseData, onClose, onShared }) {
  const { user, token } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState(
    caseData?.sharedWith?.map((u) => u._id) || []
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef(null);

  const isOwner =
    String(caseData?.filedBy?._id || caseData?.filedBy) === String(user?._id);

  /* =======================================================
     🧑‍⚖️ Guard — Only owners or admins can share cases
  ======================================================= */
  useEffect(() => {
    if (!isOwner && user.role !== "admin") {
      toast.error("Only the case owner or admin can manage sharing.");
      onClose?.();
    }
  }, [isOwner, user, onClose]);

  /* =======================================================
     👥 Fetch users (excluding current user)
  ======================================================= */
  const fetchUsers = async (q = "") => {
    try {
      setLoading(true);
      const res = await axios.get("/api/users", {
        headers: { Authorization: `Bearer ${token}` },
        params: q ? { q } : {},
      });
      const filtered = (res.data || []).filter((u) => u._id !== user._id);
      setAllUsers(filtered);
    } catch (err) {
      console.error("❌ Error fetching users:", err);
      toast.error(err.response?.data?.message || "Failed to load users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [user, token]);

  /* =======================================================
     🔍 Debounced Search Filter
  ======================================================= */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchUsers(searchTerm), 300);
    return () => clearTimeout(debounceRef.current);
  }, [searchTerm]);

  /* =======================================================
     ✅ Save Shared Access Changes
  ======================================================= */
  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await axios.patch(
        `/api/cases/${caseData._id}/share`,
        { sharedWith: selectedUsers },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success("✅ Case shared successfully.");
      onShared?.(res.data);
      onClose?.();
    } catch (err) {
      console.error("❌ Share case error:", err);
      toast.error(err.response?.data?.message || "Failed to share case.");
    } finally {
      setSaving(false);
    }
  };

  /* =======================================================
     🎚️ Toggle selection
  ======================================================= */
  const toggleUser = (id) =>
    setSelectedUsers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  /* =======================================================
     💅 Render
  ======================================================= */
  return (
    <AnimatePresence>
      {caseData && (
        <motion.div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-white w-full max-w-lg rounded-xl shadow-lg p-6 relative"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
          >
            {/* Close Button */}
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
              onClick={onClose}
              title="Close"
            >
              <XCircle size={22} />
            </button>

            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Users size={20} />
              Share Case Access
            </h2>

            <p className="text-sm text-gray-600 mb-4">
              Grant access to other registered users for:
              <br />
              <span className="text-blue-600 font-medium">{caseData.title}</span>
            </p>

            {/* Search Bar */}
            <input
              type="text"
              placeholder="Search users by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />

            {/* User List */}
            {loading ? (
              <p className="text-gray-500 text-center py-4">
                Loading available users...
              </p>
            ) : allUsers.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No users found.</p>
            ) : (
              <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                {allUsers.map((u) => (
                  <label
                    key={u._id}
                    className="flex items-center justify-between px-4 py-2 hover:bg-gray-50 cursor-pointer"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium text-gray-800">{u.name}</span>
                      <span className="text-xs text-gray-500">{u.email}</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(u._id)}
                      onChange={() => toggleUser(u._id)}
                      className="accent-blue-600 w-4 h-4"
                    />
                  </label>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
