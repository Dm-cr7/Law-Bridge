import React, { useEffect, useState } from "react";
import {
  FileText,
  Download,
  Loader2,
  FileCheck,
  AlertCircle,
  FileArchive,
} from "lucide-react";
import { toast } from "sonner";
import { socket } from "@/utils/socket";
import API from "@/utils/api";

/**
 * ClientDocumentsList
 * --------------------------------
 * Purpose:
 *  - Show all documents belonging to a client (evidence, awards, attachments)
 *  - Allow preview & download
 *  - Real-time updates when new documents are added
 */

export default function ClientDocumentsList({ clientId }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDocuments = async () => {
    try {
      const { data } = await API.get(`/clients/${clientId}/documents`);
      setDocuments(data || []);
    } catch (err) {
      console.error("❌ Error fetching documents:", err);
      toast.error("Failed to load client documents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();

    // Handle realtime updates
    const handleDocNew = (newDoc) => {
      if (newDoc.client === clientId) {
        setDocuments((prev) => [newDoc, ...prev]);
        toast.success(`New document uploaded: ${newDoc.filename}`);
      }
    };

    const handleDocDelete = ({ _id }) => {
      setDocuments((prev) => prev.filter((d) => d._id !== _id));
      toast.warning("A document was removed");
    };

    socket.on("document:new", handleDocNew);
    socket.on("document:deleted", handleDocDelete);

    return () => {
      socket.off("document:new", handleDocNew);
      socket.off("document:deleted", handleDocDelete);
    };
  }, [clientId]);

  const handleDownload = async (doc) => {
    try {
      const response = await API.get(`/documents/${doc._id}/download`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", doc.originalName || doc.filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("❌ Error downloading file:", err);
      toast.error("Download failed");
    }
  };

  // UI STATES
  if (loading) {
    return (
      <div className="flex justify-center items-center py-10 text-black-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading client documents...
      </div>
    );
  }

  if (!documents.length) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-black-500">
        <FileArchive className="w-8 h-8 mb-2 opacity-70" />
        <p>No documents uploaded yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {documents.map((doc) => (
        <div
          key={doc._id}
          className="flex justify-between items-center p-4 border border-black-200 rounded-lg hover:shadow-md hover:border-blue-300 transition"
        >
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-blue-500" />
            <div>
              <h3 className="font-medium text-sm text-black-800">
                {doc.originalName || doc.filename}
              </h3>
              <p className="text-xs text-black-500">
                Uploaded:{" "}
                {new Date(doc.createdAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}{" "}
                • Type: {doc.type || "general"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {doc.isVerified && (
              <span className="flex items-center text-green-600 text-xs">
                <FileCheck className="w-4 h-4 mr-1" /> Verified
              </span>
            )}
            <button
              onClick={() => handleDownload(doc)}
              className="flex items-center text-blue-600 hover:text-blue-800 text-sm"
            >
              <Download className="w-4 h-4 mr-1" /> Download
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
