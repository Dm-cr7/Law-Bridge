// frontend/src/pages/intake/components/IntakeForm.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import API from "@/utils/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { X, UploadCloud, FileText, Trash2 } from "lucide-react";
import PropTypes from "prop-types";

/**
 * IntakeForm.jsx
 *
 * Self-contained intake form:
 * - React Hook Form + zod validation
 * - Immediate file uploads to /upload/multiple
 * - Per-file preview + remove (calls DELETE /upload)
 * - Duplicate detection (/clients?q=)
 * - Save draft and Submit (POST /clients)
 *
 * Expects:
 * - API axios instance configured (baseURL + auth)
 * - onSuccess(result) prop callback that receives created client and optional case
 *
 * Usage:
 * <IntakeForm categories={[]} sources={[]} onSuccess={cb} />
 */

/* ------------------------
   Zod validation schema
   ------------------------ */
const intakeSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  middleName: z.string().optional().nullable(),
  lastName: z.string().min(1, "Last name is required"),
  preferredName: z.string().optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  gender: z.enum(["male", "female", "other"]).optional().nullable(),
  idNumber: z.string().optional().nullable(),

  email: z.string().email("Enter a valid email").optional().nullable(),
  primaryPhone: z.string().min(6, "Primary phone is required"),
  secondaryPhone: z.string().optional().nullable(),

  addressLine1: z.string().optional().nullable(),
  addressLine2: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  country: z.string().optional().nullable(),

  company: z.string().optional().nullable(),
  occupation: z.string().optional().nullable(),

  notes: z.string().optional().nullable(),
  tags: z.string().optional().nullable(), // comma-separated; convert on submit

  consentGiven: z.boolean().optional().default(false),

  intakeCase_create: z.boolean().optional().default(false),
  intakeCase_title: z.string().optional().nullable(),
  intakeCase_category: z.string().optional().nullable(),
  intakeCase_priority: z.enum(["low", "medium", "high", "urgent"]).optional().default("medium"),
  intakeCase_description: z.string().optional().nullable(),

  source: z.string().optional().nullable(),
});

/* ------------------------
   Helpers
   ------------------------ */
const normalizePhone = (p) =>
  (p || "").toString().replace(/[^\d+]/g, "").trim();

