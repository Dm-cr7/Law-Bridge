// frontend/src/pages/ClientsNewClientModal.jsx
import React, { useEffect } from "react";
import PropTypes from "prop-types";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { X, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import API from "@/utils/api";
import { socket } from "@/utils/socket";

/**
 * NewClientModal
 *
 * - Validates input with Zod
 * - POST /api/clients via shared API instance
 * - Handles 409 Conflict (duplicate) specially
 * - Emits socket event on success and calls onClientCreated(client)
 */

/* ---------------------------
   Validation schema (zod)
   --------------------------- */
const newClientSchema = z.object({
  name: z.string().min(2, "Full name is required"),
  email: z.string().email("Enter a valid email address"),
  phone: z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" ? undefined : v))
    .refine((v) => (v === undefined ? true : /^\+?\d{7,15}$/.test(v)), {
      message: "Enter a valid phone number (digits, optionally leading +)",
    }),
  address: z.string().max(150, "Address too long").optional().or(z.literal("")),
  company: z.string().max(100, "Company name too long").optional().or(z.literal("")),
  requiredService: z.enum(
    ["advocate", "mediator", "arbitrator", "reconciliator", "other"],
    { required_error: "Please select a required service" }
  ),
  caseDescription: z
    .string()
    .min(10, "Case description must be at least 10 characters")
    .max(1000, "Case description too long"),
  notes: z.string().max(300, "Notes too long").optional().or(z.literal("")),
});

/* ---------------------------
   Small UI helpers
   --------------------------- */
function ModalWrapper({ children, title, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="p-2 rounded hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function FormField({ label, children, error }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      {children}
      {error && <p className="text-xs text-red-600 mt-1">{error.message || error}</p>}
    </div>
  );
}

/* ---------------------------
   Normalize API response helper
   - Many backends return different shapes (data/client etc.)
   --------------------------- */
function extractClientFromResponse(res) {
  if (!res) return null;
  const payload = res?.data ?? res;
  if (!payload) return null;
  if (payload.client) return payload.client;
  // if API returned the client object itself
  if (payload._id || payload.id) return payload;
  // sometimes APIs wrap in { data: { ... } }
  if (payload.data && (payload.data._id || payload.data.id)) return payload.data;
  return null;
}

/* ---------------------------
   Component
   --------------------------- */
export default function NewClientModal({ isOpen, onClose, onClientCreated }) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(newClientSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      address: "",
      company: "",
      requiredService: "advocate",
      caseDescription: "",
      notes: "",
    },
  });

  // reset when opening/closing
  useEffect(() => {
    if (!isOpen) reset();
  }, [isOpen, reset]);

  if (!isOpen) return null;

  const onSubmit = async (values) => {
    // values validated by zod resolver
    try {
      // POST to /api/clients using shared API instance
      const res = await API.post("/clients", values);
      const client = extractClientFromResponse(res) || (res?.data ?? res);

      // toast — include createdBy if provided
      const createdByName = client?.createdBy?.name || client?.createdBy?.email;
      toast.success(
        <>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span>
              Client <strong>{client.name || client.firstName || "(unnamed)"}</strong> created
            </span>
          </div>
          {createdByName && (
            <div className="text-xs text-slate-700 mt-1">Intaked by: {createdByName}</div>
          )}
        </>
      );

      // emit socket for realtime (server should also emit; this is optimistic)
      try {
        if (socket?.connected) socket.emit("client:created", client);
      } catch (sErr) {
        // non-fatal
        console.warn("Socket emit failed (non-fatal)", sErr);
      }

      onClientCreated?.(client);
      reset();
      onClose();
    } catch (err) {
      // Better error handling: 409 Conflict (duplicate), 422 validation, others
      console.error("❌ Create client error:", err);

      const status = err?.response?.status;
      const serverMessage =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        (typeof err?.response?.data === "string" ? err.response.data : null);

      if (status === 409) {
        // Conflict — likely duplicate
        toast.error(serverMessage || "A client with this email/phone already exists.");
        // Optionally show a suggestion to open existing client — backend can return existing client id
        const existingId = err?.response?.data?.existingClientId || err?.response?.data?.client?._id;
        if (existingId) {
          // present a small call-to-action toast to open that client
          toast(
            <div className="flex flex-col">
              <div className="text-sm">{serverMessage || "Duplicate client detected."}</div>
              <div className="mt-2 flex gap-2">
                <button
                  className="px-3 py-1 text-xs bg-blue-600 text-white rounded"
                  onClick={() => {
                    window.location.href = `/dashboard/clients/${existingId}`;
                  }}
                >
                  Open existing
                </button>
              </div>
            </div>
          );
        }
        return;
      }

      if (status === 422 || status === 400) {
        // validation errors — backend might return field errors object
        const fieldErrors = err?.response?.data?.errors;
        const message = serverMessage || "Validation failed";
        toast.error(message);
        return;
      }

      // Generic fallback
      toast.error(serverMessage || "Failed to create client. Try again.");
    }
  };

  return (
    <ModalWrapper title="Create New Client" onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField label="Full Name" error={errors.name}>
          <input
            {...register("name")}
            type="text"
            placeholder="Jane Doe"
            className="mt-1 w-full rounded-md border p-2 focus:ring-2 focus:ring-blue-500"
          />
        </FormField>

        <FormField label="Email" error={errors.email}>
          <input
            {...register("email")}
            type="email"
            placeholder="client@example.com"
            className="mt-1 w-full rounded-md border p-2 focus:ring-2 focus:ring-blue-500"
          />
        </FormField>

        <FormField label="Phone" error={errors.phone}>
          <input
            {...register("phone")}
            type="tel"
            placeholder="+254712345678"
            className="mt-1 w-full rounded-md border p-2 focus:ring-2 focus:ring-blue-500"
          />
        </FormField>

        <FormField label="Address" error={errors.address}>
          <input
            {...register("address")}
            type="text"
            placeholder="Nairobi, Kenya"
            className="mt-1 w-full rounded-md border p-2 focus:ring-2 focus:ring-blue-500"
          />
        </FormField>

        <FormField label="Company (optional)" error={errors.company}>
          <input
            {...register("company")}
            type="text"
            placeholder="Company or organization"
            className="mt-1 w-full rounded-md border p-2 focus:ring-2 focus:ring-blue-500"
          />
        </FormField>

        <div>
          <label className="block text-sm font-medium mb-1">Required Service</label>
          <select
            {...register("requiredService")}
            className="mt-1 w-full rounded-md border p-2 focus:ring-2 focus:ring-blue-500"
          >
            <option value="advocate">Advocate</option>
            <option value="mediator">Mediator</option>
            <option value="arbitrator">Arbitrator</option>
            <option value="reconciliator">Reconciliator</option>
            <option value="other">Other</option>
          </select>
          {errors.requiredService && <p className="text-xs text-red-600 mt-1">{errors.requiredService.message}</p>}
        </div>

        <FormField label="Case Description" error={errors.caseDescription}>
          <textarea
            {...register("caseDescription")}
            rows={3}
            placeholder="Briefly describe the case..."
            className="mt-1 w-full rounded-md border p-2 focus:ring-2 focus:ring-blue-500"
          />
        </FormField>

        <FormField label="Notes (optional)" error={errors.notes}>
          <textarea
            {...register("notes")}
            rows={2}
            placeholder="Internal notes..."
            className="mt-1 w-full rounded-md border p-2 focus:ring-2 focus:ring-blue-500"
          />
        </FormField>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-md bg-gray-100">
            Cancel
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 rounded-md bg-blue-600 text-white flex items-center gap-2"
          >
            {isSubmitting ? <Loader2 className="animate-spin w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            {isSubmitting ? "Creating..." : "Create Client"}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
}

NewClientModal.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func,
  onClientCreated: PropTypes.func,
};
