/**
 * ArbitrationList.jsx
 * ------------------------------------------------------------
 * 🔹 Main list page for all arbitrations (role-aware)
 *
 * Features:
 *  ✅ Fetches and displays arbitrations with loading & error states
 *  ✅ Search and filter by status
 *  ✅ Uses ArbitrationListItem for consistent display
 *  ✅ Supports "Join Hearing" and "Download Award" actions
 *  ✅ Fully responsive and production-grade
 */

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "@/utils/axiosInstance";
import ArbitrationListItem from "@/pages/arbitrations/ArbitrationListItem";import { Input } from "@/components/ui/Input.jsx";
import { Select, SelectTrigger, SelectContent, SelectItem } from "@/components/ui/Select.jsx";
import { Button } from "@/components/ui/Button.jsx";
import { Loader2, RefreshCcw, Filter } from "lucide-react";
import { useToast } from "@/components/ui/use-toast.jsx";
export default function ArbitrationList() {
  const [arbitrations, setArbitrations] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const navigate = useNavigate();

  // ✅ Fetch arbitrations
  useEffect(() => {
    const fetchArbitrations = async () => {
      try {
        setLoading(true);
        const { data } = await axios.get("/api/arbitrations");
        if (data?.success) {
          setArbitrations(data.arbitrations || []);
          setFiltered(data.arbitrations || []);
        } else {
          toast({ title: "Error", description: "Failed to load arbitrations." });
        }
      } catch (err) {
        console.error(err);
        toast({
          title: "Server Error",
          description: err?.response?.data?.message || "Unable to fetch arbitrations.",
        });
      } finally {
        setLoading(false);
      }
    };
    fetchArbitrations();
  }, []);

  // ✅ Filtering
  useEffect(() => {
    let list = [...arbitrations];
    if (search.trim()) {
      list = list.filter((a) =>
        a.title?.toLowerCase().includes(search.toLowerCase())
      );
    }
    if (statusFilter !== "all") {
      list = list.filter((a) => a.status === statusFilter);
    }
    setFiltered(list);
  }, [search, statusFilter, arbitrations]);

  // ✅ Action handlers
  const handleJoinHearing = (id) => navigate(`/arbitrations/${id}/hearing`);
  const handleDownloadAward = (url) => window.open(url, "_blank");

  // ✅ Manual refresh
  const handleRefresh = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get("/api/arbitrations");
      setArbitrations(data.arbitrations || []);
      setFiltered(data.arbitrations || []);
      toast({ title: "List updated", description: "Arbitrations refreshed." });
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to refresh arbitration list.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap justify-between items-center gap-3">
        <h1 className="text-2xl font-bold text-black-800 flex items-center gap-2">
          <Filter className="h-5 w-5 text-black-600" />
          Arbitration Cases
        </h1>

        <div className="flex flex-wrap items-center gap-3">
          <Input
            placeholder="Search arbitrations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              {statusFilter === "all"
                ? "All statuses"
                : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in-progress">In Progress</SelectItem>
              <SelectItem value="decided">Decided</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={handleRefresh} disabled={loading}>
            <RefreshCcw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center items-center h-60 text-black-500">
          <Loader2 className="animate-spin h-6 w-6 mr-2" />
          Loading arbitrations...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-black-500 py-20">
          <p>No arbitrations found.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((arb) => (
            <ArbitrationListItem
              key={arb._id}
              arbitration={arb}
              onJoinHearing={handleJoinHearing}
              onDownloadAward={handleDownloadAward}
            />
          ))}
        </div>
      )}
    </div>
  );
}