const parseTags = (s) =>
  (s || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

/* ------------------------
   Component
   ------------------------ */
export default function IntakeForm({ categories = [], sources = [], onSuccess }) {
  const { user: authUser } = useAuth() || {};
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
    reset,
  } = useForm({
    resolver: zodResolver(intakeSchema),
    defaultValues: {
      firstName: "",
      middleName: "",
      lastName: "",
      preferredName: "",
      dateOfBirth: "",
      gender: "",
      idNumber: "",
      email: "",
      primaryPhone: "",
      secondaryPhone: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      postalCode: "",
      country: "",
      company: "",
      occupation: "",
      notes: "",
      tags: "",
      consentGiven: false,
      intakeCase_create: false,
      intakeCase_title: "",
      intakeCase_category: categories?.[0] || "civil",
      intakeCase_priority: "medium",
      intakeCase_description: "",
      source: "",
    },
  });

  const fileInputRef = useRef(null);

  // local UI state
  const [uploading, setUploading] = useState(false);
  const [uploadProgressMap, setUploadProgressMap] = useState({}); // fileName -> percent
  const [uploadedFiles, setUploadedFiles] = useState([]); // { name, fileUrl, fileKey, fileType, size, previewUrl }
  const [duplicates, setDuplicates] = useState([]);
  const [checkingDup, setCheckingDup] = useState(false);

  const primaryPhone = watch("primaryPhone");
  const email = watch("email");
  const intakeCaseCreate = watch("intakeCase_create");
  const consentGiven = watch("consentGiven");

  /* ------------------------
     Duplicate detection (debounced)
     ------------------------ */
  useEffect(() => {
    let t;
    const q = (email || "").trim() || normalizePhone(primaryPhone || "");
    if (!q) {
      setDuplicates([]);
      return;
    }

    setCheckingDup(true);
    t = setTimeout(async () => {
      try {
        // API instance should have baseURL that maps to /api
        const res = await API.get(`/clients?q=${encodeURIComponent(q)}&limit=5`);
        const list = Array.isArray(res.data) ? res.data : (res.data?.clients || res.data?.items || []);
        setDuplicates(list);
      } catch (err) {
        console.error("Duplicate check failed:", err);
      } finally {
        setCheckingDup(false);
      }
    }, 600); // 600ms debounce

    return () => clearTimeout(t);
  }, [primaryPhone, email]);

  /* ------------------------
     File upload handler (immediate upload)
     ------------------------ */
  const handleFilesSelected = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setUploading(true);
    const uploaded = [];

    for (const file of files) {
      try {
        const fd = new FormData();
        // backend expects 'files' for multiple uploads; sending one file in array still works
        fd.append("files", file);

        const res = await API.post("/upload/multiple", fd, {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (evt) => {
            const percent = evt.total ? Math.round((evt.loaded * 100) / evt.total) : 0;
            setUploadProgressMap((p) => ({ ...p, [file.name]: percent }));
          },
        });

        // expected response: { files: [{ name, fileUrl, fileKey, fileType, size }] }
        const filesRes = res.data?.files || [];
        const f = filesRes[0] || null;
        if (!f) {
          throw new Error("Upload response missing file details");
        }

        const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;

        uploaded.push({
          name: f.name || file.name,
          fileUrl: f.fileUrl,
          fileKey: f.fileKey,
          fileType: f.fileType || file.type,
          size: f.size || file.size,
          previewUrl,
        });
      } catch (err) {
        console.error("Upload error:", err);
        toast.error(err?.response?.data?.message || `Failed to upload ${file.name}`);
      } finally {
        // clear progress for file
        setUploadProgressMap((p) => {
          const copy = { ...p };
          delete copy[file.name];
          return copy;
        });
      }
    }

    setUploadedFiles((prev) => [...prev, ...uploaded]);
    setUploading(false);

    // reset input to allow re-upload same file if needed
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  /* ------------------------
     Remove uploaded file (calls backend delete)
     ------------------------ */
  const removeUploadedFile = async (fileKey) => {
    try {
      // backend expects DELETE /upload with body { fileKey }
      await API.delete("/upload", { data: { fileKey } });
      setUploadedFiles((prev) => {
        const found = prev.find((f) => f.fileKey === fileKey);
        if (found?.previewUrl) {
          try {
            URL.revokeObjectURL(found.previewUrl);
          } catch (e) {}
        }
        return prev.filter((f) => f.fileKey !== fileKey);
      });
      toast.success("File removed");
    } catch (err) {
      console.error("Delete file failed:", err);
      toast.error(err?.response?.data?.message || "Failed to remove file");
    }
  };

  /* ------------------------
     Submit / Save Draft
     ------------------------ */
  const buildPayload = (formValues, status = "submitted") => {
    const payload = {
      // person fields
      firstName: formValues.firstName?.trim() || "",
      middleName: formValues.middleName?.trim() || "",
      lastName: formValues.lastName?.trim() || "",
      preferredName: formValues.preferredName?.trim() || "",
      dateOfBirth: formValues.dateOfBirth || null,
      gender: formValues.gender || null,
      idNumber: formValues.idNumber || null,

      // contacts
      email: formValues.email?.trim()?.toLowerCase() || null,
      primaryPhone: normalizePhone(formValues.primaryPhone || ""),
      secondaryPhone: normalizePhone(formValues.secondaryPhone || ""),

      // address as nested object
      address: {
        line1: formValues.addressLine1 || "",
        line2: formValues.addressLine2 || "",
        city: formValues.city || "",
        state: formValues.state || "",
        postalCode: formValues.postalCode || "",
        country: formValues.country || "",
      },

      company: formValues.company || null,
      occupation: formValues.occupation || null,

      notes: formValues.notes || "",
      tags: parseTags(formValues.tags || ""),

      consentGiven: !!formValues.consentGiven,

      // intake metadata — backend will still set createdBy from req.user
      intake: {
        source: formValues.source || null,
        intakeOfficer: authUser?._id || null,
        status,
      },

      // attachments — backend model maps attachments if accepted
      attachments: uploadedFiles.map((f) => ({
        name: f.name,
        fileUrl: f.fileUrl,
        fileKey: f.fileKey,
        fileType: f.fileType,
        size: f.size,
      })),
    };

    if (formValues.intakeCase_create) {
      payload.intakeCase = {
        createCase: true,
        title: formValues.intakeCase_title || "",
        category: formValues.intakeCase_category || "civil",
        priority: formValues.intakeCase_priority || "medium",
        description: formValues.intakeCase_description || "",
      };
    }

    return payload;
  };

  const onSubmit = async (values) => {
    // require consent if attachments present
    if (uploadedFiles.length > 0 && !values.consentGiven) {
      toast.error("Client consent required to upload documents");
      return;
    }

    try {
      // UI lock handled by react-hook-form's isSubmitting; still show loading toast optionally
      const payload = buildPayload(values, "submitted");

      // Use API.post("/clients") — assumes API baseURL already contains /api
      const res = await API.post("/clients", payload);

      // backend may return { client, case, userCreated, message } or client directly
      const data = res.data || res;
      toast.success("Client intake submitted");

      // call parent onSuccess with server return
      onSuccess?.(data);

      // cleanup previews
      uploadedFiles.forEach((f) => {
        if (f.previewUrl) {
          try {
            URL.revokeObjectURL(f.previewUrl);
          } catch (e) {}
        }
      });
      setUploadedFiles([]);

      // optional: reset form to defaults
      reset();
    } catch (err) {
      console.error("Submit intake failed:", err);

      const srv = err?.response?.data;
      if (srv) {
        // handle mongoose validation errors shape
        if (srv.errors && typeof srv.errors === "object") {
          const messages = Object.values(srv.errors).map((v) => v.message || v).join(", ");
          toast.error(messages);
        } else if (srv.message) {
          toast.error(srv.message);
        } else {
          toast.error("Bad request — check inputs");
        }
      } else {
        toast.error("Network or server error");
      }
      // don't rethrow — handle within UI
    }
  };

  const onSaveDraft = async (values) => {
    try {
      const payload = buildPayload(values, "draft");
      const res = await API.post("/clients", payload);
      const data = res.data || res;
      toast.success("Draft saved");
      onSuccess?.(data);
      // do not reset uploadedFiles (draft might still reference them)
    } catch (err) {
      console.error("Save draft failed:", err);
      const srv = err?.response?.data;
      if (srv?.message) toast.error(srv.message);
      else toast.error("Failed to save draft");
    }
  };

  /* ------------------------
     Small UI subcomponents (internal)
     ------------------------ */

  function AttachmentsPanel() {
    return (
      <div className="border border-gray-200 rounded p-3">
        <label className="flex items-center gap-3 p-3 border-2 border-dashed rounded cursor-pointer hover:border-blue-400">
          <UploadCloud />
          <span className="text-sm text-gray-600">{uploading ? "Uploading..." : "Click or drop files"}</span>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFilesSelected}
            className="hidden"
            accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/csv,application/zip,text/plain"
            disabled={uploading}
          />
        </label>

        {Object.keys(uploadProgressMap).length > 0 && (
          <div className="mt-2 space-y-2 text-xs">
            {Object.entries(uploadProgressMap).map(([name, pct]) => (
              <div key={name} className="flex items-center gap-3">
                <div className="flex-1 truncate">{name}</div>
                <div className="w-20 text-right">{pct}%</div>
              </div>
            ))}
          </div>
        )}

        {uploadedFiles.length > 0 && (
          <ul className="mt-3 space-y-2 max-h-40 overflow-auto">
            {uploadedFiles.map((f) => (
              <li key={f.fileKey || f.fileUrl} className="flex items-center justify-between gap-3 p-2 bg-gray-50 rounded">
                <div className="flex items-center gap-3">
                  {f.previewUrl ? (
                    // image preview
                    <img src={f.previewUrl} alt={f.name} className="w-10 h-10 rounded object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded bg-gray-200 flex items-center justify-center">
                      <FileText />
                    </div>
                  )}
                  <div className="text-sm">
                    <div className="truncate max-w-xs">{f.name}</div>
                    <div className="text-xs text-gray-500">{f.size ? `${(f.size / 1024).toFixed(1)} KB` : ""}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <a href={f.fileUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">Open</a>
                  <button
                    type="button"
                    onClick={() => removeUploadedFile(f.fileKey)}
                    title="Remove"
                    className="p-2 text-red-600 hover:text-red-800"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  function DuplicatePanel() {
    if (!checkingDup && duplicates.length === 0) return null;
    return (
      <div className="mt-2 p-3 border border-yellow-200 bg-yellow-50 rounded">
        <div className="text-sm font-semibold">Possible matches</div>
        {checkingDup ? (
          <div className="text-xs text-gray-500 mt-1">Checking…</div>
        ) : (
          <ul className="mt-2 space-y-2 text-xs">
            {duplicates.length === 0 ? (
              <li className="text-gray-500">No similar clients</li>
            ) : (
              duplicates.map((c) => (
                <li key={c._id} className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{c.firstName || c.name} {c.lastName || ""}</div>
                    <div className="text-gray-500">{c.email || c.primaryPhone}</div>
                    {c.createdBy && <div className="text-xxs text-gray-400">Created by: {c.createdBy.name || c.createdBy.email}</div>}
                  </div>
                  <div>
                    <a href={`/dashboard/clients/${c._id}`} className="text-blue-600 text-xs hover:underline">Open</a>
                  </div>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    );
  }

  /* ------------------------
     Render main form
     ------------------------ */
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Left: Personal */}
        <div className="md:col-span-2 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="text-sm font-medium">First name</label>
              <input {...register("firstName")} className="mt-1 w-full p-2 border rounded" />
              {errors.firstName && <p className="text-xs text-red-600 mt-1">{errors.firstName.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium">Middle name</label>
              <input {...register("middleName")} className="mt-1 w-full p-2 border rounded" />
            </div>
            <div>
              <label className="text-sm font-medium">Last name</label>
              <input {...register("lastName")} className="mt-1 w-full p-2 border rounded" />
              {errors.lastName && <p className="text-xs text-red-600 mt-1">{errors.lastName.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="text-sm font-medium">Preferred name</label>
              <input {...register("preferredName")} className="mt-1 w-full p-2 border rounded" />
            </div>
            <div>
              <label className="text-sm font-medium">Date of birth</label>
              <input type="date" {...register("dateOfBirth")} className="mt-1 w-full p-2 border rounded" />
            </div>
            <div>
              <label className="text-sm font-medium">Gender</label>
              <select {...register("gender")} className="mt-1 w-full p-2 border rounded">
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="text-sm font-medium">ID number</label>
              <input {...register("idNumber")} className="mt-1 w-full p-2 border rounded" />
            </div>

            <div>
              <label className="text-sm font-medium">Email</label>
              <input {...register("email")} type="email" className="mt-1 w-full p-2 border rounded" />
            </div>

            <div>
              <label className="text-sm font-medium">Primary phone</label>
              <input {...register("primaryPhone")} className="mt-1 w-full p-2 border rounded" />
              {errors.primaryPhone && <p className="text-xs text-red-600 mt-1">{errors.primaryPhone.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="text-sm font-medium">Secondary phone</label>
              <input {...register("secondaryPhone")} className="mt-1 w-full p-2 border rounded" />
            </div>

            <div>
              <label className="text-sm font-medium">Company</label>
              <input {...register("company")} className="mt-1 w-full p-2 border rounded" />
            </div>

            <div>
              <label className="text-sm font-medium">Occupation</label>
              <input {...register("occupation")} className="mt-1 w-full p-2 border rounded" />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Address line 1</label>
            <input {...register("addressLine1")} className="mt-1 w-full p-2 border rounded" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="text-sm font-medium">City</label>
              <input {...register("city")} className="mt-1 w-full p-2 border rounded" />
            </div>
            <div>
              <label className="text-sm font-medium">State</label>
              <input {...register("state")} className="mt-1 w-full p-2 border rounded" />
            </div>
            <div>
              <label className="text-sm font-medium">Postal code</label>
              <input {...register("postalCode")} className="mt-1 w-full p-2 border rounded" />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Notes</label>
            <textarea {...register("notes")} rows={3} className="mt-1 w-full p-2 border rounded" />
          </div>

          <div>
            <label className="text-sm font-medium">Tags (comma separated)</label>
            <input {...register("tags")} className="mt-1 w-full p-2 border rounded" placeholder="vulnerable, referral" />
          </div>

          {/* Duplicate check */}
          <DuplicatePanel />

          {/* Intake Case toggle */}
          <div className="mt-3 p-3 border rounded">
            <div className="flex items-center gap-3">
              <Controller
                control={control}
                name="intakeCase_create"
                render={({ field }) => (
                  <input type="checkbox" {...field} checked={!!field.value} />
                )}
              />
              <span className="font-medium">Create intake case</span>
            </div>

            {intakeCaseCreate && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-sm font-medium">Case title</label>
                  <input {...register("intakeCase_title")} className="mt-1 w-full p-2 border rounded" />
                </div>
                <div>
                  <label className="text-sm font-medium">Category</label>
                  <select {...register("intakeCase_category")} className="mt-1 w-full p-2 border rounded">
                    {categories && categories.length > 0 ? (
                      categories.map((c) => <option key={c} value={c}>{c}</option>)
                    ) : (
                      <>
                        <option value="civil">Civil</option>
                        <option value="criminal">Criminal</option>
                        <option value="adr">ADR</option>
                        <option value="other">Other</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium">Priority</label>
                  <select {...register("intakeCase_priority")} className="mt-1 w-full p-2 border rounded">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium">Short description</label>
                  <input {...register("intakeCase_description")} className="mt-1 w-full p-2 border rounded" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right column: attachments, metadata, actions */}
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Source</label>
            <select {...register("source")} className="mt-1 w-full p-2 border rounded">
              <option value="">Select source</option>
              {Array.isArray(sources) && sources.map((s) => <option key={s} value={s}>{s}</option>)}
              <option value="phone">Phone</option>
              <option value="referral">Referral</option>
              <option value="walk-in">Walk-in</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">Attachments</label>
            <AttachmentsPanel />
            <p className="text-xs text-gray-500 mt-2">Allowed: pdf, doc, docx, images, csv, zip. Max per file depends on server.</p>
          </div>

          <div>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" {...register("consentGiven")} />
              <span className="text-sm">Client consent obtained for document upload</span>
            </label>
            {!consentGiven && uploadedFiles.length > 0 && (
              <p className="text-xs text-red-600 mt-1">Consent required to upload documents</p>
            )}
          </div>

          <div className="flex flex-col gap-2 mt-2">
            <button
              type="button"
              onClick={handleSubmit(onSaveDraft)}
              disabled={isSubmitting}
              className="px-4 py-2 bg-gray-200 rounded"
            >
              Save Draft
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 text-white rounded"
            >
              {isSubmitting ? "Submitting..." : "Submit Intake"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

IntakeForm.propTypes = {
  categories: PropTypes.array,
  sources: PropTypes.array,
  onSuccess: PropTypes.func,
};
