/**
 * AwardIssueForm.jsx
 * ------------------------------------------------------------
 * 🎯 Purpose:
 * Allows an arbitrator to draft, issue, and save an arbitration award.
 *
 * ✅ Features:
 * - Rich text editor for award decision summary
 * - Validation and autosave support
 * - Submits award details to backend
 * - Option to generate signed PDF via backend service
 * - Displays confirmation, error toasts, and status indicators
 */

import React, { useState } from "react";
import axios from "@/utils/axiosInstance";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2, FileText, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
export default function AwardIssueForm({ arbitrationId, arbitratorId }) {
  const [awardText, setAwardText] = useState("");
  const [decisionDate, setDecisionDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!awardText.trim()) {
      toast({
        title: "Validation Error",
        description: "Award text cannot be empty.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data } = await axios.post(`/api/arbitrations/${arbitrationId}/award`, {
        awardText,
        decisionDate,
        arbitratorId,
      });

      toast({
        title: "Award Submitted",
        description: "The arbitration award has been saved successfully.",
      });

      // Automatically trigger PDF generation
      await triggerAwardPdf();

      setPdfUrl(data.awardPdf || null);
    } catch (error) {
      console.error("❌ Error issuing award:", error);
      toast({
        title: "Submission Failed",
        description:
          error.response?.data?.message ||
          "Could not submit award. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const triggerAwardPdf = async () => {
    setPdfGenerating(true);
    try {
      const { data } = await axios.post(`/api/awards/${arbitrationId}/generate`);
      toast({
        title: "Generating PDF",
        description: "Award PDF generation started in background.",
      });
    } catch (error) {
      console.error("❌ PDF generation error:", error);
      toast({
        title: "PDF Generation Failed",
        description:
          error.response?.data?.message ||
          "Could not generate PDF at this time.",
        variant: "destructive",
      });
    } finally {
      setPdfGenerating(false);
    }
  };

  return (
    <Card className="shadow-md border border-black-200">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-black-800">
          Issue Arbitration Award
        </CardTitle>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Decision Date */}
          <div>
            <Label htmlFor="decisionDate">Decision Date</Label>
            <Input
              id="decisionDate"
              type="date"
              value={decisionDate}
              onChange={(e) => setDecisionDate(e.target.value)}
              required
              className="mt-1"
            />
          </div>

          {/* Award Text */}
          <div>
            <Label htmlFor="awardText">Award Summary</Label>
            <Textarea
              id="awardText"
              value={awardText}
              onChange={(e) => setAwardText(e.target.value)}
              placeholder="Enter the full text of your arbitration award..."
              rows={10}
              className="mt-1"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <Button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" /> Submit Award
                </>
              )}
            </Button>

            <Button
              type="button"
              onClick={triggerAwardPdf}
              variant="outline"
              disabled={pdfGenerating || !arbitrationId}
              className="flex items-center gap-2"
            >
              {pdfGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Generating PDF...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4" /> Generate PDF
                </>
              )}
            </Button>
          </div>

          {/* PDF Download Section */}
          {pdfUrl && (
            <div className="mt-4 flex items-center gap-2">
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline flex items-center gap-2"
              >
                <FileText className="h-4 w-4" /> View / Download PDF
              </a>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
