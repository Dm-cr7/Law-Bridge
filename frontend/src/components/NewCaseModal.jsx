// frontend/src/components/NewCaseModal.jsx
/**
 * NewCaseModal.jsx
 *
 * Production-ready modal for filing new cases.
 * - Optional initialHearing when creating the case
 * - Defensive endpoint/path builder to avoid double /api
 * - Parallel fetch of users & clients with abort support
 * - File uploads with progress + cancel support
 * - Token fallback (useAuth token or localStorage)
 * - Robust response parsing (handles { success, data } and raw arrays)
 * - Clear success/error toasts and predictable onSuccess(createdCase)
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { XCircle, UploadCloud, Users, FolderKanban, Info } from "lucide-react";
import axios from "@/utils/axiosInstance"; // centralized axios instance
import toast from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";

/* ------------------------------- Helpers ------------------------------- */
/**
 * Normalize axios response:
 * - Accepts raw arrays/objects, { data }, or { data: { data, meta } }
 * - Returns the most useful payload (array/object) or null
 */
const safeData = (res) => {
  if (!res) return null;
  if (res?.data === undefined) return res;
  const body = res.data;
  if (body === undefined) return res;
  if (body?.data !== undefined) return body.data;
  return body;
};

/* ----------------------------- Component ------------------------------- */
export default function NewCaseModal({ isOpen, onClose, onSuccess }) {
  const { user, token: authToken } = useAuth() || {};
  const token = authToken || localStorage.getItem("token") || localStorage.getItem("authToken") || null;

  /* Form state */
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    clientId: "",
    respondentId: "",
    category: "civil",
    priority: "medium",
    attachments: [],
    sharedWith: [],
  });

  /* Lists */
  const [clients, setClients] = useState([]);
  const [respondents, setRespondents] = useState([]);
  const [allUsers, setAllUsers] = useState([]);

  /* Upload & submit state */
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [showShareList, setShowShareList] = useState(false);

  /* Optional initial hearing */
  const [scheduleHearing, setScheduleHearing] = useState(false);
  const [hearingDate, setHearingDate] = useState(""); // datetime-local
  const [hearingTitle, setHearingTitle] = useState("");
  const [hearingNotes, setHearingNotes] = useState("");

  /* Refs for abort/cancel */
  const fetchControllerRef = useRef(null);
  const uploadControllerRef = useRef(null);
  const isMountedRef = useRef(false);

  /* Build path (avoids double /api if axios baseURL already uses /api) */
  const buildPath = useCallback((pathWithoutApi) => {
    const base = axios.defaults?.baseURL || "";
    const baseEndsWithApi = !!base && base.replace(/\/+$/, "").endsWith("/api");
    return baseEndsWithApi ? `/${pathWithoutApi}` : `/api/${pathWithoutApi}`;
  }, []);

  /* Fetch clients & users when modal opens */
  useEffect(() => {
    if (!isOpen) return;

    isMountedRef.current = true;
    fetchControllerRef.current = new AbortController();
    const signal = fetchControllerRef.current.signal;
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    const clientsPath = buildPath("users");
    const usersPath = buildPath("users");

    (async function loadUsers() {
      try {
        const [clientsRes, usersRes] = await Promise.all([
          axios.get(clientsPath, { params: { role: "client" }, headers, signal }),
          axios.get(usersPath, { headers, signal }),
        ]);

        const clientsData = Array.isArray(safeData(clientsRes)) ? safeData(clientsRes) : [];
        setClients(clientsData);
        setRespondents(clientsData); // fallback if no separate respondents endpoint

        const usersDataRaw = safeData(usersRes);
        const usersData = Array.isArray(usersDataRaw) ? usersDataRaw.filter((u) => String(u._id) !== String(user?._id)) : [];
        setAllUsers(usersData);
      } catch (err) {
        if (signal && signal.aborted) {
          console.log("NewCaseModal: fetch aborted");
          return;
        }
        console.error("❌ Error loading users:", err, err?.response?.data);
        toast.error(err?.response?.data?.message || (err?.message ? `Failed to load users: ${err.message}` : "Failed to load users"));
      }
    })();

    // disable background scroll while modal open
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      isMountedRef.current = false;
      if (fetchControllerRef.current) fetchControllerRef.current.abort();
      document.body.style.overflow = prevOverflow || "auto";
    };
  }, [isOpen, token, user, buildPath]);

  /* -------------------------- Input handlers -------------------------- */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
  };

  const toggleShare = (id) => {
    setFormData((p) => ({
      ...p,
      sharedWith: p.sharedWith.includes(id) ? p.sharedWith.filter((u) => u !== id) : [...p.sharedWith, id],
    }));
  };

  /* ----------------------------- Upload ------------------------------ */
  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setUploading(true);
    setUploadProgress(0);

    // cancel previous upload if any
    if (uploadControllerRef.current) {
      try {
        uploadControllerRef.current.abort();
      } catch (err) {
        /* ignore */
      }
    }
    uploadControllerRef.current = new AbortController();
    const signal = uploadControllerRef.current.signal;

    const data = new FormData();
    files.forEach((f) => data.append("files", f));

    const path = buildPath("upload/multiple");
    try {
      const res = await axios.post(path, data, {
        headers: {
          "Content-Type": "multipart/form-data",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        onUploadProgress: (evt) => {
          const percent = evt.total ? Math.round((evt.loaded * 100) / evt.total) : 0;
          setUploadProgress(percent);
        },
        signal, // modern axios supports AbortController signal
      });

      // server might return res.data.files or res.data
      let uploadedFiles = [];
      if (res?.data?.files) uploadedFiles = res.data.files;
      else uploadedFiles = safeData(res) || [];

      const normalized = (Array.isArray(uploadedFiles) ? uploadedFiles : []).map((f) => ({
        name: f.name || f.fileName || "file",
        fileUrl: f.fileUrl || f.url || f.path || f.fileUrl,
      }));

      setFormData((p) => ({ ...p, attachments: [...(p.attachments || []), ...normalized] }));
      toast.success(`${normalized.length} file(s) uploaded`);
    } catch (err) {
      if (signal && signal.aborted) {
        toast.error("Upload cancelled");
      } else {
        console.error("❌ Upload failed:", err, err?.response?.data);
        toast.error(err?.response?.data?.message || err?.message || "Upload failed");
      }
    } finally {
      setUploading(false);
      setUploadProgress(0);
      uploadControllerRef.current = null;
    }
  };

  /* Allow user to cancel ongoing upload */
  const cancelUpload = () => {
    if (uploadControllerRef.current) {
      try {
        uploadControllerRef.current.abort();
        uploadControllerRef.current = null;
      } catch (err) {
        console.warn("Failed to cancel upload", err);
      }
    }
  };

  /* ---------------------------- Validation --------------------------- */
  const validateHearing = () => {
    if (!scheduleHearing) return { ok: true };
    if (!hearingDate) return { ok: false, message: "Please select a hearing date/time." };
    const dt = new Date(hearingDate);
    if (isNaN(dt)) return { ok: false, message: "Hearing date is invalid." };
    if (!hearingTitle || !hearingTitle.trim()) return { ok: false, message: "Please provide a hearing title." };
    return { ok: true };
  };

  /* ---------------------------- Submit Case ------------------------- */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.title.trim()) {
      toast.error("Case title is required");
      return;
    }
    if (!formData.clientId) {
      toast.error("Please select a client");
      return;
    }

    const hearingValidation = validateHearing();
    if (!hearingValidation.ok) {
      toast.error(hearingValidation.message);
      return;
    }

    setSubmitting(true);

    const payload = {
      ...formData,
      filedBy: user?._id,
    };

    if (scheduleHearing) {
      payload.initialHearing = {
        date: hearingDate,
        title: hearingTitle,
        description: hearingNotes || "",
      };
    }

    const path = buildPath("cases");
    try {
      const res = await axios.post(path, payload, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const createdCase = res?.data?.data ?? res?.data ?? safeData(res);
      toast.success("✅ Case filed successfully");

      // return normalized created case to parent
      onSuccess?.(createdCase);

      handleClose();
    } catch (err) {
      console.error("❌ Create case error:", err, err?.response?.data);
      const message = err?.response?.data?.message || err?.message || "Failed to create case";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  /* --------------------------- Reset & Close ------------------------ */
  const handleClose = () => {
    setFormData({
      title: "",
      description: "",
      clientId: "",
      respondentId: "",
      category: "civil",
      priority: "medium",
      attachments: [],
      sharedWith: [],
    });
    setUploadProgress(0);
    setShowShareList(false);

    setScheduleHearing(false);
    setHearingDate("");
    setHearingTitle("");
    setHearingNotes("");

    // cancel any pending uploads or fetches
    if (uploadControllerRef.current) {
      try {
        uploadControllerRef.current.abort();
      } catch (err) {
        /* ignore */
      }
      uploadControllerRef.current = null;
    }
    if (fetchControllerRef.current) {
      try {
        fetchControllerRef.current.abort();
      } catch (err) {
        /* ignore */
      }
      fetchControllerRef.current = null;
    }

    onClose?.();
  };

  /* ------------------------------- Render --------------------------- */
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
            className="bg-white w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl shadow-xl p-5 relative"
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
          >
            <button aria-label="Close" className="absolute top-3 right-3 text-gray-400 hover:text-gray-600" onClick={handleClose}>
              <XCircle size={22} />
            </button>

            <h2 className="text-lg font-semibold text-gray-800 mb-3">🧾 File New Case</h2>

            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Title */}
              <div>
                <label className="text-sm font-medium text-gray-700">Case Title</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1 text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter case title"
                  required
                />
              </div>

              {/* Category & Priority */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                    <FolderKanban size={14} /> Category
                  </label>
                  <select name="category" value={formData.category} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-2 py-2 mt-1 text-sm">
                    <option value="civil">Civil</option>
                    <option value="criminal">Criminal</option>
                    <option value="adr">ADR</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Priority</label>
                  <select name="priority" value={formData.priority} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-2 py-2 mt-1 text-sm">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              {/* Client / Respondent */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-sm font-medium text-gray-700">Client</label>
                  <select name="clientId" value={formData.clientId} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-2 py-2 mt-1 text-sm">
                    <option value="">Select client</option>
                    {clients.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name || c.email || c._id}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                    Respondent <Info size={12} className="text-gray-400" title="Opposing party or defendant" />
                  </label>
                  <select name="respondentId" value={formData.respondentId} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-2 py-2 mt-1 text-sm">
                    <option value="">Select respondent</option>
                    {respondents.map((r) => (
                      <option key={r._id} value={r._id}>
                        {r.name || r.email || r._id}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-sm font-medium text-gray-700">Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1 text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="Brief summary of the case"
                />
              </div>

              {/* Attachments */}
              <div>
                <label className="text-sm font-medium text-gray-700">Attachments</label>
                <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg py-3 cursor-pointer hover:border-blue-400 text-gray-500 mt-1 text-sm">
                  <UploadCloud size={16} />
                  {uploading ? `Uploading... ${uploadProgress}%` : "Click or drop files"}
                  <input type="file" multiple onChange={handleFileUpload} className="hidden" disabled={uploading} />
                </label>

                {uploading && uploadProgress > 0 && (
                  <div className="flex items-center gap-2 mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                    </div>
                    <button type="button" onClick={cancelUpload} className="text-sm text-red-600 ml-2">
                      Cancel
                    </button>
                  </div>
                )}

                {formData.attachments?.length > 0 && (
                  <ul className="text-sm text-gray-600 mt-1 space-y-1">
                    {formData.attachments.map((f, i) => (
                      <li key={i} className="truncate">
                        <a href={f.fileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          {f.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Share list */}
              <div>
                <button type="button" onClick={() => setShowShareList((p) => !p)} className="flex items-center gap-2 text-sm text-blue-600 mt-2">
                  <Users size={15} />
                  {showShareList ? "Hide share list" : "Share with others"}
                </button>

                {showShareList && (
                  <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-lg mt-2">
                    {allUsers.map((u) => (
                      <label key={u._id} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 text-sm cursor-pointer border-b last:border-none">
                        <span>{u.name || u.email}</span>
                        <input type="checkbox" checked={formData.sharedWith.includes(u._id)} onChange={() => toggleShare(u._id)} className="accent-blue-600 w-4 h-4" />
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Initial hearing scheduling */}
              <div className="pt-2 border-t">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={scheduleHearing} onChange={() => setScheduleHearing((p) => !p)} className="w-4 h-4" />
                  <span className="text-sm">Schedule an initial hearing when filing (optional)</span>
                </label>

                {scheduleHearing && (
                  <div className="grid gap-2 mt-2">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Hearing Date & Time</label>
                      <input type="datetime-local" value={hearingDate} onChange={(e) => setHearingDate(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1 text-sm" />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-700">Hearing Title</label>
                      <input type="text" value={hearingTitle} onChange={(e) => setHearingTitle(e.target.value)} placeholder="e.g. Preliminary hearing" className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1 text-sm" />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-700">Notes (optional)</label>
                      <textarea value={hearingNotes} onChange={(e) => setHearingNotes(e.target.value)} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1 text-sm" placeholder="Details or meeting link" />
                    </div>
                  </div>
                )}
              </div>

              {/* Submit */}
              <button type="submit" disabled={submitting} className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition text-sm disabled:opacity-50">
                {submitting ? "Submitting..." : "File Case"}
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
