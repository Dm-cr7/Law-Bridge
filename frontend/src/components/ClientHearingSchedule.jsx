import React, { useEffect, useState } from "react";
import { CalendarDays, Clock, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { socket } from "@/utils/socket";
import API from "@/utils/api";

/**
 * ClientHearingSchedule.jsx
 * ----------------------------------
 * Purpose:
 *  - Display all hearings for a specific client
 *  - Show hearing date, time, arbitrator, case title, and status
 *  - Real-time updates when hearings are added, updated, or rescheduled
 *
 * Backend expected routes:
 *  - GET /clients/:id/hearings
 * Socket events:
 *  - hearing:new
 *  - hearing:updated
 *  - hearing:deleted
 */

export default function ClientHearingSchedule({ clientId }) {
  const [hearings, setHearings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load hearings initially
  const fetchHearings = async () => {
    try {
      const { data } = await API.get(`/clients/${clientId}/hearings`);
      setHearings(data || []);
    } catch (err) {
      console.error("❌ Error fetching hearings:", err);
      toast.error("Failed to load hearing schedule");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHearings();

    // Real-time updates
    const handleNewHearing = (hearing) => {
      if (hearing.client === clientId) {
        setHearings((prev) => [hearing, ...prev]);
        toast.success(`New hearing scheduled: ${hearing.title}`);
      }
    };

    const handleUpdateHearing = (updated) => {
      if (updated.client === clientId) {
        setHearings((prev) =>
          prev.map((h) => (h._id === updated._id ? updated : h))
        );
        toast.info(`Hearing updated: ${updated.title}`);
      }
    };

    const handleDeleteHearing = ({ _id }) => {
      setHearings((prev) => prev.filter((h) => h._id !== _id));
      toast.warning("A hearing was cancelled or deleted");
    };

    socket.on("hearing:new", handleNewHearing);
    socket.on("hearing:updated", handleUpdateHearing);
    socket.on("hearing:deleted", handleDeleteHearing);

    return () => {
      socket.off("hearing:new", handleNewHearing);
      socket.off("hearing:updated", handleUpdateHearing);
      socket.off("hearing:deleted", handleDeleteHearing);
    };
  }, [clientId]);

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(undefined, {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
      time: date.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  };

  const getStatusStyle = (status = "") => {
    const s = status.toLowerCase();
    if (s.includes("completed"))
      return "bg-green-100 text-green-700 border-green-200";
    if (s.includes("rescheduled"))
      return "bg-amber-100 text-amber-700 border-amber-200";
    if (s.includes("cancelled"))
      return "bg-red-100 text-red-700 border-red-200";
    if (s.includes("upcoming"))
      return "bg-blue-100 text-blue-700 border-blue-200";
    return "bg-black-100 text-black-600 border-black-200";
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8 text-black-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading hearings...
      </div>
    );
  }

  if (!hearings.length) {
    return (
      <div className="text-center text-black-500 py-8">
        <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-70" />
        No hearings scheduled for this client.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {hearings.map((hearing) => {
        const { date, time } = formatDateTime(hearing.date);
        return (
          <div
            key={hearing._id}
            className="border rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-black-800">{hearing.title}</h3>
              <span
                className={`text-xs px-2 py-1 rounded-full border ${getStatusStyle(
                  hearing.status
                )}`}
              >
                {hearing.status || "Scheduled"}
              </span>
            </div>

            <div className="flex items-center gap-3 text-sm text-black-600">
              <CalendarDays className="w-4 h-4" />
              <span>{date}</span>
              <Clock className="w-4 h-4 ml-3" />
              <span>{time}</span>
            </div>

            {hearing.location && (
              <p className="mt-2 text-sm text-black-500">
                📍 Location: {hearing.location}
              </p>
            )}

            {hearing.arbitrator && (
              <p className="text-sm text-black-500">
                ⚖️ Arbitrator: {hearing.arbitrator?.name || "Assigned"}
              </p>
            )}

            {hearing.notes && (
              <div className="mt-2 p-2 bg-black-50 rounded text-sm text-black-600 border border-black-100">
                <AlertTriangle className="w-4 h-4 inline-block mr-1 text-amber-600" />
                {hearing.notes}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
