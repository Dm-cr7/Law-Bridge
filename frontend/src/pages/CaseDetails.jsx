/**
 * CaseDetails.jsx
 * ------------------------------------------------------------
 * Displays a complete detailed view for a single case.
 * Includes overview, notes, attachments, and activity log.
 * Seamlessly integrated with backend + consistent with modals.
 * ------------------------------------------------------------
 */

import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  FileText,
  UploadCloud,
  MessageSquare,
  Users,
  Clock,
  ArrowLeft,
  Share2,
  Trash2,
  Edit,
} from "lucide-react";
import toast from "react-hot-toast";
import axios from "@/utils/axiosInstance";
import { useAuth } from "@/context/AuthContext";
import EditCaseModal from "@/components/EditCaseModal";
import ShareCaseModal from "@/components/ShareCaseModal";
import AttachEvidenceModal from "@/components/AttachEvidenceModal";
import CaseTimelineModal from "@/components/CaseTimelineModal";

export default function CaseDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();

  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [noteContent, setNoteContent] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState(null);
  const [showEdit, setShowEdit] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);

  const isOwner = caseData?.filedBy?._id === user?._id;

  /* =======================================================
     Fetch case details
  ======================================================= */
  const fetchCase = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(`/api/cases/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCaseData(data);
    } catch (err) {
      console.error("❌ Fetch case error:", err);
      toast.error("Failed to load case details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCase();
  }, [id]);

  /* =======================================================
     Add new note
  ======================================================= */
  const handleAddNote = async () => {
    if (!noteContent.trim()) return toast.error("Note cannot be empty");
    try {
      await axios.post(
        `/api/cases/${id}/note`,
        { content: noteContent },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("📝 Note added");
      setNoteContent("");
      fetchCase();
    } catch (err) {
      console.error("❌ Add note error:", err);
      toast.error("Failed to add note");
    }
  };

  /* =======================================================
     Upload document
  ======================================================= */
  const handleUpload = async () => {
    if (!selectedFile) return toast.error("Select a file first");

    setUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      await axios.post(`/api/cases/${id}/upload`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${token}`,
        },
        onUploadProgress: (evt) => {
          const percent = Math.round((evt.loaded * 100) / evt.total);
          setUploadProgress(percent);
        },
      });

      toast.success("📁 File uploaded successfully");
      setSelectedFile(null);
      fetchCase();
    } catch (err) {
      console.error("❌ Upload error:", err);
      toast.error("Upload failed");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  /* =======================================================
     Delete case (only owner)
  ======================================================= */
  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this case?")) return;
    try {
      await axios.delete(`/api/cases/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("🗑️ Case deleted");
      navigate("/cases");
    } catch (err) {
      console.error("❌ Delete error:", err);
      toast.error("Failed to delete case");
    }
  };

  /* =======================================================
     UI RENDER
  ======================================================= */
  if (loading)
    return (
      <div className="flex items-center justify-center h-screen text-gray-500">
        Loading case details...
      </div>
    );

  if (!caseData)
    return (
      <div className="flex flex-col items-center justify-center h-screen text-gray-600">
        <p>Case not found or access denied.</p>
        <button
          onClick={() => navigate("/cases")}
          className="mt-3 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Back to Cases
        </button>
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ArrowLeft
            className="cursor-pointer text-gray-600 hover:text-gray-800"
            onClick={() => navigate("/cases")}
          />
          <h1 className="text-2xl font-semibold text-gray-800">{caseData.title}</h1>
          <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full capitalize">
            {caseData.category}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {isOwner && (
            <>
              <button
                className="flex items-center gap-1 bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-200 text-sm"
                onClick={() => setShowEdit(true)}
              >
                <Edit size={15} /> Edit
              </button>
              <button
                className="flex items-center gap-1 bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200 text-sm"
                onClick={() => setShowShare(true)}
              >
                <Share2 size={15} /> Share
              </button>
              <button
                className="flex items-center gap-1 bg-red-100 text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-200 text-sm"
                onClick={handleDelete}
              >
                <Trash2 size={15} /> Delete
              </button>
            </>
          )}

          <button
            className="flex items-center gap-1 bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg hover:bg-emerald-200 text-sm"
            onClick={() => setShowEvidence(true)}
          >
            <UploadCloud size={15} /> Evidence
          </button>

          <button
            className="flex items-center gap-1 bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-200 text-sm"
            onClick={() => setShowTimeline(true)}
          >
            <Clock size={15} /> Timeline
          </button>
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Case Overview */}
        <div className="bg-white rounded-xl shadow p-5 space-y-3">
          <h2 className="font-semibold text-gray-700 mb-2">Case Overview</h2>
          <div>
            <p className="text-sm text-gray-500">Status:</p>
            <span className="text-sm bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
              {caseData.status}
            </span>
          </div>
          <div>
            <p className="text-sm text-gray-500">Priority:</p>
            <span
              className={`text-sm font-medium capitalize ${
                caseData.priority === "high"
                  ? "text-orange-600"
                  : caseData.priority === "urgent"
                  ? "text-red-600"
                  : "text-blue-600"
              }`}
            >
              {caseData.priority}
            </span>
          </div>
          <div>
            <p className="text-sm text-gray-500">Filed By:</p>
            <p className="font-medium">{caseData.filedBy?.name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Client:</p>
            <p className="font-medium">{caseData.client?.name || "—"}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Respondent:</p>
            <p className="font-medium">{caseData.respondent?.name || "—"}</p>
          </div>
        </div>

        {/* Notes Section */}
        <div className="bg-white rounded-xl shadow p-5 flex flex-col">
          <h2 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <MessageSquare size={18} /> Notes
          </h2>
          <div className="flex-grow max-h-72 overflow-y-auto space-y-2 mb-3">
            {caseData.notes?.length > 0 ? (
              caseData.notes.map((note, idx) => (
                <div key={idx} className="bg-gray-50 border border-gray-200 rounded-lg p-2">
                  <p className="text-sm text-gray-700">{note.content}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    — {note.createdBy?.name || "Unknown"},{" "}
                    {new Date(note.createdAt).toLocaleString()}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-sm">No notes yet.</p>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Write a note..."
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400"
            />
            <button
              onClick={handleAddNote}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Add
            </button>
          </div>
        </div>

        {/* Attachments */}
        <div className="bg-white rounded-xl shadow p-5 space-y-3">
          <h2 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <FileText size={18} /> Attachments
          </h2>
          <div className="border border-dashed border-gray-300 rounded-lg p-4 text-center">
            <label className="cursor-pointer text-gray-600 hover:text-blue-600">
              <UploadCloud size={18} className="mx-auto mb-1" />
              <input
                type="file"
                className="hidden"
                onChange={(e) => setSelectedFile(e.target.files[0])}
              />
              {selectedFile ? selectedFile.name : "Click to upload a document"}
            </label>

            {uploadProgress > 0 && uploading && (
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            )}

            {selectedFile && (
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="mt-2 bg-blue-600 text-white px-3 py-1.5 text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {uploading ? "Uploading..." : "Upload"}
              </button>
            )}
          </div>

          <ul className="text-sm text-blue-600 space-y-1">
            {caseData.attachments?.length > 0 ? (
              caseData.attachments.map((file, i) => (
                <li key={i}>
                  <a
                    href={file.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    {file.name}
                  </a>
                </li>
              ))
            ) : (
              <p className="text-gray-500 text-sm">No documents uploaded.</p>
            )}
          </ul>
        </div>
      </div>

      {/* Shared + Activity */}
      <div className="grid md:grid-cols-2 gap-6 mt-6">
        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Users size={18} /> Shared With
          </h2>
          {caseData.sharedWith?.length > 0 ? (
            <ul className="text-sm text-gray-700 space-y-1">
              {caseData.sharedWith.map((u) => (
                <li key={u._id}>
                  {u.name} <span className="text-gray-500">({u.email})</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 text-sm">No shared users.</p>
          )}
        </div>

        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Clock size={18} /> Activity Log
          </h2>
          <div className="max-h-64 overflow-y-auto text-sm text-gray-700 space-y-2">
            {caseData.history?.length > 0 ? (
              caseData.history
                .slice()
                .reverse()
                .map((entry, idx) => (
                  <div key={idx} className="border-b pb-1">
                    <p>
                      <span className="font-medium">{entry.action}</span>{" "}
                      <span className="text-gray-500">
                        — {entry.performedBy?.name || "Unknown"} at{" "}
                        {new Date(entry.timestamp).toLocaleString()}
                      </span>
                    </p>
                    {entry.note && (
                      <p className="text-gray-600 text-xs">{entry.note}</p>
                    )}
                  </div>
                ))
            ) : (
              <p className="text-gray-500 text-sm">No activity yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showEdit && (
        <EditCaseModal
          isOpen={showEdit}
          onClose={() => setShowEdit(false)}
          caseData={caseData}
          onUpdated={fetchCase}
        />
      )}

      {showShare && (
        <ShareCaseModal
          caseData={caseData}
          onClose={() => setShowShare(false)}
          onShared={fetchCase}
        />
      )}

      {showEvidence && (
        <AttachEvidenceModal
          caseData={caseData}
          onClose={() => setShowEvidence(false)}
          onUpdated={fetchCase}
        />
      )}

      {showTimeline && (
        <CaseTimelineModal
          caseData={caseData}
          onClose={() => setShowTimeline(false)}
        />
      )}
    </div>
  );
}
