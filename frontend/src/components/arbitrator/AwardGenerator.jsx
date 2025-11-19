/**
 * AwardGenerator.jsx
 * ------------------------------------------------------------
 * 🎯 Purpose:
 * For arbitrators to compose, preview, and issue final arbitration awards.
 *
 * ✅ Features:
 *  - Draft award text (rich or plain)
 *  - Save and issue decision
 *  - Generate signed PDF via backend job
 *  - Track award status (pending → issued)
 *  - Download generated PDF
 */

import React, { useEffect, useState } from "react";
import axios from "@/utils/axiosInstance";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";import { Loader2, FileText, Download, CheckCircle } from "lucide-react";

export default function AwardGenerator({ arbitrationId }) {
  const [awardText, setAwardText] = useState("");
  const [decisionDate, setDecisionDate] = useState("");
  const [awardStatus, setAwardStatus] = useState("draft");
  const [awardPdfUrl, setAwardPdfUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Load existing award (if any)
  useEffect(() => {
    const fetchAward = async () => {
      try {
        setLoading(true);
        const { data } = await axios.get(`/api/arbitrations/${arbitrationId}`);
        if (data?.awardText) {
          setAwardText(data.awardText);
          setDecisionDate(data.decisionDate?.split("T")[0] || "");
          setAwardStatus(data.awardStatus || "draft");
          setAwardPdfUrl(data.awardPdf || "");
        }
      } catch (err) {
        console.error(err);
        toast({
          title: "Failed to load award",
          description: err.response?.data?.message || "Try again later.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    fetchAward();
  }, [arbitrationId]);

  const handleSaveDraft = async () => {
    try {
      setLoading(true);
      await axios.put(`/api/arbitrations/${arbitrationId}/award`, {
        awardText,
        decisionDate,
        awardStatus: "draft",
      });
      setAwardStatus("draft");
      toast({ title: "Draft saved successfully" });
    } catch (err) {
      toast({
        title: "Failed to save draft",
        description: err.response?.data?.message || "Try again later.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleIssueAward = async () => {
    if (!awardText.trim()) {
      toast({ title: "Add award text before issuing", variant: "destructive" });
      return;
    }
    setGenerating(true);
    try {
      const { data } = await axios.post(`/api/arbitrations/${arbitrationId}/award/issue`, {
        awardText,
        decisionDate: decisionDate || new Date().toISOString(),
      });

      // Backend triggers award PDF generation (async)
      toast({
        title: "Award issued",
        description: "PDF generation started.",
      });
      setAwardStatus("issued");

      // Poll for generated PDF link (optional fallback)
      setTimeout(() => checkAwardPdf(), 3000);
    } catch (err) {
      console.error(err);
      toast({
        title: "Failed to issue award",
        description: err.response?.data?.message || "Try again later.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const checkAwardPdf = async () => {
    try {
      const { data } = await axios.get(`/api/arbitrations/${arbitrationId}`);
      if (data.awardPdf) {
        setAwardPdfUrl(data.awardPdf);
        toast({
          title: "Award PDF ready",
          description: "Click Download to open.",
        });
      }
    } catch (err) {
      console.error("PDF check failed:", err);
    }
  };

  const downloadPdf = () => {
    if (!awardPdfUrl) return;
    const link = document.createElement("a");
    link.href = awardPdfUrl;
    link.download = `award_${arbitrationId}.pdf`;
    link.target = "_blank";
    link.click();
  };

  return (
    <Card className="border border-black-200 shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-black-800">
          <FileText className="w-5 h-5 text-blue-600" />
          Arbitration Award Generator
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="awardText">Award Decision Text</Label>
          <Textarea
            id="awardText"
            rows={10}
            placeholder="Write the arbitrator's reasoning and final decision..."
            value={awardText}
            onChange={(e) => setAwardText(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="decisionDate">Decision Date</Label>
          <input
            id="decisionDate"
            type="date"
            className="border border-black-300 rounded-md p-2 w-full"
            value={decisionDate}
            onChange={(e) => setDecisionDate(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-black-600">Status:</span>
          <span
            className={`text-sm font-semibold ${
              awardStatus === "issued"
                ? "text-green-600"
                : awardStatus === "draft"
                ? "text-yellow-600"
                : "text-black-500"
            }`}
          >
            {awardStatus.toUpperCase()}
          </span>
        </div>

        {awardPdfUrl && (
          <div className="mt-4 flex items-center gap-3">
            <Button onClick={downloadPdf} className="flex items-center gap-2">
              <Download className="h-4 w-4" /> Download Award PDF
            </Button>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex gap-3">
        <Button
          onClick={handleSaveDraft}
          disabled={loading || generating}
          variant="outline"
        >
          {loading ? <Loader2 className="animate-spin w-4 h-4" /> : "Save Draft"}
        </Button>

        <Button
          onClick={handleIssueAward}
          disabled={generating}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
        >
          {generating ? (
            <Loader2 className="animate-spin w-4 h-4" />
          ) : (
            <CheckCircle className="w-4 h-4" />
          )}
          Issue Award
        </Button>
      </CardFooter>
    </Card>
  );
}
