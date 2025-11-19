/**
 * ReportsDashboard.jsx
 * ------------------------------------------------------------
 * 🎯 Purpose:
 * Centralized admin interface to view and export reports
 * related to arbitrations, users, awards, and evidence.
 *
 * ✅ Features:
 *  - Filterable report categories
 *  - Dynamic table rendering
 *  - CSV / PDF export for any report type
 *  - Smart search + date range
 *  - Responsive & accessible layout
 */

import React, { useEffect, useState } from "react";
import axios from "@/utils/axiosInstance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";import { Download, Filter, FileSpreadsheet, FileText, RefreshCcw } from "lucide-react";
import { format } from "date-fns";

export default function ReportsDashboard() {
  const [loading, setLoading] = useState(false);
  const [reportType, setReportType] = useState("arbitrations");
  const [reports, setReports] = useState([]);
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const params = {};
      if (search) params.q = search;
      if (startDate) params.start = startDate;
      if (endDate) params.end = endDate;

      const { data } = await axios.get(`/api/reports/${reportType}`, { params });
      setReports(data || []);
    } catch (err) {
      console.error(err);
      toast({
        title: "Failed to load reports",
        description: err.response?.data?.message || "Server unavailable",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [reportType]);

  const handleExport = async (formatType) => {
    try {
      const res = await axios.get(`/api/reports/export/${reportType}.${formatType}`, {
        responseType: "blob",
      });
      const blob = new Blob([res.data]);
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${reportType}_report_${Date.now()}.${formatType}`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      toast({
        title: "Export failed",
        description: err.response?.data?.message || "Try again later",
        variant: "destructive",
      });
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchReports();
    setTimeout(() => setRefreshing(false), 800);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <h1 className="text-2xl font-semibold text-black-800 flex items-center gap-2">
          <FileText className="text-blue-600 w-6 h-6" />
          Reports Center
        </h1>
        <div className="flex gap-2">
          <Button onClick={handleRefresh} disabled={refreshing}>
            <RefreshCcw className={`w-4 h-4 mr-1 ${refreshing && "animate-spin"}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={() => handleExport("csv")}>
            <FileSpreadsheet className="w-4 h-4 mr-1" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={() => handleExport("pdf")}>
            <Download className="w-4 h-4 mr-1" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="shadow-sm">
        <CardHeader className="flex justify-between items-center">
          <CardTitle className="text-black-700 flex items-center gap-2">
            <Filter className="w-5 h-5 text-blue-600" /> Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Select value={reportType} onValueChange={setReportType}>
            <SelectTrigger>
              <SelectValue placeholder="Select report type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="arbitrations">Arbitrations</SelectItem>
              <SelectItem value="awards">Awards</SelectItem>
              <SelectItem value="evidence">Evidence</SelectItem>
              <SelectItem value="users">Users</SelectItem>
            </SelectContent>
          </Select>

          <Input
            placeholder="Search keyword..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />

          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />

          <Button onClick={fetchReports} className="md:col-span-4">
            Apply Filters
          </Button>
        </CardContent>
      </Card>

      {/* Results Table */}
      <Card className="shadow">
        <CardHeader>
          <CardTitle className="text-black-700 capitalize">
            {reportType} Report
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-black-500">Loading...</p>
          ) : reports.length === 0 ? (
            <p className="text-center text-black-400 italic">No results found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-left border">
                <thead className="bg-black-100 border-b">
                  <tr>
                    {Object.keys(reports[0]).map((key) => (
                      <th key={key} className="px-4 py-2 font-semibold capitalize">
                        {key.replace(/_/g, " ")}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reports.map((row, i) => (
                    <tr
                      key={i}
                      className={`border-b hover:bg-black-50 transition ${
                        i % 2 ? "bg-black-50" : "bg-white"
                      }`}
                    >
                      {Object.values(row).map((val, idx) => (
                        <td key={idx} className="px-4 py-2 text-black-700">
                          {val === null || val === undefined
                            ? "-"
                            : typeof val === "boolean"
                            ? val
                              ? "✅"
                              : "❌"
                            : val instanceof Date
                            ? format(new Date(val), "yyyy-MM-dd")
                            : val.toString()}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
