import React, { useEffect, useState } from "react";
import { FileText, Download, Eye, Loader2, AlertCircle, Upload } from "lucide-react";
import { toast } from "sonner";
import API from "@/utils/api";
import { socket } from "@/utils/socket";

/**
 * ClientDocumentsPanel.jsx
 * ----------------------------------------------------------
 * Purpose:
 *  - Show all documents/evidence uploaded by a specific client.
 *  - Allow preview/download and show metadata.
 *  - Update in realtime via socket.io.
 *
 * Backend routes:
 *  - GET /clients/:id/evidence
 *  - POST /evidence/upload
 * Socket events:
 *  - evidence:new
 *  - evidence:update
 *  - evidence:deleted
 */

export default function ClientDocumentsPanel({ clientId }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  // 🔹 Fetch all documents for this client
  const fetchDocuments = async () => {
    try {
      const { data } = await API.get(`/clients/${clientId}/evidence`);
      setDocuments(data || []);
    } catch (err) {
      console.error("❌ Error fetching client documents:", err);
      toast.error("Failed to load documents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();

    // --- SOCKET EVENTS ---
    const handleEvidenceNew = (doc) => {
      if (doc.client === clientId) {
        setDocuments((prev) => [doc, ...prev]);
        toast.success(`New document uploaded: ${doc.filename}`);
      }
    };

    const handleEvidenceUpdate = (updatedDoc) => {
      if (updatedDoc.client === clientId) {
        setDocuments((prev) =>
          prev.map((d) => (d._id === updatedDoc._id ? updatedDoc : d))
        );
        toast.info(`Document updated: ${updatedDoc.filename}`);
      }
    };

    const handleEvidenceDelete = ({ _id }) => {
      setDocuments((prev) => prev.filter((d) => d._id !== _id));
      toast.warning("A document was deleted");
    };

    socket.on("evidence:new", handleEvidenceNew);
    socket.on("evidence:update", handleEvidenceUpdate);
    socket.on("evidence:deleted", handleEvidenceDelete);

    return () => {
      socket.off("evidence:new", handleEvidenceNew);
      socket.off("evidence:update", handleEvidenceUpdate);
      socket.off("evidence:deleted", handleEvidenceDelete);
    };
  }, [clientId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8 text-black-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading client documents...
      </div>
    );
  }

  if (!documents.length) {
    return (
      <div className="text-center text-black-500 py-10">
        <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-70" />
        No documents uploaded yet.
      </div>
    );
  }

  const DocumentCard = ({ doc }) => (
    <div className="bg-white p-4 rounded-lg shadow-sm border hover:shadow-md transition">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-500" />
          <h4 className="font-semibold text-black-800">{doc.filename}</h4>
        </div>
        <span className="text-xs text-black-500">
          {new Date(doc.createdAt).toLocaleDateString()}
        </span>
      </div>

      {doc.description && (
        <p className="text-sm text-black-600 line-clamp-2 mb-2">
          {doc.description}
        </p>
      )}

      <div className="flex justify-between items-center text-sm text-black-500">
        <span>Type: {doc.fileType || "Unknown"}</span>
        <span>Size: {formatSize(doc.size)}</span>
      </div>

      <div className="mt-3 flex gap-3">
        <a
          href={doc.fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          <Eye className="w-4 h-4" /> View
        </a>
        <a
          href={doc.fileUrl}
          download
          className="flex items-center gap-1 text-green-600 hover:text-green-800 text-sm font-medium"
        >
          <Download className="w-4 h-4" /> Download
        </a>
      </div>
    </div>
  );

  const formatSize = (bytes) => {
    if (!bytes) return "N/A";
    const units = ["B", "KB", "MB", "GB"];
    let i = 0;
    while (bytes >= 1024 && i < units.length - 1) {
      bytes /= 1024;
      i++;
    }
    return `${bytes.toFixed(1)} ${units[i]}`;
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-black-800 text-lg">
          Uploaded Documents
        </h3>
        <button
          onClick={() => toast.info("Upload feature coming soon!")}
          className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700"
        >
          <Upload className="w-4 h-4" /> Upload New
        </button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {documents.map((doc) => (
          <DocumentCard key={doc._id} doc={doc} />
        ))}
      </div>
    </div>
  );
}

