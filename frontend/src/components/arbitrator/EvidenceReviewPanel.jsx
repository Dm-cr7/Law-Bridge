/**
 * EvidenceReviewPanel.jsx
 * ------------------------------------------------------------
 * 🎯 Purpose:
 * Allows arbitrators to review all submitted evidence, preview
 * each file, and mark as APPROVED or REJECTED.
 *
 * ✅ Features:
 *  - Fetches all evidence per arbitration
 *  - Displays file previews / metadata
 *  - Approve / reject actions (with reason)
 *  - Realtime updates via socket
 *  - Supports download and inline view for PDFs & images
 */

import React, { useEffect, useState } from "react";
import axios from "@/utils/axiosInstance";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";import {
  CheckCircle,
  XCircle,
  FileText,
  Download,
  Loader2,
  Eye,
} from "lucide-react";

export default function EvidenceReviewPanel({ arbitrationId, socket }) {
  const [evidenceList, setEvidenceList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [reviewNote, setReviewNote] = useState("");
  const [selectedEvidence, setSelectedEvidence] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Load all evidence
  useEffect(() => {
    const fetchEvidence = async () => {
      setLoading(true);
      try {
        const { data } = await axios.get(`/api/evidence/arbitration/${arbitrationId}`);
        setEvidenceList(data || []);
      } catch (err) {
        console.error("Error fetching evidence:", err);
        toast({
          title: "Error loading evidence",
          description: err.response?.data?.message || "Try again later.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    fetchEvidence();
  }, [arbitrationId]);

  // Socket listeners
  useEffect(() => {
    if (!socket) return;

    socket.on("evidence-submitted", (ev) => {
      if (ev.arbitrationId === arbitrationId)
        setEvidenceList((prev) => [...prev, ev]);
    });

    socket.on("evidence-updated", (update) => {
      if (update.arbitrationId === arbitrationId)
        setEvidenceList((prev) =>
          prev.map((e) => (e._id === update._id ? update : e))
        );
    });

    return () => {
      socket.off("evidence-submitted");
      socket.off("evidence-updated");
    };
  }, [socket, arbitrationId]);

  // Approve / reject
  const handleDecision = async (status) => {
    if (!selectedEvidence) return;
    if (status === "rejected" && !reviewNote.trim()) {
      toast({
        title: "Add reason",
        description: "Please include a rejection note.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        status,
        reviewNote: reviewNote || undefined,
      };

      const { data } = await axios.patch(
        `/api/evidence/${selectedEvidence._id}/review`,
        payload
      );

      setEvidenceList((prev) =>
        prev.map((e) => (e._id === data._id ? data : e))
      );
      socket?.emit("evidence-updated", data);

      toast({
        title:
          status === "approved"
            ? "Evidence Approved"
            : "Evidence Rejected",
        description: `Marked as ${status}.`,
      });

      setSelectedEvidence(null);
      setReviewNote("");
    } catch (err) {
      toast({
        title: "Action failed",
        description: err.response?.data?.message || "Try again later.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const downloadFile = (url) => {
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.download = url.split("/").pop();
    link.click();
  };

  const renderFilePreview = (item) => {
    const ext = item.filename.split(".").pop().toLowerCase();
    if (["jpg", "jpeg", "png", "gif"].includes(ext)) {
      return (
        <img
          src={item.fileUrl}
          alt={item.filename}
          className="max-h-40 rounded-md object-contain border"
        />
      );
    } else if (ext === "pdf") {
      return (
        <iframe
          src={item.fileUrl}
          className="w-full h-60 border rounded-md"
          title={item.filename}
        />
      );
    } else {
      return (
        <div className="flex items-center gap-2 text-black-500">
          <FileText className="h-4 w-4" />
          <span>{item.filename}</span>
        </div>
      );
    }
  };

  return (
    <Card className="shadow-md border border-black-200">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-black-800 flex items-center gap-2">
          <FileText className="w-5 h-5" /> Evidence Review Panel
        </CardTitle>
      </CardHeader>

      <CardContent>
        {loading ? (
          <p className="text-black-500">Loading evidence...</p>
        ) : evidenceList.length === 0 ? (
          <p className="text-black-500">No evidence submitted yet.</p>
        ) : (
          <ul className="space-y-4">
            {evidenceList.map((item) => (
              <li
                key={item._id}
                className={`p-4 border rounded-md transition ${
                  item.status === "approved"
                    ? "border-green-300 bg-green-50"
                    : item.status === "rejected"
                    ? "border-red-300 bg-red-50"
                    : "border-black-200"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
                  <div className="flex flex-col">
                    <span className="font-medium text-black-700">
                      {item.title || item.filename}
                    </span>
                    <span className="text-sm text-black-500">
                      Uploaded by: {item.uploadedBy?.name || "Unknown"}
                    </span>
                    <span className="text-xs text-black-400">
                      Status: {item.status || "pending"}
                    </span>
                  </div>

                  <div className="flex gap-2 mt-2 sm:mt-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadFile(item.fileUrl)}
                    >
                      <Download className="h-4 w-4 mr-1" /> Download
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setSelectedEvidence(item)}
                      variant="secondary"
                    >
                      <Eye className="h-4 w-4 mr-1" /> Review
                    </Button>
                  </div>
                </div>

                {/* Inline preview */}
                <div className="mt-3">{renderFilePreview(item)}</div>
              </li>
            ))}
          </ul>
        )}

        {selectedEvidence && (
          <div className="mt-6 border-t pt-4">
            <h3 className="font-semibold text-black-800 mb-2">
              Reviewing: {selectedEvidence.filename}
            </h3>
            <Label htmlFor="reviewNote">Review Note</Label>
            <Textarea
              id="reviewNote"
              rows={3}
              placeholder="Add comments or rejection reason..."
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
            />

            <div className="flex gap-3 mt-3">
              <Button
                disabled={submitting}
                onClick={() => handleDecision("approved")}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                Approve
              </Button>

              <Button
                disabled={submitting}
                onClick={() => handleDecision("rejected")}
                variant="destructive"
                className="flex items-center gap-2"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                Reject
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
