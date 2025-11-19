// frontend/src/pages/dashboard/ArbitratorDashboard.jsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { io } from "socket.io-client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Gavel,
  FileText,
  Archive,
  UploadCloud,
  Link as LinkIcon,
  Download,
  Check,
  X,
  Clock,
} from "lucide-react";
import API from "../utils/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";

/**
 * ArbitratorDashboard.jsx
 *
 * Features:
 *  - Realtime Socket.IO subscription (arbitration:created/updated/decision, evidence:added, notifications:new)
 *  - CRUD & scheduling for arbitrations
 *  - Evidence upload (multipart/form-data)
 *  - Drafting and issuing awards (downloadable PDF)
 *  - Join virtual hearings
 *
 * Backend expectations:
 *  - GET  /arbitrations
 *  - POST /arbitrations
 *  - PUT  /arbitrations/:id
 *  - DELETE /arbitrations/:id
 *  - GET  /arbitrations/:id/evidence
 *  - POST /arbitrations/:id/evidence (multipart)
 *  - POST /arbitrations/:id/award -> returns award PDF or award resource
 *  - GET  /reports/arbitrations/:id/award  (download)
 *
 * Socket events:
 *  - arbitration:created, arbitration:updated, arbitration:decision
 *  - evidence:added
 *  - notifications:new
 */

const SOCKET_PATH = import.meta.env.VITE_SOCKET_PATH || "/socket.io";
const BACKEND_SOCKET_URL =
  import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || "http://localhost:5000";

