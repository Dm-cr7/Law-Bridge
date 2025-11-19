// frontend/src/pages/intake/IntakePage.jsx
import React, { useEffect, useState, useMemo } from "react";
import { io } from "socket.io-client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import API from "@/utils/api";
import IntakeForm from "./components/IntakeForm.jsx";
import Attachments from "./components/Attachments.jsx";
import DuplicateCheck from "./components/DuplicateCheck.jsx";
import IntakeSuccess from "./IntakeSuccess.jsx";
import "./intake.css";

/**
 * IntakePage
 * Full-featured intake UI that:
 *  - shows IntakeForm for new client data
 *  - runs duplicate email/phone check (DuplicateCheck)
 *  - supports attachments upload (Attachments)
 *  - posts to backend POST /clients
 *  - displays a success screen (IntakeSuccess) with quick actions
 *
 * Backend expectations:
 *  - POST /clients            -> create client
 *  - GET  /clients?query=...  -> duplicate checks (optional)
 *  - Socket: client:created   -> broadcast new client
 *
 * Notes:
 *  - This component relies on your API axios wrapper (API) to provide
 *    baseURL / headers (auth token). Keep usage consistent: API.post("/clients", ...)
 */

const SOCKET_URL = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || "http://localhost:5000";
const SOCKET_PATH = import.meta.env.VITE_SOCKET_PATH || "/socket.io";

