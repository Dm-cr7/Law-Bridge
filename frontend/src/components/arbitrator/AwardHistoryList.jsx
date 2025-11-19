/**
 * AwardHistoryList.jsx
 * ------------------------------------------------------------
 * 🎯 Purpose:
 * Displays all awards issued by the logged-in arbitrator with filtering,
 * search, and download access to award PDFs.
 *
 * ✅ Features:
 *  - Fetch all awards for current arbitrator
 *  - Search by case title or parties
 *  - Filter by status (issued, draft, archived)
 *  - Download generated award PDFs
 *  - View quick summary of each decision
 */

import React, { useEffect, useState, useMemo } from "react";
import axios from "@/utils/axiosInstance";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, Search, FileText } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
export default function AwardHistoryList({ arbitratorId }) {
  const [awards, setAwards] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Load arbitrator's awards
  useEffect(() => {
    const fetchAwards = async () => {
      try {
        setLoading(true);
        const { data } = await axios.get(`/api/awards?arbitrator=${arbitratorId}`);
        setAwards(data);
        setFiltered(data);
      } catch (err) {
        console.error(err);
        toast({
          title: "Failed to load awards",
          description: err.response?.data?.message || "Try again later.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    fetchAwards();
  }, [arbitratorId]);

  // Filter + Search
  useEffect(() => {
    let list = [...awards];

    if (statusFilter !== "all") {
      list = list.filter((a) => a.status === statusFilter);
    }

    if (search.trim()) {
      const query = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.caseTitle?.toLowerCase().includes(query) ||
          a.parties?.toLowerCase().includes(query)
      );
    }

    setFiltered(list);
  }, [search, statusFilter, awards]);

  const downloadAward = (pdfUrl, caseTitle) => {
    if (!pdfUrl) {
      toast({ title: "PDF not yet available", variant: "destructive" });
      return;
    }
    const link = document.createElement("a");
    link.href = pdfUrl;
    link.download = `${caseTitle || "award"}.pdf`;
    link.target = "_blank";
    link.click();
  };

  return (
    <Card className="border border-black-200 shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-blue-600" />
          Award History
        </CardTitle>
      </CardHeader>

      <CardContent>
        {/* Filters */}
        <div className="flex flex-col md:flex-row justify-between gap-3 mb-4">
          <div className="flex gap-2 items-center">
            <Input
              type="text"
              placeholder="Search by case title or parties..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full md:w-72"
            />
            <Button variant="outline" onClick={() => setSearch("")}>
              <Search className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex gap-2 items-center">
            <span className="text-sm text-black-600">Status:</span>
            {["all", "issued", "draft", "archived"].map((s) => (
              <Badge
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`cursor-pointer ${
                  statusFilter === s
                    ? "bg-blue-600 text-white"
                    : "bg-black-200 text-black-700"
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </Badge>
            ))}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="animate-spin w-6 h-6 text-blue-500" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-black-500 text-center py-6">No awards found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border border-black-200">
              <thead className="bg-black-100">
                <tr>
                  <th className="p-3 text-left text-sm font-semibold text-black-700">Case Title</th>
                  <th className="p-3 text-left text-sm font-semibold text-black-700">Parties</th>
                  <th className="p-3 text-left text-sm font-semibold text-black-700">Decision Date</th>
                  <th className="p-3 text-left text-sm font-semibold text-black-700">Status</th>
                  <th className="p-3 text-right text-sm font-semibold text-black-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((award) => (
                  <tr key={award._id} className="border-t hover:bg-black-50">
                    <td className="p-3">{award.caseTitle}</td>
                    <td className="p-3 text-black-600">{award.parties}</td>
                    <td className="p-3 text-black-600">
                      {award.decisionDate
                        ? new Date(award.decisionDate).toLocaleDateString()
                        : "-"}
                    </td>
                    <td className="p-3">
                      <Badge
                        className={`${
                          award.status === "issued"
                            ? "bg-green-100 text-green-700"
                            : award.status === "draft"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-black-100 text-black-600"
                        }`}
                      >
                        {award.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => downloadAward(award.pdfUrl, award.caseTitle)}
                        className="flex items-center gap-1"
                      >
                        <Download className="w-4 h-4" /> Download
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
