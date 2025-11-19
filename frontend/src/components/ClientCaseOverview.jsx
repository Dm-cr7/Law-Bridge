import React, { useEffect, useState, useMemo } from "react";
import { Briefcase, Clock, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import API from "@/utils/api";
import { socket } from "@/utils/socket";

/**
 * ClientCaseOverview.jsx
 * ----------------------------------------------------------
 * Displays all cases associated with a given client.
 * - Fetches from backend: GET /clients/:id/cases
 * - Realtime updates: case:new, case:update, case:closed
 * - Shows status badges, deadlines, and linked advocates/paralegals
 */

export default function ClientCaseOverview({ clientId }) {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadClientCases = async () => {
    try {
      const { data } = await API.get(`/clients/${clientId}/cases`);
      setCases(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("❌ Error fetching client cases:", err);
      toast.error("Failed to load client cases");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClientCases();

    // --- SOCKET EVENTS ---
    const handleCaseNew = (c) => {
      if (c.client === clientId) {
        setCases((prev) => [c, ...prev]);
        toast.success(`New case created: ${c.title}`);
      }
    };

    const handleCaseUpdate = (updated) => {
      if (updated.client === clientId) {
        setCases((prev) => prev.map((c) => (c._id === updated._id ? updated : c)));
        toast.info(`Case updated: ${updated.title}`);
      }
    };

    const handleCaseClosed = (closed) => {
      if (closed.client === clientId) {
        setCases((prev) =>
          prev.map((c) =>
            c._id === closed._id ? { ...c, status: "Closed" } : c
          )
        );
        toast.warning(`Case closed: ${closed.title}`);
      }
    };

    socket.on("case:new", handleCaseNew);
    socket.on("case:update", handleCaseUpdate);
    socket.on("case:closed", handleCaseClosed);

    return () => {
      socket.off("case:new", handleCaseNew);
      socket.off("case:update", handleCaseUpdate);
      socket.off("case:closed", handleCaseClosed);
    };
  }, [clientId]);

  // Derived stats
  const stats = useMemo(() => {
    const total = cases.length;
    const active = cases.filter((c) => c.status?.toLowerCase() === "active").length;
    const pending = cases.filter((c) => c.status?.toLowerCase() === "pending").length;
    const closed = cases.filter((c) => c.status?.toLowerCase() === "closed").length;
    return { total, active, pending, closed };
  }, [cases]);

  const statusBadge = (status) => {
    const base =
      "px-2 py-1 rounded text-xs font-medium capitalize border inline-flex items-center gap-1";
    switch ((status || "").toLowerCase()) {
      case "active":
        return (
          <span className={`${base} bg-blue-50 text-blue-700 border-blue-200`}>
            <Briefcase size={12} /> Active
          </span>
        );
      case "pending":
        return (
          <span className={`${base} bg-amber-50 text-amber-700 border-amber-200`}>
            <Clock size={12} /> Pending
          </span>
        );
      case "closed":
        return (
          <span className={`${base} bg-green-50 text-green-700 border-green-200`}>
            <CheckCircle size={12} /> Closed
          </span>
        );
      default:
        return (
          <span className={`${base} bg-black-50 text-black-700 border-black-200`}>
            <AlertTriangle size={12} /> Unknown
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8 text-black-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading cases...
      </div>
    );
  }

  if (!cases.length) {
    return (
      <div className="text-center text-black-500 py-10">
        <Briefcase className="w-8 h-8 mx-auto mb-2 opacity-70" />
        No cases found for this client.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-5">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-black-800">
          Client Cases Overview
        </h3>
        <div className="text-sm text-black-500">
          Total: <span className="font-semibold">{stats.total}</span>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="bg-blue-50 p-3 rounded-lg text-center">
          <p className="text-sm text-blue-700">Active</p>
          <p className="text-xl font-bold text-blue-800">{stats.active}</p>
        </div>
        <div className="bg-amber-50 p-3 rounded-lg text-center">
          <p className="text-sm text-amber-700">Pending</p>
          <p className="text-xl font-bold text-amber-800">{stats.pending}</p>
        </div>
        <div className="bg-green-50 p-3 rounded-lg text-center">
          <p className="text-sm text-green-700">Closed</p>
          <p className="text-xl font-bold text-green-800">{stats.closed}</p>
        </div>
        <div className="bg-black-50 p-3 rounded-lg text-center">
          <p className="text-sm text-black-700">Total</p>
          <p className="text-xl font-bold text-black-900">{stats.total}</p>
        </div>
      </div>

      {/* Cases List */}
      <ul className="space-y-3">
        {cases.map((c) => (
          <li
            key={c._id}
            className="border rounded-lg p-4 hover:shadow-md transition bg-black-50"
          >
            <div className="flex justify-between items-start mb-1">
              <h4 className="font-semibold text-black-900">{c.title}</h4>
              {statusBadge(c.status)}
            </div>

            <p className="text-sm text-black-600 mb-2 line-clamp-2">
              {c.description || "No description provided."}
            </p>

            <div className="text-xs text-black-500 flex justify-between">
              <span>
                Advocate:{" "}
                {c.advocate?.name
                  ? `${c.advocate.name} (${c.advocate.email})`
                  : "N/A"}
              </span>
              <span>
                Paralegal:{" "}
                {c.paralegal?.name
                  ? `${c.paralegal.name} (${c.paralegal.email})`
                  : "N/A"}
              </span>
            </div>

            {c.deadline && (
              <div className="text-xs text-black-500 mt-1">
                Deadline:{" "}
                <span
                  className={`font-medium ${
                    new Date(c.deadline) < new Date()
                      ? "text-red-600"
                      : "text-black-700"
                  }`}
                >
                  {new Date(c.deadline).toLocaleDateString()}
                </span>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