export default function IntakePage() {
  const { user } = useAuth() || {};
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createdClient, setCreatedClient] = useState(null);
  const [attachments, setAttachments] = useState([]); // { name, fileUrl, fileKey, fileType, size }
  const [recentDuplicates, setRecentDuplicates] = useState([]);
  const [socket, setSocket] = useState(null);

  // Connect Socket.IO to receive real-time client events (optional)
  useEffect(() => {
    // only connect if backend URL set and user exists
    if (!user || !user._id) return;

    const s = io(SOCKET_URL, {
      path: SOCKET_PATH,
      transports: ["websocket"],
      withCredentials: true,
      auth: {
        token: localStorage.getItem("authToken") || sessionStorage.getItem("authToken"),
      },
      query: { userId: user._id, role: user.role },
    });

    s.on("connect", () => {
      console.debug("Intake socket connected:", s.id);
    });

    s.on("client:created", (client) => {
      // If someone else created a client while we're on intake, notify
      toast.success(`New client created: ${client.name}`);
    });

    s.on("connect_error", (err) => {
      console.warn("Intake socket connect_error:", err?.message || err);
    });

    setSocket(s);
    return () => {
      try {
        s.removeAllListeners();
        s.disconnect();
      } catch (e) {
        /* ignore */
      }
      setSocket(null);
    };
  }, [user]);

  // memoized headers / metadata for create
  const meta = useMemo(
    () => ({
      createdBy: user?._id || null,
    }),
    [user]
  );

  // Duplicate-check helper (invoke backend endpoint or local check)
  // Expects API endpoint: GET /clients?email=... OR a dedicated duplicate route
  const runDuplicateCheck = async ({ email, phone }) => {
    try {
      if (!email && !phone) return [];
      setLoading(true);

      // Prefer a dedicated endpoint if available e.g., GET /clients?email=...
      // Using query-based search for compatibility with your current controllers.
      const q = email ? `email=${encodeURIComponent(email)}` : `phone=${encodeURIComponent(phone)}`;
      const res = await API.get(`/clients?${q}`);

      const found = Array.isArray(res.data) ? res.data : [];
      setRecentDuplicates(found.slice(0, 5));
      return found;
    } catch (err) {
      // If backend uses different shape, don't block intake — just log
      console.debug("Duplicate check error:", err?.response?.data || err);
      setRecentDuplicates([]);
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Called by IntakeForm on submit
  const handleCreateClient = async (payload) => {
    // payload expected to match clientController.createClient:
    // { name, email, phone, address, company, notes, requiredService, caseDescription, sharedWith }
    try {
      setSubmitting(true);

      // Attach any uploaded files to payload.attachments (if your backend Client model supports)
      if (attachments?.length) payload.attachments = attachments;

      // Create client on server
      const res = await API.post("/clients", payload);

      // server returns { message, client, userCreated } per controller
      const created = res.data?.client || res.data;
      setCreatedClient(created);

      // Success toast
      toast.success("Client created successfully");

      // Clear attachments after success
      setAttachments([]);

      // Optionally navigate or present success view
      return created;
    } catch (err) {
      console.error("Intake create failed:", err);
      const message = err?.response?.data?.message || err.message || "Failed to create client";
      toast.error(message);
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  // File upload helper used by Attachments component
  const handleUploadFiles = async (files) => {
    if (!files || !files.length) return [];
    setLoading(true);

    const uploaded = [];
    try {
      const form = new FormData();
      files.forEach((f) => form.append("files", f));

      // Using upload/multiple route that your backend uploadRoutes exposes
      const { data } = await API.post("/upload/multiple", form, {
        headers: { "Content-Type": "multipart/form-data" },
        // API instance should attach auth headers
      });

      const filesInfo = data?.files || data?.files || [];
      // normalize to our attachments list
      filesInfo.forEach((f) =>
        uploaded.push({
          name: f.name || (f.fileUrl ? f.fileUrl.split("/").pop() : "file"),
          fileUrl: f.fileUrl,
          fileKey: f.fileKey,
          fileType: f.fileType,
          size: f.size,
        })
      );

      // merge to attachments state
      setAttachments((prev) => [...(prev || []), ...uploaded]);

      toast.success(`${uploaded.length} file(s) uploaded`);
      return uploaded;
    } catch (err) {
      console.error("Upload failed:", err);
      const message = err?.response?.data?.message || "Upload failed";
      toast.error(message);
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Download helper - navigates to fileUrl or uses fetch for auth-protected resources
  const downloadFile = async (file) => {
    try {
      // If fileUrl is directly accessible (public), open directly
      if (!file || !file.fileUrl) return;
      // If fileUrl is same-origin and protected by cookies, use location.href.
      // If fileUrl requires Authorization header, fetch blob and create download link.
      const sameOrigin = new URL(file.fileUrl, window.location.origin).origin === window.location.origin;

      if (sameOrigin) {
        // attempt direct navigation (works for public static uploads)
        window.open(file.fileUrl, "_blank");
        return;
      }

      // For protected resources requiring Authorization header, fetch as blob
      const token = localStorage.getItem("authToken") || sessionStorage.getItem("authToken");
      if (token) {
        const resp = await fetch(file.fileUrl, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!resp.ok) throw new Error("Failed to download file");
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name || "download";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        return;
      }

      // fallback: open in new tab
      window.open(file.fileUrl, "_blank");
    } catch (err) {
      console.error("Download failed:", err);
      toast.error("Unable to download file");
    }
  };

  // If we've created a client, show success screen
  if (createdClient) {
    return (
      <div className="intake-page p-6">
        <IntakeSuccess
          client={createdClient}
          onCreateAnother={() => setCreatedClient(null)}
          onDownloadAll={() => {
            // download attachments if present
            const attachmentsList = createdClient.attachments || attachments || [];
            if (!attachmentsList.length) return toast("No attachments to download");
            attachmentsList.forEach((f) => downloadFile(f));
          }}
        />
      </div>
    );
  }

  // Main intake view
  return (
    <div className="intake-page p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Client Intake</h1>
          <p className="text-sm text-gray-600">Add new clients, upload documents, and run duplicate checks.</p>
        </div>
        <div>
          <small className="text-xs text-gray-500">Signed in as: {user?.name || "Unknown"}</small>
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 space-y-4">
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <IntakeForm
              onSubmit={async (values) => {
                // run duplicate check first
                const dups = await runDuplicateCheck({ email: values.email, phone: values.phone });
                if (dups && dups.length) {
                  // show duplicates and ask user to confirm -- simple confirmation for now
                  const confirmed = window.confirm(
                    `Found ${dups.length} possible duplicate(s). Do you still want to create a new client?`
                  );
                  if (!confirmed) {
                    setRecentDuplicates(dups);
                    return;
                  }
                }

                try {
                  const created = await handleCreateClient(values);
                  // populated client will be shown via createdClient state
                  // server emits client:created which other sockets receive
                  if (socket && socket.connected) {
                    // nothing else needed; server emits
                  }
                } catch (err) {
                  // error handled in handleCreateClient
                }
              }}
              submitting={submitting}
              loading={loading}
            />
          </div>

          <div className="bg-white p-4 rounded-lg shadow-sm">
            <h3 className="font-semibold mb-2">Attachments</h3>
            <p className="text-sm text-gray-500 mb-3">Upload any files relevant to this intake (IDs, documents).</p>
            <Attachments
              attachments={attachments}
              onUpload={handleUploadFiles}
              onRemove={(fileKey) => {
                setAttachments((prev) => prev.filter((f) => f.fileKey !== fileKey && f.fileUrl !== fileKey));
              }}
              onDownload={(file) => downloadFile(file)}
              uploading={loading}
            />
          </div>
        </section>

        <aside className="space-y-4">
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold">Duplicate check</h4>
              <small className="text-xs text-gray-500">Quick search</small>
            </div>

            <DuplicateCheck
              onCheck={runDuplicateCheck}
              recent={recentDuplicates}
              onSelectExisting={(client) => {
                // if user selects an existing client, open success-ish view or show details
                setCreatedClient(client);
              }}
            />
          </div>

          <div className="bg-white p-4 rounded-lg shadow-sm">
            <h4 className="font-semibold">Tips</h4>
            <ul className="text-sm text-gray-600 list-disc list-inside mt-2">
              <li>Run duplicate check before creating a new client.</li>
              <li>Upload identification documents in Attachments.</li>
              <li>Share the client record with the relevant advocate/paralegal after creation.</li>
            </ul>
          </div>
        </aside>
      </main>
    </div>
  );
}
