// frontend/src/pages/HearingsNew.jsx
import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import api from "@/utils/api";
import { toast } from "sonner";
import { formatISO } from "date-fns";

export default function HearingsNew() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const qDate = searchParams.get("date") || "";
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(qDate);
  const [time, setTime] = useState("");
  const [venue, setVenue] = useState("");
  const [meetingLink, setMeetingLink] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [caseId, setCaseId] = useState(""); // optional — include if your backend requires

  useEffect(() => {
    if (qDate) setDate(qDate);
  }, [qDate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !date) {
      toast.error("Title and date are required.");
      return;
    }

    setSubmitting(true);
    try {
      const start = time ? `${date}T${time}` : formatISO(new Date(`${date}T00:00:00`), { representation: "complete" });

      const payload = {
        title: title.trim(),
        start,
        end: null,
        venue: venue || "To be determined",
        meetingLink: meetingLink || null,
        description: "",
        caseId: caseId || undefined,
      };

      const res = await api.post("/hearings", payload);
      const created = res?.data || res; // normalized by api.js
      toast.success("Hearing scheduled");
      const newId = created?.data?._id || created?._id || created?.data?.id || created?.id;
      if (newId) navigate(`/hearings/${newId}`);
      else navigate("/dashboard/hearings");
    } catch (err) {
      console.error("Schedule error", err);
      const message = err?.data?.message || err?.message || "Failed to schedule hearing";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Schedule hearing</h1>
      <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded shadow">
        <div>
          <label className="block text-sm font-medium">Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="Hearing title" required />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full border rounded px-3 py-2" required />
          </div>
          <div>
            <label className="block text-sm font-medium">Time</label>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full border rounded px-3 py-2" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium">Location / Meeting link</label>
          <input value={venue} onChange={(e) => setVenue(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="Zoom link or address" />
        </div>

        {/* If backend requires caseId, optionally allow selecting/pasting it */}
        <div>
          <label className="block text-sm font-medium">Case ID (optional)</label>
          <input value={caseId} onChange={(e) => setCaseId(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="Paste case id if applicable" />
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={submitting} className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-60">
            {submitting ? "Scheduling..." : "Schedule"}
          </button>
          <button type="button" onClick={() => navigate(-1)} className="px-4 py-2 border rounded">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
