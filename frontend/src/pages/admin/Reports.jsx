import React, { useState, useEffect } from "react";
import { Download, RefreshCcw, FileText, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/Select";
import StatCard from "@/components/ui/StatCard";
import api from "@/utils/axiosInstance";
import { toast } from "@/components/ui/use-toast";

export default function Reports() {
  const [filters, setFilters] = useState({
    type: "",
    startDate: "",
    endDate: "",
  });

  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState([]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  // ✅ Fetch reports
  const fetchReports = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/api/reports", { params: filters });
      setReports(data || []);
      toast.success("Reports fetched successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to load reports. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Download report
  const downloadReport = async () => {
    if (!filters.type) {
      toast.error("Please select a report type first.");
      return;
    }

    try {
      toast.loading("Generating report...");
      const response = await api.get("/api/reports/download", {
        params: filters,
        responseType: "blob",
      });

      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `report_${filters.type}_${Date.now()}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.dismiss();
      toast.success("Report downloaded successfully!");
    } catch (err) {
      console.error(err);
      toast.dismiss();
      toast.error("Error downloading the report. Try again.");
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  return (
    <div className="p-6 md:p-10 bg-black-50 min-h-screen">
      {/* 🔹 Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <FileText className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-black-800">
            Reports Dashboard
          </h1>
        </div>
        <Button
          onClick={fetchReports}
          disabled={loading}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
        >
          <RefreshCcw className="w-4 h-4" />
          {loading ? "Loading..." : "Refresh"}
        </Button>
      </div>

      {/* 🔹 Filter Section */}
      <div className="bg-white p-6 rounded-2xl shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4 mb-10">
        <div>
          <label className="text-sm font-medium text-black-600 mb-1 block">
            Report Type
          </label>
          <Select
            value={filters.type}
            onChange={(val) => handleFilterChange("type", val)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cases">Cases</SelectItem>
              <SelectItem value="users">Users</SelectItem>
              <SelectItem value="arbitrations">Arbitrations</SelectItem>
              <SelectItem value="payments">Payments</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium text-black-600 mb-1 block">
            Start Date
          </label>
          <Input
            type="date"
            value={filters.startDate}
            onChange={(e) => handleFilterChange("startDate", e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm font-medium text-black-600 mb-1 block">
            End Date
          </label>
          <Input
            type="date"
            value={filters.endDate}
            onChange={(e) => handleFilterChange("endDate", e.target.value)}
          />
        </div>

        <div className="flex items-end">
          <Button
            onClick={downloadReport}
            disabled={loading}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white w-full"
          >
            <Download className="w-4 h-4" />
            Download Report
          </Button>
        </div>
      </div>

      {/* 🔹 Report Stats */}
      {reports.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {reports.map((report, idx) => (
            <StatCard
              key={idx}
              title={report.title || "Untitled Report"}
              value={report.count || 0}
              icon={BarChart3}
              color="blue"
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-black-500">
          <BarChart3 className="w-10 h-10 mb-4 text-black-400" />
          <p>No reports found. Adjust your filters or refresh.</p>
        </div>
      )}
    </div>
  );
}
