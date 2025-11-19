/**
 * CaseTimelineModal.jsx
 * ------------------------------------------------------------
 * Modal component displaying a chronological timeline
 * of case activities — status changes, evidence uploads,
 * client updates, and internal comments.
 * ------------------------------------------------------------
 */

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { X, Clock, Activity } from "lucide-react";
import { toast } from "react-hot-toast";
import API from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { socket } from "../utils/socket";

export default function CaseTimelineModal({ caseData, onClose }) {
  const { token } = useAuth();
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);

  /* =====================================================
     Fetch timeline for the case
  ===================================================== */
  const fetchTimeline = async () => {
    try {
      setLoading(true);
      const res = await API.get(`/cases/${caseData._id}/timeline`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTimeline(res.data?.timeline || []);
    } catch (err) {
      console.error("❌ Timeline fetch failed:", err);
      toast.error("Failed to load case timeline");
    } finally {
      setLoading(false);
    }
  };

  /* =====================================================
     Realtime updates (Socket.IO)
  ===================================================== */
  useEffect(() => {
    if (!caseData || !socket) return;
    fetchTimeline();

    const handleNewActivity = (activity) => {
      if (activity.caseId === caseData._id) {
        setTimeline((prev) => [activity, ...prev]);
        toast.success(`🔄 New case activity: ${activity.action}`);
      }
    };

    socket.on("case:activity", handleNewActivity);
    return () => socket.off("case:activity", handleNewActivity);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseData]);

  /* =====================================================
     Render
  ===================================================== */
  if (!caseData) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.25 }}
        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl p-6"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 transition"
          aria-label="Close"
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <Clock className="text-blue-600" size={20} />
          <h2 className="text-lg font-semibold text-gray-800">
            Case Timeline — <span className="text-blue-700">{caseData.title}</span>
          </h2>
        </div>

        {/* Case summary */}
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4 text-sm text-gray-700">
          <p>
            <strong>Status:</strong> {caseData.status || "Unknown"} &nbsp;|&nbsp;
            <strong>Category:</strong> {caseData.category || "Uncategorized"}
          </p>
          <p>
            <strong>Filed By:</strong> {caseData.filedBy?.name || "Unknown"} &nbsp;|&nbsp;
            <strong>Client:</strong> {caseData.clientName || "N/A"}
          </p>
        </div>

        {/* Timeline content */}
        <div className="max-h-[65vh] overflow-y-auto pr-2">
          {loading ? (
            <div className="text-center text-gray-500 py-6">Loading timeline...</div>
          ) : timeline.length === 0 ? (
            <div className="text-center text-gray-500 py-6">No activity yet.</div>
          ) : (
            <ul className="relative border-l border-gray-200 pl-5">
              {timeline.map((event, idx) => (
                <motion.li
                  key={event._id || idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="mb-5 relative"
                >
                  {/* Dot */}
                  <span className="absolute -left-[7px] top-1 w-3 h-3 rounded-full bg-blue-500"></span>

                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-gray-800 font-medium">
                        {event.action || "Activity"}
                      </p>
                      {event.details && (
                        <p className="text-sm text-gray-600 mt-0.5">
                          {event.details}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(event.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <Activity
                      size={16}
                      className="text-gray-400 mt-1 flex-shrink-0"
                    />
                  </div>
                </motion.li>
              ))}
            </ul>
          )}
        </div>
      </motion.div>
    </div>
  );
}
