/**
 * NewCaseModal.jsx
 * ------------------------------------------------------------
 * Production-ready modal for filing new cases.
 * - Defensive endpoint builder (avoids double /api)
 * - Fetch clients/respondents/users with parallel requests
 * - File uploads with progress
 * - Abort/cancel fetch on unmount/close
 * - Clearer logging & error toasts
 * ------------------------------------------------------------
 */

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { XCircle, UploadCloud, Users, FolderKanban, Info } from "lucide-react";
import axios from "@/utils/axiosInstance";
import toast from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";

export default function NewCaseModal({ isOpen, onClose, onSuccess }) {
  const { user, token } = useAuth();

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

  const [clients, setClients] = useState([]);
  const [respondents, setRespondents] = useState([]);
  const [allUsers, setAllUsers] = useState([]);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [showShareList, setShowShareList] = useState(false);

  // Helper: build a request path that avoids double /api
  const buildPath = useCallback((pathWithoutApi) => {
    // pathWithoutApi example: "users" or "upload/multiple" or "cases"
    const base = axios.defaults?.baseURL || "";
    // Normalize trailing slash
    const baseEndsWithApi = !!base && base.replace(/\/+$/, "").endsWith("/api");
    return baseEndsWithApi ? `/${pathWithoutApi}` : `/api/${pathWithoutApi}`;
  }, []);

  useEffect(() => {
    if (!isOpen || !token) return;

    // prevent background scrolling while modal open
    document.body.style.overflow = "hidden";

    const ac = new AbortController();
    const signal = ac.signal;

    const fetchData = async () => {
      try {
        console.log("axios baseURL:", axios.defaults?.baseURL);
        const headers = { Authorization: `Bearer ${token}` };

        // choose endpoints defensively using buildPath
        const clientsPath = buildPath("users");
        const usersPath = buildPath("users");

        // note: clients fetch uses role=client as param
        const [clientsRes, usersRes] = await Promise.all([
          axios.get(clientsPath, { params: { role: "client" }, headers, signal }),
          axios.get(usersPath, { headers, signal }),
        ]);

        const clientsData = clientsRes?.data || [];
        setClients(clientsData);

        // If you have a separate respondents endpoint, swap this:
        // const respondentsRes = await axios.get(buildPath('users'), { params: { role: 'respondent' }, headers, signal });
        // setRespondents(respondentsRes?.data || []);
        // For now reuse clients (as original file did)
        setRespondents(clientsData);

        const usersData = (usersRes?.data || []).filter((u) => u._id !== user?._id);
        setAllUsers(usersData);
      } catch (err) {
        if (signal.aborted) {
          console.log("Fetch users aborted");
          return;
        }
        console.error("❌ Error loading users:", err, err?.response?.data);
        toast.error(
          err?.response?.data?.message ||
            (err?.message ? `Failed to load users: ${err.message}` : "Failed to load users")
        );
      }
    };

    fetchData();

    return () => {
      ac.abort();
      document.body.style.overflow = "auto";
    };
  }, [isOpen, token, user, buildPath]);

  /* =======================================================
     Handle Form Inputs
  ======================================================= */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
  };

  /* =======================================================
     Upload Attachments (via /api/upload/multiple)
  ======================================================= */
  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      const data = new FormData();
      files.forEach((file) => data.append("files", file));

      const path = buildPath("upload/multiple");

      const res = await axios.post(path, data, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
        onUploadProgress: (evt) => {
          // guard against zero total
          const percent = evt.total ? Math.round((evt.loaded * 100) / evt.total) : 0;
          setUploadProgress(percent);
        },
      });

      const uploaded =
        res?.data?.files?.map((f) => ({
          name: f.name,
          fileUrl: f.fileUrl,
        })) || [];

      setFormData((p) => ({
        ...p,
        attachments: [...p.attachments, ...uploaded],
      }));

      toast.success(`${uploaded.length} file(s) uploaded successfully`);
    } catch (err) {
      console.error("❌ Upload failed:", err, err?.response?.data);
      toast.error(err?.response?.data?.message || "Upload failed");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  /* =======================================================
     Toggle shared user selection
  ======================================================= */
  const toggleShare = (id) => {
    setFormData((p) => ({
      ...p,
      sharedWith: p.sharedWith.includes(id) ? p.sharedWith.filter((uid) => uid !== id) : [...p.sharedWith, id],
    }));
  };

  /* =======================================================
     Submit new case
  ======================================================= */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) return toast.error("Case title is required");
    if (!formData.clientId) return toast.error("Please select a client");

    try {
      setSubmitting(true);
      const payload = {
        ...formData,
        filedBy: user?._id,
      };

      const path = buildPath("cases");
      const { data } = await axios.post(path, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      toast.success("✅ Case filed successfully");
      onSuccess?.(data);
      handleClose();
    } catch (err) {
      console.error("❌ Create case error:", err, err?.response?.data);
      toast.error(err?.response?.data?.message || "Failed to create case");
    } finally {
      setSubmitting(false);
    }
  };

  /* =======================================================
     Close and reset
  ======================================================= */
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
    onClose?.();
  };

  /* =======================================================
     Render
  ======================================================= */
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
            {/* Close */}
            <button className="absolute top-3 right-3 text-gray-400 hover:text-gray-600" onClick={handleClose}>
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
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-2 py-2 mt-1 text-sm"
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
                    className="w-full border border-gray-300 rounded-lg px-2 py-2 mt-1 text-sm"
                  >
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
                  <select
                    name="clientId"
                    value={formData.clientId}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-2 py-2 mt-1 text-sm"
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
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                    Respondent
                    <Info size={12} className="text-gray-400" title="Opposing party or defendant" />
                  </label>
                  <select
                    name="respondentId"
                    value={formData.respondentId}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-2 py-2 mt-1 text-sm"
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

                {uploadProgress > 0 && uploading && (
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                    <div className="bg-blue-500 h-2 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
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

              {/* Share */}
              <div>
                <button type="button" onClick={() => setShowShareList((p) => !p)} className="flex items-center gap-2 text-sm text-blue-600 mt-2">
                  <Users size={15} />
                  {showShareList ? "Hide share list" : "Share with others"}
                </button>

                {showShareList && (
                  <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-lg mt-2">
                    {allUsers.map((u) => (
                      <label key={u._id} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 text-sm cursor-pointer border-b last:border-none">
                        <span>{u.name}</span>
                        <input type="checkbox" checked={formData.sharedWith.includes(u._id)} onChange={() => toggleShare(u._id)} className="accent-blue-600 w-4 h-4" />
                      </label>
                    ))}
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
