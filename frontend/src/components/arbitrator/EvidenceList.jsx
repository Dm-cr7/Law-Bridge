/**
 * EvidenceList.jsx
 * ------------------------------------------------------------
 * 🔹 Purpose:
 *   Display and manage evidence files linked to an arbitration.
 *
 * Features:
 *  ✅ Fetch all evidence by arbitrationId
 *  ✅ Search + filter by category
 *  ✅ Download, verify, delete
 *  ✅ Responsive and real-time ready
 */

import React, { useEffect, useState } from "react";
import axios from "@/utils/axiosInstance";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/Input";
import {
  Download,
  Trash2,
  CheckCircle,
  XCircle,
  RefreshCw,
  FileText,
  Loader2,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function EvidenceList({ arbitrationId, isArbitrator = false }) {
  const { toast } = useToast();
  const [evidenceList, setEvidenceList] = useState([]);
  const [filteredList, setFilteredList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  /* =======================================================
     🔄 FETCH EVIDENCE
     ======================================================= */
  const fetchEvidence = async () => {
    if (!arbitrationId) return;
    setLoading(true);
    try {
      const { data } = await axios.get(
        `/api/evidence/arbitration/${arbitrationId}?limit=100`
      );
      setEvidenceList(data.items || data || []);
      setFilteredList(data.items || data || []);
    } catch (error) {
      console.error("Error fetching evidence:", error);
      toast({
        title: "Failed to Load Evidence",
        description:
          error?.response?.data?.message || "Unable to fetch evidence list.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvidence();
  }, [arbitrationId, refreshKey]);

  /* =======================================================
     🔍 FILTERING
     ======================================================= */
  useEffect(() => {
    let result = [...evidenceList];
    if (filter)
      result = result.filter(
        (e) => e.meta?.category?.toLowerCase() === filter.toLowerCase()
      );
    if (search)
      result = result.filter((e) =>
        e.title.toLowerCase().includes(search.toLowerCase())
      );
    setFilteredList(result);
  }, [filter, search, evidenceList]);

  /* =======================================================
     📥 DOWNLOAD FILE
     ======================================================= */
  const handleDownload = (fileUrl, name = "evidence") => {
    if (!fileUrl) {
      toast({ title: "No file URL available", variant: "destructive" });
      return;
    }
    const link = document.createElement("a");
    link.href = fileUrl;
    link.download = name;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast({
      title: "Download Started",
      description: "Your file is being downloaded.",
    });
  };

  /* =======================================================
     ✅ VERIFY / ❌ UNVERIFY
     ======================================================= */
  const toggleVerify = async (id, verified) => {
    try {
      await axios.patch(`/api/evidence/${id}/verify`);
      setEvidenceList((prev) =>
        prev.map((e) =>
          e._id === id ? { ...e, verified: !verified } : e
        )
      );
      toast({
        title: !verified ? "Evidence Verified" : "Verification Revoked",
        description: !verified
          ? "Evidence marked as verified."
          : "Verification removed.",
      });
    } catch (err) {
      console.error("Verification error:", err);
      toast({
        title: "Verification Failed",
        description: "Unable to change verification status.",
        variant: "destructive",
      });
    }
  };

  /* =======================================================
     🗑️ DELETE EVIDENCE
     ======================================================= */
  const handleDelete = async (id) => {
    const confirm = window.confirm(
      "Are you sure you want to permanently delete this evidence?"
    );
    if (!confirm) return;

    try {
      await axios.delete(`/api/evidence/${id}`);
      setEvidenceList((prev) => prev.filter((e) => e._id !== id));
      toast({
        title: "Evidence Deleted",
        description: "Evidence was removed successfully.",
      });
    } catch (err) {
      console.error("Delete error:", err);
      toast({
        title: "Delete Failed",
        description: "Could not delete evidence file.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="shadow-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 transition-colors">
      <CardHeader className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
        <CardTitle className="text-lg font-semibold text-gray-800 dark:text-gray-100">
          Uploaded Evidence
        </CardTitle>

        <div className="flex gap-2">
          <Button
            onClick={() => setRefreshKey((k) => k + 1)}
            variant="outline"
            size="sm"
            className="flex items-center gap-1"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {/* 🔍 Filters */}
        <div className="flex flex-wrap gap-3 items-center mb-4">
          <Input
            placeholder="Search evidence..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />

          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded-md p-2 bg-white dark:bg-gray-800"
          >
            <option value="">All Categories</option>
            <option value="Document">Documents</option>
            <option value="Image">Images</option>
            <option value="Video">Videos</option>
            <option value="Audio">Audio</option>
            <option value="Other">Other</option>
          </select>
        </div>

        {/* 🌀 Loading */}
        {loading ? (
          <div className="flex justify-center items-center py-10 text-gray-500 dark:text-gray-400">
            <Loader2 className="h-5 w-5 mr-2 animate-spin" /> Loading evidence...
          </div>
        ) : filteredList.length === 0 ? (
          <p className="text-center text-gray-500 py-6">
            No evidence uploaded yet.
          </p>
        ) : (
          <div className="grid gap-3">
            {filteredList.map((evidence) => (
              <div
                key={evidence._id}
                className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition"
              >
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 mt-1 text-gray-600 dark:text-gray-400" />
                  <div>
                    <p className="font-medium text-gray-800 dark:text-gray-100">
                      {evidence.title}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {evidence.meta?.category || "Uncategorized"} •{" "}
                      {new Date(evidence.createdAt).toLocaleString()}
                    </p>
                    <Badge
                      className={`mt-1 ${
                        evidence.verified
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {evidence.verified ? "Verified" : "Pending"}
                    </Badge>
                  </div>
                </div>

                <div className="flex gap-2 mt-3 sm:mt-0">
                  {/* Download */}
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Download Evidence"
                    onClick={() =>
                      handleDownload(evidence.fileUrl, evidence.fileName)
                    }
                  >
                    <Download className="h-4 w-4" />
                  </Button>

                  {/* Verify */}
                  {isArbitrator && (
                    <Button
                      size="icon"
                      variant="ghost"
                      title={evidence.verified ? "Unverify" : "Verify"}
                      onClick={() =>
                        toggleVerify(evidence._id, evidence.verified)
                      }
                    >
                      {evidence.verified ? (
                        <XCircle className="h-4 w-4 text-red-500" />
                      ) : (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      )}
                    </Button>
                  )}

                  {/* Delete */}
                  {isArbitrator && (
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Delete Evidence"
                      onClick={() => handleDelete(evidence._id)}
                    >
                      <Trash2 className="h-4 w-4 text-gray-500" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
