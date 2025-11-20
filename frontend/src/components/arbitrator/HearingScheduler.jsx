// frontend/src/components/hearing/HearingScheduler.jsx
/**
 * HearingScheduler.jsx — Robust scheduler (full rewrite)
 *
 * Features & fixes:
 *  - participants are sent as an object (advocates, arbitrators, clients, respondents)
 *  - role selector per participant (if case participants are available)
 *  - debounced case search
 *  - abort-safe fetches for reads, but no signal on the POST (create) call
 *  - optimistic UI with rollback on error
 *  - defensive error handling and clear toasts
 *
 * Expects:
 *  - api (axios wrapper) at "@/utils/api"
 *  - UI atoms: Card, Button, Input, Label, Textarea
 *  - useAuth context available
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import { format } from "date-fns";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card.jsx";
import { Button } from "@/components/ui/Button.jsx";
import { Input } from "@/components/ui/Input.jsx";
import { Label } from "@/components/ui/Label.jsx";
import { Textarea } from "@/components/ui/textarea.jsx";
import { Loader2, CalendarDays, Bell, XCircle } from "lucide-react";
import api from "@/utils/api";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";
import clsx from "clsx";

const DEFAULT_PAGE_LIMIT = 12;
const ROLE_OPTIONS = [
  { value: "advocates", label: "Advocate" },
  { value: "arbitrators", label: "Arbitrator" },
  { value: "clients", label: "Client" },
  { value: "respondents", label: "Respondent" },
];

export default function HearingScheduler({
  arbitrationId = null,
  defaultCaseId = null,
  socket = null,
  onCreated = null,
}) {
  const { user } = useAuth() || {};
  const [hearings, setHearings] = useState([]);
  const [caseId, setCaseId] = useState(defaultCaseId || "");
  const [caseOptions, setCaseOptions] = useState([]);
  const [caseSearch, setCaseSearch] = useState("");
  const [casePage, setCasePage] = useState(1);
  const [caseHasMore, setCaseHasMore] = useState(false);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  // selectedParticipants: array of { id, name, role }
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  // caseParticipants: normalized user objects [{ _id, name, email, role? }]
  const [caseParticipants, setCaseParticipants] = useState([]);

  const [reminder, setReminder] = useState({ enabled: false, minutesBefore: 30 });
  const [recurrence, setRecurrence] = useState({ freq: "none", interval: 1, count: 1 });
  const [saveDraft, setSaveDraft] = useState(false);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const mountedRef = useRef(true);
  const fetchCtrlRef = useRef(null);
  const casesCtrlRef = useRef(null);
  const caseSearchDebounceRef = useRef(null);

  // Convenience toast wrapper
  const safeToast = useCallback((opts) => {
    if (typeof opts === "string") return toast(opts);
    if (opts?.type === "error") return toast.error(opts.message || opts.title || "Error");
    return toast.success(opts.message || opts.title || "Done");
  }, []);

  // --------- initial load: hearings + socket listeners ----------
  useEffect(() => {
    mountedRef.current = true;
    fetchHearings();

    if (socket && socket.on) {
      socket.on("hearing:new", (h) => setHearings((prev) => [h, ...prev]));
      socket.on("hearing:update", (h) => setHearings((prev) => prev.map((x) => ((x._id || x.id) === (h._id || h.id) ? h : x))));
      socket.on("hearing:deleted", (payload) => {
        const id = payload?._id || payload?.id || payload;
        setHearings((prev) => prev.filter((x) => (x._id || x.id) !== id));
      });
    }

    return () => {
      mountedRef.current = false;
      if (fetchCtrlRef.current) try { fetchCtrlRef.current.abort(); } catch {}
      if (casesCtrlRef.current) try { casesCtrlRef.current.abort(); } catch {}
      if (socket && socket.off) {
        try {
          socket.off("hearing:new");
          socket.off("hearing:update");
          socket.off("hearing:deleted");
        } catch {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arbitrationId, socket]);

  async function fetchHearings() {
    setLoading(true);
    try {
      if (fetchCtrlRef.current) fetchCtrlRef.current.abort();
      fetchCtrlRef.current = new AbortController();
      const url = arbitrationId ? `/arbitrations/${arbitrationId}/hearings` : `/hearings`;
      const res = await api.get(url, { signal: fetchCtrlRef.current.signal });
      const payload = Array.isArray(res?.data) ? res.data : res?.data?.data ?? res?.data ?? [];
      if (!mountedRef.current) return;
      setHearings(payload);
    } catch (err) {
      const isAbort = err?.name === "AbortError" || err?.code === "ERR_CANCELED";
      if (!isAbort) {
        console.error("Error fetching hearings:", err);
        safeToast({ type: "error", message: err?.response?.data?.message || err?.message || "Failed to load hearings" });
      }
    } finally {
      if (mountedRef.current) setLoading(false);
      fetchCtrlRef.current = null;
    }
  }

  // --------- case search (debounced) ----------
  useEffect(() => {
    // debounce to avoid spamming backend while typing
    if (caseSearchDebounceRef.current) clearTimeout(caseSearchDebounceRef.current);
    caseSearchDebounceRef.current = setTimeout(() => {
      setCasePage(1);
      loadCases({ q: caseSearch, page: 1 });
    }, 300);

    return () => {
      if (caseSearchDebounceRef.current) clearTimeout(caseSearchDebounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseSearch]);

  async function loadCases({ q = "", page = 1 } = {}) {
    try {
      if (casesCtrlRef.current) casesCtrlRef.current.abort();
      casesCtrlRef.current = new AbortController();
      const res = await api.get("/cases", { params: { q, page, limit: DEFAULT_PAGE_LIMIT }, signal: casesCtrlRef.current.signal });
      const items = Array.isArray(res?.data) ? res.data : res?.data?.data ?? res?.data ?? [];
      const meta = res?.data?.meta ?? res?.meta ?? {};
      if (!mountedRef.current) return;
      if (page === 1) setCaseOptions(items);
      else setCaseOptions((p) => [...p, ...items]);
      setCaseHasMore(Boolean(meta?.total && items.length + (page - 1) * DEFAULT_PAGE_LIMIT < meta.total));
    } catch (err) {
      const isAbort = err?.name === "AbortError" || err?.code === "ERR_CANCELED";
      if (!isAbort) {
        console.error("Error loading cases:", err);
        safeToast({ type: "error", message: "Failed to load cases" });
      }
    } finally {
      casesCtrlRef.current = null;
    }
  }

  // --------- when case selected, load participants & normalize ----------
  useEffect(() => {
    if (!caseId) {
      setCaseParticipants([]);
      setSelectedParticipants([]);
      return;
    }

    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await api.get(`/cases/${caseId}`, { signal: ctrl.signal });
        const caseDoc = res?.data?.data ?? res?.data ?? res;
        // gather participants from multiple possible fields
        const rawParts = Array.isArray(caseDoc?.participants) ? caseDoc.participants : (caseDoc?.sharedWith ?? []);
        const normalized = (rawParts || []).map((p) => {
          if (typeof p === "string") return { _id: p, name: p };
          return { _id: p._id || p.id || p, name: p.name || p.email || String(p._id || p.id), email: p.email, role: p.role };
        });

        // ensure client/respondent present
        if (caseDoc?.client) {
          const c = typeof caseDoc.client === "string" ? { _id: caseDoc.client, name: caseDoc.client } : { _id: caseDoc.client._id || caseDoc.client.id, name: caseDoc.client.name || caseDoc.client.email };
          if (!normalized.some((x) => String(x._id) === String(c._id))) normalized.unshift(c);
        }
        if (caseDoc?.respondent) {
          const r = typeof caseDoc.respondent === "string" ? { _id: caseDoc.respondent, name: caseDoc.respondent } : { _id: caseDoc.respondent._id || caseDoc.respondent.id, name: caseDoc.respondent.name || caseDoc.respondent.email };
          if (!normalized.some((x) => String(x._id) === String(r._id))) normalized.unshift(r);
        }

        if (mountedRef.current) {
          setCaseParticipants(normalized);

          // default selection heuristic: include client and filedBy if present
          const defaults = [];
          if (caseDoc?.client && (caseDoc.client._id || typeof caseDoc.client === "string")) defaults.push(String(caseDoc.client._id ?? caseDoc.client));
          if (caseDoc?.filedBy) defaults.push(String(caseDoc.filedBy));
          const initialSelected = normalized
            .filter((p) => defaults.includes(String(p._id)))
            .map((p) => ({
              id: p._id,
              name: p.name,
              role: (caseDoc.client && String(caseDoc.client._id ?? caseDoc.client) === String(p._id)) ? "clients" : "advocates",
            }));
          setSelectedParticipants(initialSelected);
        }
      } catch (err) {
        const isAbort = err?.name === "AbortError" || err?.code === "ERR_CANCELED";
        if (!isAbort) console.error("Failed to load case participants", err);
      }
    })();

    return () => {
      try { ctrl.abort(); } catch {}
    };
  }, [caseId]);

  // --------- validation ----------
  function validate() {
    if (!caseId) return { ok: false, message: "Case is required" };
    if (!title || !title.trim()) return { ok: false, message: "Title is required" };
    if (!date) return { ok: false, message: "Date is required" };
    if (!time) return { ok: false, message: "Time is required" };
    const dt = new Date(`${date}T${time}`);
    if (isNaN(dt.valueOf())) return { ok: false, message: "Date/time invalid" };
    return { ok: true, start: dt.toISOString() };
  }

  // --------- participant helpers ----------
  function toggleParticipant(p) {
    const pid = p._id || p.id;
    const exists = selectedParticipants.some((s) => String(s.id) === String(pid));
    if (exists) setSelectedParticipants((prev) => prev.filter((s) => String(s.id) !== String(pid)));
    else setSelectedParticipants((prev) => [...prev, { id: pid, name: p.name || p.email || pid, role: "advocates" }]);
  }
  function setParticipantRole(id, role) {
    setSelectedParticipants((prev) => prev.map((s) => (String(s.id) === String(id) ? { ...s, role } : s)));
  }
  function buildParticipantsPayload() {
    const out = { advocates: [], arbitrators: [], clients: [], respondents: [] };
    (selectedParticipants || []).forEach((s) => {
      const r = s.role || "advocates";
      if (!out[r]) out[r] = [];
      out[r].push(s.id);
    });
    return out;
  }

  // --------- submit (no signal passed to POST) ----------
  async function handleSubmit(e) {
    e?.preventDefault?.();
    const v = validate();
    if (!v.ok) {
      safeToast({ type: "error", message: v.message });
      return;
    }
    setSubmitting(true);
    const participantsPayload = buildParticipantsPayload();
    const payload = {
      caseId,
      title: title.trim(),
      start: v.start,
      timezone,
      end: null,
      venue: location && !/^https?:\/\//i.test(location) ? location : null,
      meetingLink: /^https?:\/\//i.test(location) ? location : null,
      description: notes || "",
      participants: participantsPayload,
      arbitration: arbitrationId || null,
      reminder: reminder.enabled ? { minutesBefore: Number(reminder.minutesBefore) || 30 } : null,
      recurrence: recurrence.freq !== "none" ? recurrence : null,
      status: saveDraft ? "draft" : "scheduled",
    };

    // optimistic UI entry
    const tempId = `temp_${Date.now()}`;
    const optimistic = {
      _id: tempId,
      title: payload.title,
      start: payload.start,
      case: { _id: caseId },
      description: payload.description,
      status: payload.status,
    };
    setHearings((p) => [optimistic, ...p]);

    try {
      // IMPORTANT: do not pass a signal to the POST — let create run
      const res = await api.post("/hearings", payload);
      const created = res?.data?.data ?? res?.data ?? res;
      // replace temp
      setHearings((prev) => [created, ...prev.filter((h) => h._id !== tempId && h.id !== tempId)]);
      safeToast({ type: "success", message: saveDraft ? "Draft saved" : "Hearing scheduled" });

      try { if (socket?.emit) socket.emit("hearing:new", created); } catch {}
      onCreated?.(created);

      // reset (preserve defaultCaseId)
      setTitle("");
      if (!defaultCaseId) setCaseId("");
      setDate("");
      setTime("");
      setLocation("");
      setNotes("");
      setSelectedParticipants([]);
      setReminder({ enabled: false, minutesBefore: 30 });
      setRecurrence({ freq: "none", interval: 1, count: 1 });
      setSaveDraft(false);
    } catch (err) {
      console.error("Create hearing failed", err);
      // try to show server message first
      const msg = err?.response?.data?.message || err?.message || "Failed to create hearing";
      safeToast({ type: "error", message: msg });
      // rollback optimistic
      setHearings((prev) => prev.filter((h) => h._id !== tempId));
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  }

  async function cancelHearing(id) {
    if (!confirm("Cancel this hearing?")) return;
    try {
      await api.delete(`/hearings/${id}`);
      setHearings((p) => p.filter((h) => (h._id || h.id) !== id));
      safeToast({ type: "success", message: "Hearing cancelled" });
      try { if (socket?.emit) socket.emit("hearing:deleted", id); } catch {}
    } catch (err) {
      console.error("Cancel failed", err);
      safeToast({ type: "error", message: err?.response?.data?.message || err?.message || "Failed to cancel hearing" });
    }
  }

  const looksLikeUrl = (s) => typeof s === "string" && /^https?:\/\//i.test(s);

  // --------- render ----------
  return (
    <Card className="shadow-md border border-gray-100">
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <CalendarDays className="w-5 h-5" /> Hearing Scheduler
        </CardTitle>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Case picker */}
          <div className="md:col-span-2">
            <Label htmlFor="caseSearch">Case (search)</Label>
            <div className="flex gap-2">
              <Input id="caseSearch" placeholder="Search cases by title or case number" value={caseSearch} onChange={(e) => setCaseSearch(e.target.value)} className="flex-1" />
              <button type="button" onClick={() => loadCases({ q: caseSearch, page: casePage })} className="px-3 py-1 rounded border bg-slate-50">Search</button>
            </div>

            <div className="mt-2 flex gap-2 items-center">
              <select value={caseId} onChange={(e) => setCaseId(e.target.value)} className="w-full border rounded px-2 py-1" aria-label="Select case" required>
                <option value="">{defaultCaseId ? "(Using context case)" : "Pick a case..."}</option>
                {caseOptions.map((c) => (
                  <option key={c._id || c.id} value={c._id || c.id}>
                    {c.caseNumber ? `${c.caseNumber} — ${c.title}` : c.title || c.name || (c._id || c.id)}
                  </option>
                ))}
              </select>

              {caseHasMore && (
                <button type="button" onClick={() => { const next = casePage + 1; setCasePage(next); loadCases({ q: caseSearch, page: next }); }} className="px-2 py-1 border rounded">More</button>
              )}
            </div>

            <p className="text-xs text-gray-500 mt-1">If you schedule from a case page, the case will be prefilled and participants auto-loaded.</p>
          </div>

          {/* Title */}
          <div>
            <Label htmlFor="title">Title (required)</Label>
            <Input id="title" placeholder="e.g. Preliminary hearing" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>

          {/* Date/time */}
          <div>
            <Label htmlFor="date">Date (required)</Label>
            <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>

          <div>
            <Label htmlFor="time">Time (required)</Label>
            <Input id="time" type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
          </div>

          <div>
            <Label htmlFor="timezone">Timezone</Label>
            <Input id="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
            <p className="text-xs text-gray-500 mt-1">Defaults to your browser timezone. Server should accept ISO timestamp.</p>
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="location">Location or Meeting Link</Label>
            <Input id="location" placeholder="Physical venue or https://..." value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" rows={3} placeholder="Meeting link, agenda, or notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {/* participants area */}
          <div>
            <Label>Participants (from selected case)</Label>
            <div className="border rounded p-2 max-h-36 overflow-auto space-y-1">
              {caseParticipants.length === 0 ? <div className="text-xs text-gray-500">No participants found for selected case.</div> : null}
              {caseParticipants.map((p) => {
                const pid = p._id || p.id;
                const sel = selectedParticipants.find((s) => String(s.id) === String(pid));
                return (
                  <div key={pid} className="flex items-center gap-2 justify-between">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={!!sel} onChange={() => toggleParticipant(p)} />
                      <span>{p.name || p.email || pid}</span>
                    </label>

                    {sel && (
                      <select value={sel.role} onChange={(e) => setParticipantRole(pid, e.target.value)} className="text-xs border rounded px-2 py-1">
                        {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-gray-500 mt-1">Select participants and assign their role (advocate, arbitrator, client, respondent).</p>
          </div>

          {/* reminders & recurrence */}
          <div>
            <Label>Reminder</Label>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={reminder.enabled} onChange={() => setReminder((r) => ({ ...r, enabled: !r.enabled }))} />
              <input type="number" min="1" value={reminder.minutesBefore} onChange={(e) => setReminder((r) => ({ ...r, minutesBefore: e.target.value }))} className="w-24 border rounded px-2 py-1" />
              <span className="text-sm text-gray-600">minutes before</span>
            </div>

            <Label className="mt-2">Recurrence (optional)</Label>
            <div className="flex items-center gap-2">
              <select value={recurrence.freq} onChange={(e) => setRecurrence((r) => ({ ...r, freq: e.target.value }))} className="border rounded px-2 py-1">
                <option value="none">None</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
              <input type="number" min="1" value={recurrence.interval} onChange={(e) => setRecurrence((r) => ({ ...r, interval: Number(e.target.value) }))} className="w-20 border rounded px-2 py-1" />
              <span className="text-sm">interval</span>
              <input type="number" min="1" value={recurrence.count} onChange={(e) => setRecurrence((r) => ({ ...r, count: Number(e.target.value) }))} className="w-20 border rounded px-2 py-1" />
              <span className="text-sm">occurrences</span>
            </div>
          </div>

          {/* actions */}
          <div className="md:col-span-2 flex items-center gap-3">
            <Button type="button" onClick={() => setPreviewOpen(true)} className="bg-white border">Preview</Button>

            <Button type="submit" disabled={submitting} className={clsx("flex items-center gap-2", submitting && "opacity-60")}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
              {saveDraft ? "Save Draft" : "Schedule Hearing"}
            </Button>

            <label className="flex items-center gap-2 text-sm ml-2">
              <input type="checkbox" checked={saveDraft} onChange={() => setSaveDraft((s) => !s)} />
              Save as draft
            </label>
          </div>
        </form>

        <div>
          <h3 className="font-semibold mb-2">Upcoming hearings</h3>
          {loading ? <div className="text-sm text-gray-500">Loading...</div> : hearings.length === 0 ? <div className="text-sm text-gray-500">No hearings yet.</div> : (
            <ul className="divide-y">
              {hearings.map((h) => (
                <li key={h._id || h.id} className="py-2 flex justify-between items-start">
                  <div>
                    <div className="font-medium">{h.title || h.case?.title || "(Untitled)"}</div>
                    <div className="text-xs text-gray-500">{h.start ? format(new Date(h.start || h.date), "PPP p") : "TBD"}</div>
                    {h.description && <div className="text-xs text-gray-500 mt-1">{h.description}</div>}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <button className="text-sm text-indigo-600" onClick={() => { /* open details placeholder */ }}>
                      Open
                    </button>
                    <button className="text-sm text-red-600" onClick={() => cancelHearing(h._id || h.id)}>
                      Cancel
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>

      {/* Preview modal */}
      {previewOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setPreviewOpen(false)} />
          <div className="bg-white rounded p-4 w-[min(800px,95%)] z-10 shadow-lg">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold">Preview Hearing</h3>
              <button onClick={() => setPreviewOpen(false)} className="text-gray-600"><XCircle /></button>
            </div>
            <div>
              <p><strong>Title:</strong> {title}</p>
              <p><strong>Case:</strong> {caseOptions.find((c) => (c._id || c.id) === caseId)?.title || caseId}</p>
              <p><strong>When:</strong> {date && time ? format(new Date(`${date}T${time}`), "PPP p") : "TBD"}</p>
              <p><strong>Timezone:</strong> {timezone}</p>
              <p><strong>Location:</strong> {location || "TBD"}</p>
              {notes && <p><strong>Notes:</strong> {notes}</p>}
              {reminder.enabled && <p><strong>Reminder:</strong> {reminder.minutesBefore} minutes before</p>}
              {recurrence.freq !== "none" && <p><strong>Recurrence:</strong> {recurrence.freq} every {recurrence.interval} × ({recurrence.count} times)</p>}
              {selectedParticipants.length > 0 && (
                <p><strong>Participants:</strong> {selectedParticipants.map((s) => `${s.name} (${s.role})`).join(", ")}</p>
              )}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button onClick={() => setPreviewOpen(false)}>Close</Button>
              <Button onClick={(e) => { setPreviewOpen(false); handleSubmit(e); }} className="bg-blue-600 text-white">Confirm & Schedule</Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
