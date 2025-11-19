import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { XCircle, CalendarDays, UploadCloud, Users, Trash2, FileText } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/utils/api";
import { useAuth } from "@/context/AuthContext";

/**
 * TaskFormModal.jsx
 * -------------------------------------------------------------
 * Task creation / edit modal with:
 * - Title, description, priority, due date, assignees
 * - Multiple file uploads with client-side validation
 * - Image thumbnails + document previews (filename, size)
 * - Per-file upload progress and deletion (server-side)
 * - Clean UX: optimistic UI, revoke object URLs on close
 * -------------------------------------------------------------
 */

const DEFAULT_WHITELIST = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "application/zip",
  // add "text/csv" if you want CSV support
]);

const EXTENSION_WHITELIST = new Set([
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".doc",
  ".docx",
  ".txt",
  ".zip",
  // ".csv"
]);

function formatBytes(bytes) {
  if (!bytes) return "";
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

export default function TaskFormModal({ isOpen, onClose, onSuccess, caseId, existingTask }) {
  const modalRef = useRef();
  const { user, token } = useAuth();

  const isEditing = Boolean(existingTask);

  const [users, setUsers] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({}); // { localId: percent }
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "medium",
    dueDate: "",
    assignedTo: [],
    attachments: [], // uploaded attachments: { name, fileUrl, fileKey, fileType, size }
  });

  // Local previews for files waiting to be uploaded or uploaded
  // Each preview: { id, file (File|null), previewUrl|null, name, size, fileType, uploaded:bool, fileKey, fileUrl }
  const [filePreviews, setFilePreviews] = useState([]);

  /* ==========================================================
     Prefill for edit mode
  ========================================================== */
  useEffect(() => {
    if (existingTask) {
      setFormData({
        title: existingTask.title || "",
        description: existingTask.description || "",
        priority: existingTask.priority || "medium",
        dueDate: existingTask.dueDate ? existingTask.dueDate.slice(0, 10) : "",
        assignedTo: existingTask.assignedTo?.map((u) => (u._id ? u._id : u)) || [],
        attachments: existingTask.attachments || [],
      });

      // build previews from existing attachments (they're already uploaded)
      const previews = (existingTask.attachments || []).map((a, i) => ({
        id: `existing-${i}-${a.fileKey || a.name}`,
        file: null,
        previewUrl: a.fileUrl && /\.(jpg|jpeg|png|gif|webp)$/i.test(a.fileUrl) ? a.fileUrl : null,
        name: a.name || (a.fileUrl ? a.fileUrl.split("/").pop() : `Attachment ${i + 1}`),
        size: a.size || 0,
        fileType: a.fileType || "",
        uploaded: true,
        fileKey: a.fileKey || a.name,
        fileUrl: a.fileUrl,
      }));
      setFilePreviews(previews);
    }
  }, [existingTask]);

  /* ==========================================================
     Reset on modal close
  ========================================================== */
  useEffect(() => {
    if (!isOpen) {
      // revoke any object URLs
      filePreviews.forEach((p) => {
        if (p.previewObjectUrl) URL.revokeObjectURL(p.previewObjectUrl);
      });

      setFormData({
        title: "",
        description: "",
        priority: "medium",
        dueDate: "",
        assignedTo: [],
        attachments: [],
      });
      setFilePreviews([]);
      setUploadProgress({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  /* ==========================================================
     Fetch assignable users
  ========================================================== */
  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        const res = await api.get("/users", {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        setUsers(res.data || []);
      } catch (err) {
        console.error("❌ Failed to fetch users:", err);
        toast.error("Failed to load users");
      }
    })();
  }, [isOpen, token]);

  /* ==========================================================
     Input handlers
  ========================================================== */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAssigneeChange = (e) => {
    const selected = Array.from(e.target.selectedOptions, (opt) => opt.value);
    setFormData((prev) => ({ ...prev, assignedTo: selected }));
  };

  /* ==========================================================
     File validation helper
  ========================================================== */
  const isFileAllowed = (file) => {
    const whitelist = DEFAULT_WHITELIST;
    if (whitelist.has(file.type)) return true;
    const ext = (file.name && file.name.includes(".") && file.name.substring(file.name.lastIndexOf(".")).toLowerCase()) || "";
    if (ext && EXTENSION_WHITELIST.has(ext)) return true;
    return false;
  };

  /* ==========================================================
     Handle file selection & previews (before upload)
  ========================================================== */
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const rejected = files.filter((f) => !isFileAllowed(f));
    if (rejected.length) {
      const list = rejected.map((r) => `${r.name} (${r.type || "unknown"})`).join(", ");
      toast.error(`Invalid file type: ${list}`);
      return;
    }

    const previews = files.map((file, idx) => {
      const isImage = /^image\//.test(file.type);
      const previewObjectUrl = isImage ? URL.createObjectURL(file) : null;
      return {
        id: `local-${Date.now()}-${idx}-${file.name}`,
        file,
        previewObjectUrl,
        previewUrl: previewObjectUrl, // for immediate display
        name: file.name,
        size: file.size,
        fileType: file.type,
        uploaded: false,
        fileKey: null,
        fileUrl: null,
      };
    });

    setFilePreviews((prev) => [...previews, ...(Array.isArray(prev) ? prev : [])]);
  };

  /* ==========================================================
     Upload selected files (multiple at once)
     - Uses /api/upload/multiple
     - Shows per-file progress
     - Merges returned files into formData.attachments
  ========================================================== */
  const uploadAllFiles = async () => {
    const toUpload = filePreviews.filter((p) => !p.uploaded && p.file);
    if (!toUpload.length) return;

    setUploading(true);
    const form = new FormData();
    toUpload.forEach((p) => form.append("files", p.file));

    try {
      const res = await api.post("/upload/multiple", form, {
        headers: {
          Authorization: token ? `Bearer ${token}` : undefined,
          "Content-Type": "multipart/form-data",
        },
        onUploadProgress: (evt) => {
          // distribute progress proportionally across files using bytes ratio approximate
          // fallback simple percent for overall
          const percent = evt.total ? Math.round((evt.loaded * 100) / evt.total) : 0;
          // set overall progress with key 'all'
          setUploadProgress((prev) => ({ ...prev, all: percent }));
        },
      });

      const uploaded = res.data?.files || res.data?.data?.files || [];
      if (!uploaded.length) {
        toast.error("Upload returned no files");
        return;
      }

      // Map back to filePreviews (order preserved by server usually)
      const nextPreviews = [...filePreviews];
      let uploadedIndex = 0;
      for (let i = 0; i < nextPreviews.length && uploadedIndex < uploaded.length; i++) {
        if (!nextPreviews[i].uploaded && nextPreviews[i].file) {
          const u = uploaded[uploadedIndex++];
          nextPreviews[i] = {
            ...nextPreviews[i],
            uploaded: true,
            fileKey: u.fileKey || u.fileKey || u.filename || u.key || (u.fileUrl && u.fileUrl.split("/").pop()),
            fileUrl: u.fileUrl || u.url || null,
            name: u.name || nextPreviews[i].name,
            fileType: u.fileType || nextPreviews[i].fileType,
            size: u.size || nextPreviews[i].size,
          };
        }
      }

      // Merge uploaded files into formData.attachments (persisted)
      const newAttachments = nextPreviews
        .filter((p) => p.uploaded && p.fileUrl)
        .map((p) => ({
          name: p.name,
          fileUrl: p.fileUrl,
          fileKey: p.fileKey,
          fileType: p.fileType,
          size: p.size,
        }));

      setFormData((prev) => ({
        ...prev,
        attachments: [...(prev.attachments || []), ...newAttachments],
      }));

      setFilePreviews(nextPreviews);
      toast.success(`${uploaded.length} file(s) uploaded`);
    } catch (err) {
      console.error("❌ Upload failed:", err, err?.response?.data);
      const serverMsg = err?.response?.data?.message || err?.response?.data?.error;
      toast.error(serverMsg || "Upload failed");
    } finally {
      setUploading(false);
      setUploadProgress({});
    }
  };

  /* ==========================================================
     Remove a preview/attachment
     - If uploaded, attempt server delete by fileKey
  ========================================================== */
  const removePreview = async (id) => {
    const preview = filePreviews.find((p) => p.id === id);
    if (!preview) return;

    // If uploaded on server, try to delete
    if (preview.uploaded && preview.fileKey) {
      try {
        await api.delete("/upload", {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          data: { fileKey: preview.fileKey },
        });
        // remove from persisted attachments as well
        setFormData((prev) => ({
          ...prev,
          attachments: (prev.attachments || []).filter((a) => a.fileKey !== preview.fileKey && a.fileUrl !== preview.fileUrl),
        }));
        toast.success("Attachment removed");
      } catch (err) {
        console.error("❌ Failed to delete uploaded file:", err, err?.response?.data);
        const serverMsg = err?.response?.data?.message || err?.response?.data?.error;
        toast.error(serverMsg || "Failed to delete file from server");
        return;
      }
    }

    // revoke object URL if present
    if (preview.previewObjectUrl) {
      URL.revokeObjectURL(preview.previewObjectUrl);
    }

    setFilePreviews((prev) => prev.filter((p) => p.id !== id));
  };

  /* ==========================================================
     Submit form
  ========================================================== */
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title.trim()) return toast.error("Task title is required");
    if (!formData.dueDate) return toast.error("Due date is required");
    if (!formData.assignedTo?.length) return toast.error("Select at least one assignee");

    // ensure any non-uploaded local files are uploaded first
    const pendingFiles = filePreviews.filter((p) => !p.uploaded && p.file);
    if (pendingFiles.length) {
      toast("Uploading files first...");
      await uploadAllFiles();
    }

    try {
      setSubmitting(true);
      const payload = {
        ...formData,
        caseId,
      };

      if (isEditing) {
        await api.put(`/tasks/${existingTask._id}`, payload, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        toast.success("Task updated successfully");
      } else {
        await api.post("/tasks", payload, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        toast.success("Task created successfully");
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error("❌ Save error:", err, err?.response?.data);
      const serverMsg = err?.response?.data?.message || err?.response?.data?.error;
      toast.error(serverMsg || "Failed to save task");
    } finally {
      setSubmitting(false);
    }
  };

  /* ==========================================================
     Click outside close
  ========================================================== */
  const handleBackdropClick = (e) => {
    if (modalRef.current && !modalRef.current.contains(e.target)) {
      onClose();
    }
  };

  /* ==========================================================
     Render previews (image thumbnail or file row)
  ========================================================== */
  const renderPreview = (p) => {
    const isImage = !!p.previewUrl && /\.(jpg|jpeg|png|gif|webp)$/i.test(p.previewUrl);
    return (
      <div key={p.id} className="flex items-center gap-3 p-2 border rounded-md">
        <div className="w-14 h-14 flex items-center justify-center bg-gray-50 rounded-md overflow-hidden">
          {isImage ? (
            <img src={p.previewUrl} alt={p.name} className="object-cover w-full h-full" />
          ) : (
            <FileText size={28} className="text-gray-500" />
          )}
        </div>

        <div className="flex-1">
          <div className="text-sm font-medium text-gray-800 truncate">{p.name}</div>
          <div className="text-xs text-gray-500">{formatBytes(p.size)}</div>

          {uploading && uploadProgress.all != null && (
            <div className="w-full bg-gray-100 rounded-full h-2 mt-1">
              <div
                className="h-2 rounded-full transition-all"
                style={{ width: `${uploadProgress.all}%` }}
              />
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          {p.uploaded && p.fileUrl ? (
            <a
              href={p.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline"
            >
              Open
            </a>
          ) : (
            <span className="text-xs text-gray-400">Pending</span>
          )}

          <button
            onClick={() => removePreview(p.id)}
            className="text-red-600 hover:text-red-800 flex items-center gap-1 text-xs"
            title="Remove"
          >
            <Trash2 size={14} />
            Remove
          </button>
        </div>
      </div>
    );
  };

  /* ==========================================================
     JSX
  ========================================================== */
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          onMouseDown={handleBackdropClick}
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center overflow-y-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            ref={modalRef}
            className="bg-white w-full max-w-xl rounded-xl shadow-lg relative my-10 overflow-hidden"
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
          >
            <div className="max-h-[85vh] overflow-y-auto p-6">
              {/* Header */}
              <div className="flex justify-between items-center mb-4 sticky top-0 bg-white z-10 pb-2 border-b">
                <h2 className="text-lg font-semibold text-gray-800">{isEditing ? "Edit Task" : "Create Task"}</h2>
                <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                  <XCircle size={22} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Title */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Title</label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1 focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter task title"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1 focus:ring-2 focus:ring-blue-500"
                    placeholder="Describe the task"
                  />
                </div>

                {/* Priority & Due Date */}
                <div className="grid grid-cols-2 gap-3">
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

                  <div>
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <CalendarDays size={16} /> Due Date
                    </label>
                    <input
                      type="date"
                      name="dueDate"
                      value={formData.dueDate}
                      onChange={handleChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1"
                    />
                  </div>
                </div>

                {/* Assigned To */}
                <div>
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Users size={16} /> Assign To
                  </label>
                  <select
                    name="assignedTo"
                    multiple
                    value={formData.assignedTo || []}
                    onChange={handleAssigneeChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1 h-28"
                  >
                    {users.map((u) => (
                      <option key={u._id} value={u._id}>
                        {u.name} ({u.role})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Hold <kbd>Ctrl</kbd> or <kbd>Cmd</kbd> to select multiple</p>
                </div>

                {/* Attachments */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Attachments</label>

                  <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg py-4 cursor-pointer hover:border-blue-400 text-gray-500 mt-1">
                    <UploadCloud size={18} />
                    {uploading ? "Uploading..." : "Click or drop files"}
                    <input type="file" multiple onChange={handleFileSelect} className="hidden" disabled={uploading} />
                  </label>

                  {filePreviews.length > 0 && (
                    <div className="mt-3 grid grid-cols-1 gap-2">
                      {filePreviews.map((p) => renderPreview(p))}
                    </div>
                  )}

                  {/* Button to explicitly upload queued files (helps show progress) */}
                  {filePreviews.some((p) => !p.uploaded && p.file) && (
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={uploadAllFiles}
                        disabled={uploading}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
                      >
                        {uploading ? "Uploading..." : "Upload Files"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          // clear only pending (not uploaded) previews
                          filePreviews.forEach((p) => {
                            if (p.previewObjectUrl) URL.revokeObjectURL(p.previewObjectUrl);
                          });
                          setFilePreviews((prev) => prev.filter((p) => p.uploaded));
                        }}
                        className="px-3 py-1.5 bg-gray-100 rounded-md text-sm hover:bg-gray-200"
                      >
                        Clear Pending
                      </button>
                    </div>
                  )}

                  {/* Existing attachments list (persisted) */}
                  {formData.attachments?.length > 0 && (
                    <ul className="text-sm text-gray-600 mt-2 space-y-1">
                      {formData.attachments.map((a, i) => (
                        <li key={i} className="flex items-center justify-between">
                          <a href={a.fileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                            {a.name || a.fileUrl.split("/").pop()}
                          </a>
                          <button
                            type="button"
                            onClick={async () => {
                              // allow removing persisted attachments
                              try {
                                await api.delete("/upload", {
                                  headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                                  data: { fileKey: a.fileKey },
                                });
                                setFormData((prev) => ({ ...prev, attachments: (prev.attachments || []).filter((x) => x.fileKey !== a.fileKey) }));
                                toast.success("Attachment removed");
                              } catch (err) {
                                console.error("❌ Failed to remove attachment:", err);
                                toast.error("Failed to remove attachment");
                              }
                            }}
                            className="text-red-600 hover:text-red-800 flex items-center gap-1 text-xs"
                          >
                            <Trash2 size={14} />
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {submitting ? (isEditing ? "Updating..." : "Creating...") : isEditing ? "Update Task" : "Create Task"}
                </button>
              </form>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
