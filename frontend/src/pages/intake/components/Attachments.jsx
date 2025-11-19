// frontend/src/pages/intake/components/Attachments.jsx
import React, { useRef, useState, useCallback, useEffect } from "react";
import API from "@/utils/api";
import { toast } from "sonner";
import { UploadCloud, FileText, Trash2, X } from "lucide-react";

/**
 * Attachments.jsx
 *
 * Reusable attachments uploader + preview component.
 *
 * Props:
 * - files: Array of uploaded file objects (controlled) [{ name, fileUrl, fileKey, fileType, size, previewUrl }]
 * - setFiles: function to update files array (required)
 * - maxFiles: number (default 20)
 * - maxFileSize: bytes (default 10MB)
 * - allowedTypes: array of mime types or extensions (optional)
 * - autoUpload: boolean (default true) — when true uploads immediately on selection
 *
 * Behavior:
 * - Drag & drop + click-to-select
 * - Immediate upload (per-file) with per-file progress
 * - Preview images using object URL
 * - Open and Remove controls (remove calls DELETE /upload with { fileKey })
 *
 * Backend endpoints used:
 * - POST /api/upload/multiple  (multipart form-data, field name: files)
 * - DELETE /api/upload  (JSON body: { fileKey })
 *
 * Notes:
 * - This component assumes your API wrapper attaches Authorization header.
 * - setFiles should accept an updater function (like React setState) or full array.
 */

const DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const DEFAULT_ALLOWED = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/csv",
  "application/zip",
];

