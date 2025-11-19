// frontend/src/pages/intake/IntakeSuccess.jsx
import React from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { CheckCircle, FileText, User, Link as LinkIcon, Download } from "lucide-react";
import { toast, Toaster } from "sonner";

/**
 * IntakeSuccess.jsx
 *
 * Success screen after creating a client (and optionally a case).
 * - Expects `data` prop (server response). Normalizes a few common shapes.
 * - Provides actions: view client, view case, open/download attachments, create another.
 *
 * Notes:
 * - sonner exports are named (toast, Toaster) — do NOT import default.
 * - This component renders a local <Toaster /> to ensure toasts show even when app root doesn't include one.
 */

function prettyName(client) {
  if (!client) return "";
  const fn = client.firstName || client.first_name || client.name || "";
  const ln = client.lastName || client.last_name || "";
  return `${fn} ${ln}`.trim() || "(Unnamed)";
}

export default function IntakeSuccess({ data, onNewIntake, showLocalToaster = false }) {
  const navigate = useNavigate();

  // Accept several possible shapes: { client, case }, or client object directly
  const client = data?.client || (data && data._id ? data : null);
  const intakeCase = data?.case || data?.intakeCase || null;
  const attachments = Array.isArray(client?.attachments) ? client.attachments : [];

  const openClient = () => {
    if (!client?._id) {
      toast.error("Client id missing");
      return;
    }
    navigate(`/dashboard/clients/${client._id}`);
  };

  const openCase = () => {
    if (!intakeCase?._id) {
      toast.error("Case id missing");
      return;
    }
    navigate(`/dashboard/cases/${intakeCase._id}`);
  };

  const downloadAttachment = (url) => {
    if (!url) {
      toast.error("No file URL available");
      return;
    }
    // open in new tab — let browser handle download behavior
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="intake-success min-h-[60vh] flex items-start justify-center p-6">
      {/* Local Toaster (optional) — set showLocalToaster to false if you already render Toaster globally */}
      {showLocalToaster && <Toaster position="top-right" />}

      <div className="w-full max-w-3xl bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="rounded-full bg-green-100 text-green-700 p-3">
            <CheckCircle size={28} />
          </div>
          <div>
            <h2 className="text-2xl font-semibold">Intake Completed</h2>
            <p className="text-sm text-gray-600 mt-1">
              The client intake was created successfully. Use the actions below to proceed.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Client block */}
          <div className="p-4 border rounded">
            <div className="text-xs text-gray-500 mb-1">Client</div>
            {client ? (
              <>
                <div className="flex items-center gap-2 font-medium">
                  <User />
                  <div>{prettyName(client)}</div>
                </div>
                <div className="text-sm text-gray-600 mt-2">
                  <div>{client.email || "—"}</div>
                  <div>{client.primaryPhone || client.phone || "—"}</div>
                </div>
              </>
            ) : (
              <div className="text-sm text-gray-500">No client data returned</div>
            )}
          </div>

          {/* Case block */}
          <div className="p-4 border rounded">
            <div className="text-xs text-gray-500 mb-1">Case (if created)</div>
            {intakeCase ? (
              <>
                <div className="font-medium">
                  {intakeCase.title || intakeCase.caseNumber || "Untitled Case"}
                </div>
                <div className="text-sm text-gray-600 mt-2">
                  {intakeCase.caseNumber ? `Case # ${intakeCase.caseNumber}` : ""}
                </div>
              </>
            ) : (
              <div className="text-sm text-gray-500">No case created</div>
            )}
          </div>

          {/* Attachments block */}
          <div className="p-4 border rounded">
            <div className="text-xs text-gray-500 mb-1">Attachments</div>
            {attachments.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {attachments.map((a, i) => {
                  const key = a.fileKey || a.fileUrl || `${i}`;
                  const name =
                    a.name ||
                    (typeof a.fileUrl === "string" ? a.fileUrl.split("/").pop() : `Attachment ${i + 1}`);
                  return (
                    <li key={key} className="flex items-center justify-between">
                      <div className="truncate">
                        <div className="font-medium">{name}</div>
                        {a.fileType && <div className="text-xs text-gray-500">{a.fileType}</div>}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => downloadAttachment(a.fileUrl)}
                          className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded flex items-center gap-1"
                          title="Open / download"
                        >
                          <Download size={14} /> Open
                        </button>

                        <a
                          href={a.fileUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                          title="Open in new tab"
                        >
                          <LinkIcon size={12} /> Link
                        </a>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="text-sm text-gray-500">No attachments</div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={openClient}
            className="px-4 py-2 rounded bg-blue-600 text-white flex items-center gap-2"
            title="View client details"
          >
            <User /> View Client
          </button>

          <button
            onClick={openCase}
            disabled={!intakeCase}
            className={`px-4 py-2 rounded flex items-center gap-2 ${
              intakeCase ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-500 cursor-not-allowed"
            }`}
            title={intakeCase ? "View case" : "No case created"}
          >
            <FileText /> View Case
          </button>

          <button
            onClick={() => {
              try {
                onNewIntake?.();
                toast("Ready for new intake");
              } catch (err) {
                toast.error("Unable to start new intake");
              }
            }}
            className="px-4 py-2 rounded bg-white border text-gray-700"
          >
            Create Another Intake
          </button>
        </div>
      </div>
    </div>
  );
}

IntakeSuccess.propTypes = {
  data: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
  onNewIntake: PropTypes.func,
  showLocalToaster: PropTypes.bool,
};

IntakeSuccess.defaultProps = {
  data: null,
  onNewIntake: null,
  showLocalToaster: false,
};
