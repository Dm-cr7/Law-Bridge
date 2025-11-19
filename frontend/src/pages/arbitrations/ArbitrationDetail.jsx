/**
 * ArbitrationDetail.jsx
 * ------------------------------------------------------------
 * 📄 Detailed view of a specific Arbitration case
 *
 * Features:
 *  ✅ Displays core case metadata and parties
 *  ✅ Lists uploaded evidence with preview/download
 *  ✅ Allows arbitrator/admin to trigger Award PDF generation
 *  ✅ Shows award PDF link if generated
 *  ✅ Shows timeline of actions (optional future extension)
 *
 * Dependencies:
 *  - axios (for API calls)
 *  - react-router-dom (useParams, useNavigate)
 *  - shadcn/ui for Card, Button, Spinner
 *  - TailwindCSS for styling
 */

import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/Button";
import { Loader2, FileText, FileDown, RefreshCcw } from "lucide-react";
import { toast } from "react-hot-toast";

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

export default function ArbitrationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [arbitration, setArbitration] = useState(null);
  const [evidence, setEvidence] = useState([]);
  const [generating, setGenerating] = useState(false);

  /* =======================================================
     Fetch Arbitration + Evidence Data
     ======================================================= */
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [arbRes, evRes] = await Promise.all([
          axios.get(`${API_BASE}/arbitrations/${id}`),
          axios.get(`${API_BASE}/evidence/by-arbitration/${id}`),
        ]);
        setArbitration(arbRes.data);
        setEvidence(evRes.data || []);
      } catch (err) {
        console.error("Failed to fetch arbitration details:", err);
        toast.error("Failed to load arbitration details");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  /* =======================================================
     Trigger Award PDF Generation
     ======================================================= */
  const handleGenerateAward = async () => {
    if (!id) return;
    try {
      setGenerating(true);
      const res = await axios.post(`${API_BASE}/awards/generate/${id}`);
      if (res.data?.message) toast.success(res.data.message);
      else toast.success("Award generation started");
    } catch (err) {
      console.error("Error triggering award PDF:", err);
      toast.error("Failed to trigger award PDF generation");
    } finally {
      setGenerating(false);
    }
  };

  /* =======================================================
     Render Helpers
     ======================================================= */
  if (loading)
    return (
      <div className="flex h-80 items-center justify-center">
        <Loader2 className="animate-spin mr-2" />
        <span>Loading arbitration details...</span>
      </div>
    );

  if (!arbitration)
    return (
      <div className="text-center text-black-500 mt-10">
        ⚠️ Arbitration not found.
      </div>
    );

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          Arbitration Case #{arbitration._id.slice(-6)}
        </h1>
        <Button variant="secondary" onClick={() => navigate(-1)}>
          ← Back
        </Button>
      </div>

      {/* Case Info */}
      <Card>
        <CardHeader>
          <CardTitle>Case Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <strong>Title:</strong> {arbitration.title || "Untitled"}
          </p>
          <p>
            <strong>Status:</strong>{" "}
            <span
              className={`${
                arbitration.status === "closed"
                  ? "text-green-600"
                  : "text-yellow-600"
              } font-medium`}
            >
              {arbitration.status}
            </span>
          </p>
          <p>
            <strong>Filed On:</strong>{" "}
            {new Date(arbitration.createdAt).toLocaleDateString()}
          </p>
          <p>
            <strong>Arbitrator:</strong>{" "}
            {arbitration.arbitrator?.name || "Unassigned"}
          </p>
          <p>
            <strong>Claimant:</strong>{" "}
            {arbitration.claimant?.name || "N/A"} (
            {arbitration.claimant?.email || "—"})
          </p>
          <p>
            <strong>Respondent:</strong>{" "}
            {arbitration.respondent?.name || "N/A"} (
            {arbitration.respondent?.email || "—"})
          </p>
        </CardContent>
      </Card>

      {/* Evidence Section */}
      <Card>
        <CardHeader>
          <CardTitle>Evidence</CardTitle>
        </CardHeader>
        <CardContent>
          {evidence.length === 0 ? (
            <p className="text-black-500 text-sm">No evidence uploaded yet.</p>
          ) : (
            <ul className="divide-y divide-black-200">
              {evidence.map((ev) => (
                <li
                  key={ev._id}
                  className="flex items-center justify-between py-2"
                >
                  <div className="flex items-center space-x-2">
                    <FileText className="h-4 w-4 text-blue-500" />
                    <span>{ev.filename}</span>
                  </div>
                  <a
                    href={ev.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline flex items-center"
                  >
                    <FileDown className="h-4 w-4 mr-1" />
                    Download
                  </a>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Award Section */}
      <Card>
        <CardHeader>
          <CardTitle>Award Document</CardTitle>
        </CardHeader>
        <CardContent>
          {arbitration.awardPdf ? (
            <div className="flex items-center space-x-3">
              <a
                href={arbitration.awardPdf}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline flex items-center"
              >
                <FileText className="h-4 w-4 mr-1" />
                View Award PDF
              </a>
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.location.reload()}
              >
                <RefreshCcw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-black-500 text-sm">
                No award PDF generated yet.
              </p>
              <Button onClick={handleGenerateAward} disabled={generating}>
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate Award PDF"
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
