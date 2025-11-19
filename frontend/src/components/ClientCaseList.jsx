import React, { useEffect, useState } from "react";
import { Briefcase, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import API from "@/utils/api";
import { socket } from "@/utils/socket";
import { Link } from "react-router-dom";

/**
 * ClientCaseList
 * ----------------------------
 * Purpose: Display all cases linked to a specific client.
 * Features:
 * - Fetches client’s cases from backend (`/api/clients/:id/cases`)
 * - Live updates via socket when new cases are added or status changes
 * - Displays case metadata (status, type, assigned lawyer, last updated)
 * - Clean loading and empty states
 */

export default function ClientCaseList({ clientId }) {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch cases for this client
  const fetchCases = async () => {
    try {
      const { data } = await API.get(`/clients/${clientId}/cases`);
      setCases(data || []);
    } catch (err) {
      console.error("Error loading client cases:", err);
      toast.error("Failed to load client cases");
    } finally {
      setLoading(false);
    }
  };

  // Live socket updates
  useEffect(() => {
    fetchCases();

    const handleNewCase = (newCase) => {
      if (newCase.client === clientId) {
        setCases((prev) => [newCase, ...prev]);
        toast.success(`New case created: ${newCase.title}`);
      }
    };

    const handleCaseUpdate = (updatedCase) => {
      if (updatedCase.client === clientId) {
        setCases((prev) =>
          prev.map((c) => (c._id === updatedCase._id ? updatedCase : c))
        );
        toast.info(`Case updated: ${updatedCase.title}`);
      }
    };

    socket.on("case:created", handleNewCase);
    socket.on("case:updated", handleCaseUpdate);

    return () => {
      socket.off("case:created", handleNewCase);
      socket.off("case:updated", handleCaseUpdate);
    };
  }, [clientId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-black-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading client cases...
      </div>
    );
  }

  if (!cases.length) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-black-500">
        <Briefcase className="w-8 h-8 mb-2 opacity-70" />
        <p>No cases found for this client.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {cases.map((c) => (
        <Link
          key={c._id}
          to={`/cases/${c._id}`}
          className="block p-4 rounded-lg border border-black-200 hover:border-blue-400 hover:shadow-md transition"
        >
          <div className="flex justify-between items-start">
            <h3 className="text-lg font-semibold text-black-800">{c.title}</h3>
            <span
              className={`text-xs px-2 py-1 rounded-full ${
                c.status === "Closed"
                  ? "bg-green-100 text-green-800"
                  : c.status === "Pending"
                  ? "bg-yellow-100 text-yellow-700"
                  : "bg-blue-100 text-blue-700"
              }`}
            >
              {c.status}
            </span>
          </div>

          <p className="text-sm text-black-600 mt-1 line-clamp-2">
            {c.description || "No case description available."}
          </p>

          <div className="mt-3 text-xs text-black-500 flex justify-between">
            <span>Type: {c.type || "—"}</span>
            <span>
              Lawyer: {c.assignedLawyer?.name || "Unassigned"}
            </span>
            <span>
              Updated:{" "}
              {new Date(c.updatedAt).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