const arbitrationSchema = z.object({
  caseRef: z.string().min(3, "Case reference is required"),
  title: z.string().min(3, "Title required"),
  parties: z.string().min(3, "At least one party identifier required"),
  scheduledAt: z.string().min(1, "Date/time required"),
  durationMinutes: z.preprocess((v) => Number(v), z.number().min(10)),
  locationOrUrl: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const awardSchema = z.object({
  decisionText: z.string().min(10, "Decision text is required"),
  awardAmount: z.preprocess((v) => (v === "" ? null : Number(v)), z.number().nullable()),
  effectiveDate: z.string().optional().nullable(),
});

export default function ArbitratorDashboard() {
  const { user } = useAuth() || {};
  const [arbitrations, setArbitrations] = useState([]);
  const [evidenceIndex, setEvidenceIndex] = useState({}); // map arbitrationId -> evidence array
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEvidenceModal, setShowEvidenceModal] = useState(false);
  const [evidenceArbId, setEvidenceArbId] = useState(null);
  const [showAwardModal, setShowAwardModal] = useState(false);
  const [awardArbId, setAwardArbId] = useState(null);

  // Forms
  const {
    register: registerArb,
    handleSubmit: handleSubmitArb,
    reset: resetArb,
    formState: { errors: arbErrors, isSubmitting: arbSubmitting },
  } = useForm({ resolver: zodResolver(arbitrationSchema) });

  const {
    register: registerAward,
    handleSubmit: handleSubmitAward,
    reset: resetAward,
    formState: { errors: awardErrors, isSubmitting: awardSubmitting },
  } = useForm({ resolver: zodResolver(awardSchema) });

  // Load initial arbitrations
  const loadArbitrations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get("/arbitrations");
      setArbitrations(Array.isArray(res.data) ? res.data : []);
      // optionally preload evidence lists for visible arbitrations
    } catch (err) {
      console.error("Failed to load arbitrations:", err);
      toast.error(err?.response?.data?.message || "Failed to load arbitrations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadArbitrations();
  }, [loadArbitrations]);

  // Socket.io realtime wiring
  useEffect(() => {
    if (!user || !user._id) return;

    const s = io(BACKEND_SOCKET_URL, {
      path: SOCKET_PATH,
      transports: ["websocket"],
      withCredentials: true,
      auth: { token: localStorage.getItem("token") },
      query: { userId: user._id, role: user.role },
    });

    setSocket(s);

    s.on("connect", () => {
      console.info("Arbitrator socket connected:", s.id);
      // join arbitrators room if backend uses rooms
      s.emit("join", { room: `arbitrator:${user._id}` });
    });

    s.on("arbitration:created", (payload) => {
      setArbitrations((prev) => [payload, ...prev]);
      toast.success(`New arbitration created: ${payload.title}`);
    });

    s.on("arbitration:updated", (payload) => {
      setArbitrations((prev) => prev.map((a) => (a._id === payload._id ? payload : a)));
      toast.success(`Arbitration updated: ${payload.title}`);
    });

    s.on("arbitration:decision", (payload) => {
      setArbitrations((prev) => prev.map((a) => (a._id === payload._id ? payload : a)));
      toast.success(`Decision issued for ${payload.title}`);
    });

    s.on("evidence:added", ({ arbitrationId, evidence }) => {
      setEvidenceIndex((prev) => {
        const arr = prev[arbitrationId] ? [evidence, ...prev[arbitrationId]] : [evidence];
        return { ...prev, [arbitrationId]: arr };
      });
      toast.success("New evidence added");
    });

    s.on("notifications:new", (n) => {
      toast.info(n?.message || "New notification");
    });

    s.on("disconnect", (reason) => {
      console.warn("Socket disconnected:", reason);
    });

    s.on("connect_error", (err) => {
      console.error("Socket connect_error", err);
      toast.error("Real-time connection error");
    });

    return () => {
      s.removeAllListeners();
      s.disconnect();
      setSocket(null);
    };
  }, [user]);

  // Create arbitration
  const onCreateArbitration = async (payload) => {
    try {
      const { data } = await API.post("/arbitrations", payload);
      setArbitrations((prev) => [data, ...prev]);
      toast.success("Arbitration created");
      resetArb();
      setShowCreateModal(false);
    } catch (err) {
      console.error("Create arbitration failed:", err);
      toast.error(err?.response?.data?.message || "Failed to create arbitration");
      throw err;
    }
  };

  // Load evidence for arbitration
  const loadEvidence = async (arbitrationId) => {
    try {
      const res = await API.get(`/arbitrations/${arbitrationId}/evidence`);
      setEvidenceIndex((prev) => ({ ...prev, [arbitrationId]: Array.isArray(res.data) ? res.data : [] }));
    } catch (err) {
      console.error("Load evidence failed:", err);
      toast.error("Failed to load evidence");
    }
  };

  // Upload evidence
  const onUploadEvidence = async (formData) => {
    if (!evidenceArbId) return;
    try {
      const payload = new FormData();
      // `files` is a FileList
      for (const file of formData.files) {
        payload.append("files", file);
      }
      if (formData.notes) payload.append("notes", formData.notes);
      const res = await API.post(`/arbitrations/${evidenceArbId}/evidence`, payload, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      // server should emit evidence:added — update optimistically
      const added = Array.isArray(res.data) ? res.data : [res.data];
      setEvidenceIndex((prev) => ({ ...prev, [evidenceArbId]: [...(prev[evidenceArbId] || []), ...added] }));
      toast.success("Evidence uploaded");
      setShowEvidenceModal(false);
      setEvidenceArbId(null);
    } catch (err) {
      console.error("Upload evidence error:", err);
      toast.error(err?.response?.data?.message || "Failed to upload evidence");
      throw err;
    }
  };

  // Draft / issue award
  const onIssueAward = async (values) => {
    if (!awardArbId) return;
    try {
      const payload = {
        decisionText: values.decisionText,
        awardAmount: values.awardAmount || null,
        effectiveDate: values.effectiveDate || null,
      };
      // server returns award resource (and emits arbitration:decision)
      const { data } = await API.post(`/arbitrations/${awardArbId}/award`, payload);
      setArbitrations((prev) => prev.map((a) => (a._id === data._id ? data : a)));
      toast.success("Award issued");
      resetAward();
      setShowAwardModal(false);
      setAwardArbId(null);
    } catch (err) {
      console.error("Issue award failed:", err);
      toast.error(err?.response?.data?.message || "Failed to issue award");
      throw err;
    }
  };

  // Download award PDF
  const downloadAward = async (arbitrationId) => {
    try {
      const res = await API.get(`/reports/arbitrations/${arbitrationId}/award`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `award-${arbitrationId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Award downloaded");
    } catch (err) {
      console.error("Download award failed:", err);
      toast.error("Failed to download award");
    }
  };

  // Join hearing (virtual link)
  const joinHearing = (arbitration) => {
    const url = arbitration.locationOrUrl || arbitration.virtualRoomUrl;
    if (!url) {
      toast.error("No hearing link available");
      return;
    }
    window.open(url, "_blank");
  };

  // Derived stats
  const stats = useMemo(() => {
    const total = arbitrations.length;
    const scheduled = arbitrations.filter((a) => a.status && a.status.toLowerCase().includes("scheduled")).length;
    const decided = arbitrations.filter((a) => a.status && a.status.toLowerCase().includes("decided")).length;
    return { total, scheduled, decided };
  }, [arbitrations]);

  return (
    <div className="arbitrator-dashboard min-h-screen p-6 bg-black-50">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">Arbitrator Dashboard</h1>
          <p className="text-slate-600 mt-1">Manage arbitrations, evidence and awards — in real time.</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white"
          >
            <Gavel /> New Arbitration
          </button>
          <button
            onClick={loadArbitrations}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-white border"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-sm flex items-center gap-4">
          <div className="p-2 bg-blue-50 rounded-md text-blue-600"><Archive /></div>
          <div>
            <p className="text-sm text-slate-500">Total Arbitrations</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm flex items-center gap-4">
          <div className="p-2 bg-amber-50 rounded-md text-amber-600"><Clock /></div>
          <div>
            <p className="text-sm text-slate-500">Scheduled</p>
            <p className="text-2xl font-bold">{stats.scheduled}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm flex items-center gap-4">
          <div className="p-2 bg-green-50 rounded-md text-green-600"><Check /></div>
          <div>
            <p className="text-sm text-slate-500">Decisions</p>
            <p className="text-2xl font-bold">{stats.decided}</p>
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: arbitration list */}
        <section className="lg:col-span-2 space-y-4">
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Arbitrations</h2>
              <div className="text-sm text-slate-500">{arbitrations.length} total</div>
            </div>

            {loading ? (
              <div className="space-y-2 animate-pulse">
                <div className="h-8 bg-black-200 rounded" />
                <div className="h-8 bg-black-200 rounded" />
              </div>
            ) : arbitrations.length === 0 ? (
              <div className="text-slate-500">No arbitrations found.</div>
            ) : (
              <ul className="space-y-2">
                {arbitrations.map((a) => (
                  <li key={a._id} className="p-3 rounded-md bg-slate-50 flex items-start justify-between">
                    <div>
                      <div className="font-semibold">{a.title} <span className="text-xs text-slate-500 ml-2">#{a.caseRef}</span></div>
                      <div className="text-xs text-slate-500">{a.parties}</div>
                      <div className="text-xs text-slate-400 mt-1">{a.scheduledAt ? new Date(a.scheduledAt).toLocaleString() : "Not scheduled"}</div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex gap-2">
                        <button className="px-2 py-1 bg-white border rounded text-xs" onClick={() => { setEvidenceArbId(a._id); loadEvidence(a._id); setShowEvidenceModal(true); }}>
                          <UploadCloud size={14} /> Evidence
                        </button>
                        <button className="px-2 py-1 bg-white border rounded text-xs" onClick={() => { setAwardArbId(a._id); setShowAwardModal(true); }}>
                          <FileText size={14} /> Award
                        </button>
                        <button className="px-2 py-1 bg-blue-600 text-white rounded text-xs" onClick={() => joinHearing(a)}>
                          <LinkIcon size={12} /> Join
                        </button>
                      </div>

                      <div className="flex gap-2 items-center">
                        <button className="text-xs text-slate-600" onClick={() => downloadAward(a._id)} title="Download Award">
                          <Download size={14} />
                        </button>
                        <button className="text-xs text-red-600" onClick={async () => {
                          if (!confirm("Cancel this arbitration?")) return;
                          try {
                            await API.delete(`/arbitrations/${a._id}`);
                            setArbitrations((prev) => prev.filter(x => x._id !== a._id));
                            toast.success("Arbitration cancelled");
                          } catch (err) {
                            console.error("Cancel arbitration failed:", err);
                            toast.error("Failed to cancel arbitration");
                          }
                        }}>
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Evidence / Award history panel */}
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <h3 className="font-semibold mb-2">Evidence & Awards</h3>
            <p className="text-sm text-slate-500 mb-3">Select an arbitration and upload evidence or draft awards. Evidence is stored per arbitration record.</p>
            <div className="text-sm text-slate-700">
              <p>To view evidence: open an arbitration and click Evidence. Uploaded files will appear in the evidence list and push live updates to participants.</p>
            </div>
          </div>
        </section>

        {/* Right: quick actions & recent notifications */}
        <aside className="space-y-4">
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold">Quick Actions</h4>
            </div>

            <div className="flex flex-col gap-2">
              <button onClick={() => setShowCreateModal(true)} className="px-3 py-2 rounded bg-blue-600 text-white flex items-center gap-2"><Gavel /> New Arbitration</button>
              <button onClick={loadArbitrations} className="px-3 py-2 rounded bg-white border flex items-center gap-2">Refresh List</button>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow-sm">
            <h4 className="font-semibold mb-2">Recent Notifications</h4>
            <div className="text-sm text-slate-500">Notifications appear as they arrive. For persistent notifications, implement /notifications endpoint.</div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow-sm">
            <h4 className="font-semibold mb-2">Tips</h4>
            <ul className="text-sm text-slate-600 list-disc pl-5">
              <li>Issue awards promptly to comply with timelines.</li>
              <li>Attach evidence to the correct arbitration record.</li>
              <li>Use virtual links for remote hearings; ensure links are saved in the arbitration record.</li>
            </ul>
          </div>
        </aside>
      </div>

      {/* Create Arbitration Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Create Arbitration</h3>
              <button onClick={() => setShowCreateModal(false)} className="p-2 rounded hover:bg-slate-100"><X /></button>
            </div>

            <form onSubmit={handleSubmitArb(onCreateArbitration)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium">Case reference</label>
                <input {...registerArb("caseRef")} className="mt-1 w-full rounded-md border p-2" />
                {arbErrors.caseRef && <p className="text-xs text-red-600">{arbErrors.caseRef.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium">Title</label>
                <input {...registerArb("title")} className="mt-1 w-full rounded-md border p-2" />
                {arbErrors.title && <p className="text-xs text-red-600">{arbErrors.title.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium">Parties (comma-separated identifiers)</label>
                <input {...registerArb("parties")} placeholder="Party A, Party B" className="mt-1 w-full rounded-md border p-2" />
                {arbErrors.parties && <p className="text-xs text-red-600">{arbErrors.parties.message}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium">Date & Time</label>
                  <input {...registerArb("scheduledAt")} type="datetime-local" className="mt-1 w-full rounded-md border p-2" />
                  {arbErrors.scheduledAt && <p className="text-xs text-red-600">{arbErrors.scheduledAt.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium">Duration (minutes)</label>
                  <input {...registerArb("durationMinutes", { valueAsNumber: true })} type="number" min={10} className="mt-1 w-full rounded-md border p-2" />
                  {arbErrors.durationMinutes && <p className="text-xs text-red-600">{arbErrors.durationMinutes.message}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium">Location / Virtual link (optional)</label>
                <input {...registerArb("locationOrUrl")} className="mt-1 w-full rounded-md border p-2" />
              </div>

              <div>
                <label className="block text-sm font-medium">Notes</label>
                <textarea {...registerArb("notes")} rows={3} className="mt-1 w-full rounded-md border p-2" />
              </div>

              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 rounded bg-black-100">Cancel</button>
                <button type="submit" disabled={arbSubmitting} className="px-4 py-2 rounded bg-blue-600 text-white">{arbSubmitting ? "Creating..." : "Create Arbitration"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Evidence Modal */}
      {showEvidenceModal && evidenceArbId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Upload Evidence</h3>
              <button onClick={() => { setShowEvidenceModal(false); setEvidenceArbId(null); }} className="p-2 rounded hover:bg-slate-100"><X /></button>
            </div>

            <EvidenceUploadForm onSubmit={onUploadEvidence} />
            <div className="mt-4">
              <h4 className="font-semibold mb-2">Existing Evidence</h4>
              <div className="text-sm text-slate-600">
                {Array.isArray(evidenceIndex[evidenceArbId]) && evidenceIndex[evidenceArbId].length ? (
                  <ul className="space-y-2 max-h-48 overflow-auto">
                    {evidenceIndex[evidenceArbId].map((ev) => (
                      <li key={ev._id || ev.filename} className="flex items-center justify-between bg-slate-50 p-2 rounded">
                        <div>
                          <div className="font-medium">{ev.filename || ev.name}</div>
                          <div className="text-xs text-slate-500">{ev.notes || ""}</div>
                        </div>
                        <div className="flex gap-2">
                          <a href={ev.url || ev.path} target="_blank" rel="noreferrer" className="text-slate-600"><Download size={14} /></a>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-slate-500">No evidence uploaded yet.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Award Modal */}
      {showAwardModal && awardArbId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Draft & Issue Award</h3>
              <button onClick={() => { setShowAwardModal(false); setAwardArbId(null); }} className="p-2 rounded hover:bg-slate-100"><X /></button>
            </div>

            <form onSubmit={handleSubmitAward(onIssueAward)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium">Decision / Award Text</label>
                <textarea {...registerAward("decisionText")} rows={6} className="mt-1 w-full rounded-md border p-2" />
                {awardErrors.decisionText && <p className="text-xs text-red-600">{awardErrors.decisionText.message}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium">Award Amount (optional)</label>
                  <input {...registerAward("awardAmount")} type="number" className="mt-1 w-full rounded-md border p-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium">Effective Date (optional)</label>
                  <input {...registerAward("effectiveDate")} type="date" className="mt-1 w-full rounded-md border p-2" />
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => { setShowAwardModal(false); setAwardArbId(null); }} className="px-4 py-2 rounded bg-black-100">Cancel</button>
                <button type="submit" disabled={awardSubmitting} className="px-4 py-2 rounded bg-green-600 text-white">{awardSubmitting ? "Issuing..." : "Issue Award"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* small scoped styles */}
      <style jsx>{`
        .arbitrator-dashboard { font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial; }
      `}</style>
    </div>
  );

  // ----- helper components below -----
  function EvidenceUploadForm({ onSubmit }) {
    const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm();
    const submit = async (vals) => {
      // vals.files is FileList
      await onSubmit(vals);
      reset();
    };
    return (
      <form onSubmit={handleSubmit(submit)} className="space-y-3">
        <div>
          <label className="block text-sm font-medium">Files</label>
          <input {...register("files")} type="file" multiple className="mt-1" />
        </div>
        <div>
          <label className="block text-sm font-medium">Notes (optional)</label>
          <input {...register("notes")} className="mt-1 w-full rounded-md border p-2" />
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => { setShowEvidenceModal(false); setEvidenceArbId(null); }} className="px-3 py-2 rounded bg-black-100">Close</button>
          <button type="submit" disabled={isSubmitting} className="px-3 py-2 rounded bg-blue-600 text-white">Upload</button>
        </div>
      </form>
    );
  }
}
