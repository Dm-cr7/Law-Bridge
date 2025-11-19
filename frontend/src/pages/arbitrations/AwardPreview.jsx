/**
 * AwardPreview.jsx
 * ------------------------------------------------------------
 * 🔹 Purpose: Display the issued arbitration award and allow PDF download.
 *
 * Features:
 *  ✅ Shows award details, decision summary, and metadata
 *  ✅ Fetches the award (linked to arbitrationId)
 *  ✅ Download PDF button with backend integration
 *  ✅ Graceful fallback when no award is generated yet
 *  ✅ Fully responsive and styled for production
 */

import React, { useEffect, useState } from "react";
import axios from "@/utils/axiosInstance";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Loader2, FileText, Download } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
export default function AwardPreview({ arbitrationId }) {
  const [loading, setLoading] = useState(true);
  const [award, setAward] = useState(null);

  // ✅ Fetch award data
  useEffect(() => {
    const fetchAward = async () => {
      try {
        setLoading(true);
        const { data } = await axios.get(`/api/awards/${arbitrationId}`);
        if (data?.success && data.award) {
          setAward(data.award);
        } else {
          toast({
            title: "No Award",
            description: "No award has been issued for this arbitration yet.",
          });
        }
      } catch (err) {
        console.error("Error loading award:", err);
        toast({
          title: "Error",
          description: err?.response?.data?.message || "Failed to load award details.",
        });
      } finally {
        setLoading(false);
      }
    };
    if (arbitrationId) fetchAward();
  }, [arbitrationId]);

  // ✅ Handle PDF download
  const handleDownload = () => {
    if (award?.pdfUrl) {
      window.open(award.pdfUrl, "_blank");
    } else {
      toast({ title: "No PDF available", description: "Award PDF not found." });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-10 text-black-500">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading award details...
      </div>
    );
  }

  if (!award) {
    return (
      <Card className="border border-dashed border-black-300 text-center p-10 bg-black-50">
        <FileText className="mx-auto mb-2 text-black-400 h-10 w-10" />
        <p className="text-black-500 font-medium">No award issued yet for this arbitration.</p>
      </Card>
    );
  }

  return (
    <Card className="shadow-md border border-black-200">
      <CardHeader className="flex justify-between items-center">
        <div>
          <CardTitle className="text-xl font-semibold text-black-800">
            Arbitration Award
          </CardTitle>
          <p className="text-sm text-black-500">
            Issued on {new Date(award.createdAt).toLocaleDateString()}
          </p>
        </div>
        <Button variant="outline" onClick={handleDownload}>
          <Download className="h-4 w-4 mr-2" />
          Download PDF
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <h3 className="font-semibold text-black-700">Arbitrator</h3>
          <p className="text-black-600">{award.arbitrator?.name || "N/A"}</p>
        </div>

        <div>
          <h3 className="font-semibold text-black-700">Parties</h3>
          <p className="text-black-600">
            Claimant: {award.claimant?.name || "—"} <br />
            Respondent: {award.respondent?.name || "—"}
          </p>
        </div>

        <div>
          <h3 className="font-semibold text-black-700 mb-1">Decision Summary</h3>
          <p className="text-black-700 whitespace-pre-wrap leading-relaxed bg-black-50 p-3 rounded-md">
            {award.decisionText || "No decision text provided."}
          </p>
        </div>

        {award.pdfUrl && (
          <div className="text-sm text-green-600 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <a
              href={award.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-green-700"
            >
              View PDF Document
            </a>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-end text-sm text-black-500">
        Award ID: {award._id}
      </CardFooter>
    </Card>
  );
}
