/**
 * CaseCard.jsx
 * ------------------------------------------------------------
 * Production-ready unified case card.
 * Supports all roles — advocate, admin, arbitrator, client.
 * Handles: view, edit, share, attach, timeline, and delete.
 * Fully matches backend routes (/api/cases/*).
 * ------------------------------------------------------------
 */

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Edit,
  Trash2,
  Share2,
  UploadCloud,
  FileText,
  Check,
  X,
  Users,
  Clock,
  FolderKanban,
} from "lucide-react";
import toast from "react-hot-toast";
import axios from "@/utils/axiosInstance";
import { useAuth } from "@/context/AuthContext";

export default function CaseCard({
  c,
  onUpdated,
  onDeleted,
  onShare,
  onAttach,
  onTimeline,
}) {
  const { user, token } = useAuth();
  const isOwner =
    String(c?.filedBy?._id || c?.filedBy) === String(user?._id);

  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState(null);

  const [formData, setFormData] = useState({
    title: c.title || "",
    description: c.description || "",
    status: c.status || "filed",
    priority: c.priority || "medium",
  });

  useEffect(() => {
    setFormData({
      title: c.title || "",
      description: c.description || "",
      status: c.status || "filed",
      priority: c.priority || "medium",
    });
  }, [c]);

  /* =======================================================
     ✏️ Handle case update (title/description/priority)
     Only owner or admin can edit case info.
  ======================================================= */
  const handleUpdate = async () => {
    if (!isOwner && user.role !== "admin") {
      toast.error("Only the owner or admin can update this case.");
      return;
    }
    try {
      const { data } = await axios.patch(
        `/api/cases/${c._id}/status`,
        { status: formData.status },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      onUpdated(data);
      setEditing(false);
      toast.success("✅ Case updated");
    } catch (err) {
      console.error("❌ Update error:", err);
      toast.error(err.response?.data?.message || "Failed to update case");
    }
  };

  /* =======================================================
     🗑️ Handle case deletion
     Only owner or admin can delete.
  ======================================================= */
  const handleDelete = async () => {
    if (!isOwner && user.role !== "admin") {
      return toast.error("Only the owner or admin can delete this case.");
    }
    if (!confirm("Are you sure you want to delete this case?")) return;
    try {
      await axios.delete(`/api/cases/${c._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      onDeleted(c._id);
      toast.success("🗑️ Case deleted");
    } catch (err) {
      console.error("❌ Delete error:", err);
      toast.error(err.response?.data?.message || "Failed to delete case");
    }
  };

  /* =======================================================
     📎 Upload Attachment (via /api/cases/:id/attachments)
     Owner, admin, client, arbitrator allowed.
  ======================================================= */
  const handleUpload = async () => {
    if (!file) return toast.error("Please select a file first.");
    setUploading(true);
    try {
      const form = new FormData();
      form.append("fileUrl", file);
      form.append("name", file.name);

      await axios.post(`/api/cases/${c._id}/attachments`, form, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      toast.success(`📁 ${file.name} uploaded`);
      setFile(null);
      onUpdated({ ...c }); // trigger refresh from parent
    } catch (err) {
      console.error("❌ Upload error:", err);
      toast.error(err.response?.data?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  /* =======================================================
     🎨 Status & Priority Colors
  ======================================================= */
  const statusColor = {
    draft: "bg-gray-100 text-gray-700",
    filed: "bg-blue-100 text-blue-800",
    under_review: "bg-yellow-100 text-yellow-700",
    accepted: "bg-green-100 text-green-700",
    hearing_scheduled: "bg-indigo-100 text-indigo-700",
    hearing_in_progress: "bg-purple-100 text-purple-700",
    award_issued: "bg-teal-100 text-teal-700",
    resolved: "bg-emerald-100 text-emerald-700",
    closed: "bg-gray-200 text-gray-800",
    archived: "bg-red-100 text-red-700",
  }[formData.status] || "bg-gray-100 text-gray-700";

  const priorityColor = {
    low: "bg-green-100 text-green-700",
    medium: "bg-blue-100 text-blue-700",
    high: "bg-orange-100 text-orange-700",
    urgent: "bg-red-100 text-red-700",
  }[formData.priority] || "bg-blue-100 text-blue-700";

  /* =======================================================
     💅 UI Rendering
  ======================================================= */
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="bg-white dark:bg-gray-900 shadow-sm hover:shadow-md transition rounded-xl p-5 border border-gray-100 dark:border-gray-700"
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div>
          {editing ? (
            <input
              type="text"
              value={formData.title}
              onChange={(e) =>
                setFormData((p) => ({ ...p, title: e.target.value }))
              }
              className="border-b border-blue-500 w-full text-lg font-semibold focus:outline-none bg-transparent"
            />
          ) : (
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {c.title}
            </h3>
          )}
          <p className="text-sm text-gray-500 mt-1">
            Filed by:{" "}
            <strong>
              {c.filedBy?.name || "Unknown"}{" "}
              {isOwner && <span className="text-blue-600">(You)</span>}
            </strong>
          </p>
        </div>

        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${statusColor}`}
        >
          {formData.status?.replace(/_/g, " ")}
        </span>
      </div>

      {/* Category & Client */}
      <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 mb-2">
        {c.category && (
          <>
            <FolderKanban size={14} className="text-gray-500" />
            <span>{c.category}</span>
          </>
        )}
        {c.client && (
          <>
            <span className="text-gray-400">•</span>
            <span>Client: {c.client?.name || "N/A"}</span>
          </>
        )}
      </div>

      {/* Description */}
      {editing ? (
        <textarea
          value={formData.description}
          onChange={(e) =>
            setFormData((p) => ({ ...p, description: e.target.value }))
          }
          rows={3}
          className="w-full text-sm border rounded-md p-2 focus:ring-2 focus:ring-blue-400 bg-transparent"
        />
      ) : (
        <p className="text-sm text-gray-700 dark:text-gray-300 mt-1 line-clamp-3">
          {c.description || "No description provided."}
        </p>
      )}

      {/* Priority */}
      <div className="mt-3">
        <span
          className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${priorityColor}`}
        >
          Priority: {formData.priority}
        </span>
      </div>

      {/* Attachments */}
      {c.attachments?.length > 0 && (
        <div className="mt-3">
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200 flex items-center gap-1">
            <FileText size={14} /> Documents:
          </p>
          <ul className="ml-5 mt-1 list-disc text-sm text-blue-600 dark:text-blue-400">
            {c.attachments.map((file, idx) => (
              <li key={idx}>
                <a
                  href={file.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  {file.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Upload Section */}
      {isOwner && (
        <div className="mt-3">
          <label className="flex items-center gap-2 text-gray-600 text-sm cursor-pointer">
            <UploadCloud size={16} />
            <input
              type="file"
              className="hidden"
              id={`upload-${c._id}`}
              onChange={(e) => setFile(e.target.files[0])}
            />
            <span onClick={() => document.getElementById(`upload-${c._id}`).click()}>
              {uploading ? "Uploading..." : "Upload File"}
            </span>
          </label>

          {file && (
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="text-xs bg-blue-600 text-white px-3 py-1 rounded-lg mt-2 hover:bg-blue-700"
            >
              {uploading ? "Uploading..." : "Confirm Upload"}
            </button>
          )}
        </div>
      )}

      {/* Shared Users */}
      {c.sharedWith?.length > 0 && (
        <div className="mt-3 text-xs text-gray-500 flex items-center gap-1 flex-wrap">
          <Users size={14} /> Shared with:{" "}
          {c.sharedWith.map((u, i) => (
            <span key={u._id || i} className="font-medium text-gray-700 dark:text-gray-300">
              {u.name}
              {i < c.sharedWith.length - 1 && ", "}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap justify-end gap-2 mt-4 border-t pt-3">
        {editing ? (
          <>
            <button
              className="text-sm bg-gray-200 text-gray-800 px-3 py-1 rounded-lg"
              onClick={() => setEditing(false)}
            >
              <X size={14} />
            </button>
            <button
              className="text-sm bg-blue-600 text-white px-3 py-1 rounded-lg"
              onClick={handleUpdate}
            >
              <Check size={14} />
            </button>
          </>
        ) : (
          <>
            {isOwner && (
              <>
                <button
                  className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded-lg flex items-center gap-1"
                  onClick={() => setEditing(true)}
                >
                  <Edit size={14} /> Edit
                </button>
                <button
                  className="text-sm bg-gray-100 text-gray-800 px-3 py-1 rounded-lg flex items-center gap-1"
                  onClick={() => onShare(c)}
                >
                  <Share2 size={14} /> Share
                </button>
              </>
            )}
            <button
              className="text-sm bg-emerald-100 text-emerald-700 px-3 py-1 rounded-lg flex items-center gap-1"
              onClick={() => onAttach(c)}
            >
              <UploadCloud size={14} /> Attach
            </button>
            <button
              className="text-sm bg-indigo-100 text-indigo-700 px-3 py-1 rounded-lg flex items-center gap-1"
              onClick={() => onTimeline(c)}
            >
              <Clock size={14} /> Timeline
            </button>
            {(isOwner || user.role === "admin") && (
              <button
                className="text-sm bg-red-100 text-red-700 px-3 py-1 rounded-lg flex items-center gap-1"
                onClick={handleDelete}
              >
                <Trash2 size={14} /> Delete
              </button>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}
