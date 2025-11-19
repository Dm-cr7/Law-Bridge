/**
 * EditCaseModal.jsx
 * ------------------------------------------------------------
 * Clean, production-ready modal for editing an existing case.
 * Mirrors the style of NewCaseModal for UI consistency.
 * ------------------------------------------------------------
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { XCircle, CheckCircle2, FolderKanban } from "lucide-react";
import api from "@/utils/api";
import toast from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";

export default function EditCaseModal({ isOpen, onClose, caseData, onUpdated }) {
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "civil",
    priority: "medium",
    status: "draft",
    clientId: "",
    respondentId: "",
  });

  const [clients, setClients] = useState([]);
  const [respondents, setRespondents] = useState([]);
  const [saving, setSaving] = useState(false);

  /* ===========================================================
     Load initial case data
  =========================================================== */
  useEffect(() => {
    if (caseData) {
      setFormData({
        title: caseData.title || "",
        description: caseData.description || "",
        category: caseData.category || "civil",
        priority: caseData.priority || "medium",
        status: caseData.status || "draft",
        clientId: caseData.clientId || "",
        respondentId: caseData.respondentId || "",
      });
    }
  }, [caseData]);

  /* ===========================================================
     Fetch clients/respondents
  =========================================================== */
  useEffect(() => {
    if (!isOpen) return;

    const fetchParties = async () => {
      try {
        const token = localStorage.getItem("token");
        const headers = { Authorization: `Bearer ${token}` };
        const [clientsRes, respondentsRes] = await Promise.all([
          api.get("/users?role=client", { headers }),
          api.get("/users?role=respondent", { headers }),
        ]);
        setClients(clientsRes.data || []);
        setRespondents(respondentsRes.data || []);
      } catch (err) {
        console.error("❌ Failed to load parties", err);
        toast.error("Failed to load clients/respondents");
      }
    };

    fetchParties();
  }, [isOpen]);

  /* ===========================================================
     Handle input
  =========================================================== */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
  };

  /* ===========================================================
     Submit update
  =========================================================== */
  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) return toast.error("Case title is required");

    try {
      setSaving(true);
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      const res = await api.put(`/cases/${caseData._id}`, formData, { headers });

      toast.success("✅ Case updated successfully");
      onUpdated?.(res.data);
      onClose();
    } catch (err) {
      console.error("❌ Update failed", err);
      toast.error(err.response?.data?.message || "Failed to update case");
    } finally {
      setSaving(false);
    }
  };

  /* ===========================================================
     Render
  =========================================================== */
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-white w-full max-w-lg rounded-2xl shadow-xl p-6 relative"
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
          >
            {/* Close Button */}
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
              onClick={onClose}
            >
              <XCircle size={22} />
            </button>

            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              Edit Case Details
            </h2>

            <form onSubmit={handleSave} className="space-y-4">
              {/* Title */}
              <div>
                <label className="text-sm font-medium text-gray-700">Case Title</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1 focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter case title"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-sm font-medium text-gray-700">Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1 focus:ring-2 focus:ring-blue-500"
                  placeholder="Describe case progress or updates"
                />
              </div>

              {/* Category + Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                    <FolderKanban size={14} /> Category
                  </label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1"
                  >
                    <option value="civil">Civil</option>
                    <option value="criminal">Criminal</option>
                    <option value="adr">ADR</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Priority</label>
                  <select
                    name="priority"
                    value={formData.priority}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="text-sm font-medium text-gray-700">Case Status</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1"
                >
                  <option value="draft">Draft</option>
                  <option value="filed">Filed</option>
                  <option value="under_review">Under Review</option>
                  <option value="accepted">Accepted</option>
                  <option value="hearing_in_progress">Hearing in Progress</option>
                  <option value="award_issued">Award Issued</option>
                  <option value="closed">Closed</option>
                </select>
              </div>

              {/* Client / Respondent */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">Client</label>
                  <select
                    name="clientId"
                    value={formData.clientId}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1"
                  >
                    <option value="">Select client</option>
                    {clients.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Respondent</label>
                  <select
                    name="respondentId"
                    value={formData.respondentId}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1"
                  >
                    <option value="">Select respondent</option>
                    {respondents.map((r) => (
                      <option key={r._id} value={r._id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Save Button */}
              <button
                type="submit"
                disabled={saving}
                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <CheckCircle2 className="animate-spin" size={18} />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={18} />
                    Save Changes
                  </>
                )}
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
