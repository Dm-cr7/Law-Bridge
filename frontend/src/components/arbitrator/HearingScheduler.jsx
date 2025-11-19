/**
 * HearingScheduler.jsx
 * ------------------------------------------------------------
 * 🎯 Purpose:
 * Enables arbitrators to create, view, and update arbitration hearing
 * schedules — including time, location (or online link), and participants.
 *
 * ✅ Features:
 * - Schedule new hearings (date, time, location/URL, notes)
 * - Update or cancel hearings
 * - Notify involved parties (via socket / backend event)
 * - Realtime refresh
 */

import React, { useState, useEffect } from "react";
import axios from "@/utils/axiosInstance";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CalendarDays, Bell, XCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";import { format } from "date-fns";

export default function HearingScheduler({ arbitrationId, socket }) {
  const [hearings, setHearings] = useState([]);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Load existing hearings
  useEffect(() => {
    const fetchHearings = async () => {
      setLoading(true);
      try {
        const { data } = await axios.get(`/api/arbitrations/${arbitrationId}/hearings`);
        setHearings(data || []);
      } catch (err) {
        console.error("❌ Error loading hearings:", err);
        toast({
          title: "Failed to load hearings",
          description: err.response?.data?.message || "Try again later.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    fetchHearings();
  }, [arbitrationId]);

  // Realtime socket updates
  useEffect(() => {
    if (!socket) return;
    socket.on("hearing-updated", (update) => {
      if (update.arbitrationId === arbitrationId) {
        setHearings((prev) => [...prev.filter(h => h._id !== update._id), update]);
      }
    });
    socket.on("hearing-deleted", (id) => {
      setHearings((prev) => prev.filter(h => h._id !== id));
    });
    return () => {
      socket.off("hearing-updated");
      socket.off("hearing-deleted");
    };
  }, [socket, arbitrationId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!date || !time || !location) {
      toast({
        title: "Validation Error",
        description: "Date, time, and location are required.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const payload = { date, time, location, notes };
      const { data } = await axios.post(`/api/arbitrations/${arbitrationId}/hearings`, payload);

      setHearings((prev) => [...prev, data]);
      setDate("");
      setTime("");
      setLocation("");
      setNotes("");

      toast({
        title: "Hearing Scheduled",
        description: "All parties have been notified.",
      });

      socket?.emit("hearing-scheduled", { arbitrationId, ...data });
    } catch (err) {
      console.error("❌ Schedule error:", err);
      toast({
        title: "Failed to schedule",
        description: err.response?.data?.message || "Try again later.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const cancelHearing = async (id) => {
    try {
      await axios.delete(`/api/arbitrations/${arbitrationId}/hearings/${id}`);
      setHearings((prev) => prev.filter((h) => h._id !== id));
      toast({
        title: "Hearing Cancelled",
        description: "Participants have been informed.",
      });
      socket?.emit("hearing-deleted", id);
    } catch (err) {
      toast({
        title: "Cancel Failed",
        description: err.response?.data?.message || "Try again later.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="shadow-md border border-black-200">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-black-800 flex items-center gap-2">
          <CalendarDays className="w-5 h-5" /> Hearing Scheduler
        </CardTitle>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="time">Time</Label>
            <Input
              id="time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              required
            />
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="location">Location / Meeting Link</Label>
            <Input
              id="location"
              placeholder="Enter physical location or Zoom/Meet link"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              required
            />
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              rows={3}
              placeholder="Add any notes or instructions for parties..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="md:col-span-2 flex items-center gap-3">
            <Button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Scheduling...
                </>
              ) : (
                <>
                  <Bell className="h-4 w-4" /> Schedule Hearing
                </>
              )}
            </Button>
          </div>
        </form>

        {/* Hearing List */}
        {loading ? (
          <p className="text-black-500">Loading hearings...</p>
        ) : hearings.length > 0 ? (
          <ul className="divide-y divide-black-100">
            {hearings
              .sort((a, b) => new Date(a.date) - new Date(b.date))
              .map((hearing) => (
                <li
                  key={hearing._id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-black-800">
                      {format(new Date(hearing.date), "PPP")} at {hearing.time}
                    </p>
                    <p className="text-sm text-black-600">{hearing.location}</p>
                    {hearing.notes && (
                      <p className="text-xs text-black-500 mt-1">
                        Notes: {hearing.notes}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => cancelHearing(hearing._id)}
                    className="mt-2 sm:mt-0 flex items-center gap-1 text-red-600 border-red-200 hover:bg-red-50"
                  >
                    <XCircle className="h-4 w-4" /> Cancel
                  </Button>
                </li>
              ))}
          </ul>
        ) : (
          <p className="text-black-500">No hearings scheduled yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