export default function Attachments({
  files = [],
  setFiles,
  maxFiles = 20,
  maxFileSize = DEFAULT_MAX_SIZE,
  allowedTypes = DEFAULT_ALLOWED,
  autoUpload = true,
}) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState({}); // localNameOrId -> percent
  const [uploading, setUploading] = useState(false);

  // Helper: update files using controlled setter
  const pushFiles = useCallback(
    (newFiles) => {
      if (typeof setFiles === "function") {
        setFiles((prev) => {
          if (!Array.isArray(prev)) return [...newFiles];
          return [...prev, ...newFiles].slice(0, maxFiles);
        });
      } else {
        console.warn("Attachments: setFiles is not a function");
      }
    },
    [setFiles, maxFiles]
  );

  // Validate single file before upload
  const validateFile = (f) => {
    if (f.size > maxFileSize) {
      toast.error(`${f.name} exceeds maximum size of ${(maxFileSize / 1024 / 1024).toFixed(1)} MB`);
      return false;
    }

    if (allowedTypes && allowedTypes.length > 0) {
      // If allowedTypes looks like mime types, check file.type; otherwise allow everything
      const ok =
        allowedTypes.includes(f.type) ||
        allowedTypes.some((t) => t.startsWith(".") && f.name.toLowerCase().endsWith(t));
      if (!ok) {
        toast.error(`Invalid file type: ${f.type || f.name}`);
        return false;
      }
    }
    return true;
  };

  // Upload a single File object. Returns uploaded file record { name, fileUrl, fileKey, fileType, size }
  const uploadSingle = async (file) => {
    const localId = `${file.name}-${file.size}-${Date.now()}`;
    try {
      setUploading(true);
      setProgress((p) => ({ ...p, [localId]: 0 }));

      // Use FormData field 'files' so backend multer array handler works
      const fd = new FormData();
      fd.append("files", file);

      const res = await API.post("/upload/multiple", fd, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (evt) => {
          const pct = evt.total ? Math.round((evt.loaded * 100) / evt.total) : 0;
          setProgress((p) => ({ ...p, [localId]: pct }));
        },
      });

      const uploaded = Array.isArray(res.data?.files) && res.data.files[0] ? res.data.files[0] : null;
      if (!uploaded) throw new Error("Upload failed: missing response");

      // Build preview URL for images to display immediately
      const previewUrl = file.type?.startsWith("image/") ? URL.createObjectURL(file) : null;

      const fileObj = {
        name: uploaded.name || file.name,
        fileUrl: uploaded.fileUrl,
        fileKey: uploaded.fileKey,
        fileType: uploaded.fileType || file.type,
        size: uploaded.size || file.size,
        previewUrl,
      };

      // add to parent state
      pushFiles([fileObj]);

      return fileObj;
    } catch (err) {
      console.error("Upload error:", err);
      toast.error(err?.response?.data?.message || `Upload failed: ${file.name}`);
      throw err;
    } finally {
      setProgress((p) => {
        const copy = { ...p };
        delete copy[`${file.name}-${file.size}-${Date.now()}`]; // best-effort cleanup (id changed)
        return copy;
      });
      setUploading(false);
    }
  };

  // Upload multiple files (parallel, per-file progress)
  const uploadFiles = async (fileList) => {
    const valid = fileList.filter(validateFile);
    if (valid.length === 0) return;

    // Upload each file separately so we can report per-file progress.
    const promises = valid.map((f) => uploadSingle(f).catch((e) => null));
    await Promise.all(promises);
  };

  // handle input selection
  const onInputChange = async (e) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;

    // If not autoUpload, convert to preview objects with local preview only (not implemented here)
    if (autoUpload) await uploadFiles(selected);

    // reset input to allow reselecting same file later
    e.target.value = "";
  };

  // drag/drop handlers
  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    const dtFiles = Array.from(e.dataTransfer?.files || []);
    if (dtFiles.length === 0) return;
    if (autoUpload) await uploadFiles(dtFiles);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragging(false);
  };

  // Remove file (calls backend to delete by fileKey)
  const removeFile = async (fileKey) => {
    if (!fileKey) return;
    try {
      await API.delete("/upload", { data: { fileKey } });
      // update parent
      if (typeof setFiles === "function") {
        setFiles((prev) => (Array.isArray(prev) ? prev.filter((f) => f.fileKey !== fileKey) : []));
      }
      toast.success("File deleted");
    } catch (err) {
      console.error("Delete upload failed:", err);
      toast.error("Failed to delete file");
    }
  };

  // Open file in new tab (download)
  const openFile = (url) => {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // Cleanup object URLs when component unmounts or files change (to avoid memory leaks)
  useEffect(() => {
    return () => {
      // revoke any preview URLs in files prop
      if (Array.isArray(files)) {
        files.forEach((f) => {
          if (f.previewUrl) {
            try {
              URL.revokeObjectURL(f.previewUrl);
            } catch (e) {
              /* ignore */
            }
          }
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="attachments-component">
      <div
        className={`rounded border-2 transition p-3 ${
          dragging ? "border-blue-400 bg-blue-50" : "border-dashed border-gray-200 bg-white"
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <label
          className="flex items-center justify-between gap-3 cursor-pointer select-none"
          onClick={() => inputRef.current?.click()}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded bg-gray-100">
              <UploadCloud />
            </div>
            <div>
              <div className="font-medium">Click to upload or drag files here</div>
              <div className="text-xs text-gray-500">Allowed: pdf, doc, docx, images, csv, zip. Max per file: {(maxFileSize / 1024 / 1024).toFixed(1)} MB</div>
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={(ev) => {
                ev.stopPropagation();
                inputRef.current?.click();
              }}
              className="px-3 py-1 rounded bg-blue-600 text-white text-sm"
            >
              Upload
            </button>
          </div>
        </label>

        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={onInputChange}
          accept={allowedTypes.join(",")}
        />

        {/* progress list */}
        {Object.keys(progress).length > 0 && (
          <div className="mt-3 space-y-2">
            {Object.entries(progress).map(([k, pct]) => (
              <div key={k} className="flex items-center justify-between text-xs">
                <div className="truncate">{k}</div>
                <div>{pct}%</div>
              </div>
            ))}
          </div>
        )}

        {/* uploaded files preview */}
        {Array.isArray(files) && files.length > 0 && (
          <ul className="mt-3 space-y-2 max-h-56 overflow-auto">
            {files.map((f) => (
              <li key={f.fileKey} className="flex items-center justify-between gap-3 p-2 bg-gray-50 rounded">
                <div className="flex items-center gap-3">
                  {f.previewUrl ? (
                    <img src={f.previewUrl} alt={f.name} className="w-12 h-12 rounded object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded bg-gray-200 flex items-center justify-center">
                      <FileText />
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="text-sm truncate">{f.name}</div>
                    <div className="text-xs text-gray-500">{(f.size / 1024).toFixed(1)} KB • {f.fileType}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openFile(f.fileUrl)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    onClick={() => removeFile(f.fileKey)}
                    className="p-2 text-red-600 hover:text-red-800"
                    title="Remove"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* small caption */}
      <div className="mt-2 text-xs text-gray-500">
        Files are uploaded immediately and attached to the intake. You can remove them before submitting — removing will delete the uploaded file from storage.
      </div>
    </div>
  );
}
