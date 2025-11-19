// backend/models/Reconciliation.js
import mongoose from "mongoose";

const { Schema, model, Types } = mongoose;

/**
 * Reconciliation / Meeting Schema
 *
 * - Flexible participants: can be ObjectId (User) or lightweight contact { name, email, type, ref }
 * - Soft deletion support
 * - Utility methods for softDelete/restore/addNote/toPublicJSON
 * - Default export for consistent imports across controllers
 */

const ParticipantSchema = new Schema(
  {
    // If linked to a User record
    user: { type: Types.ObjectId, ref: "User", default: null },

    // Fallback contact info (use when not linked)
    name: { type: String, trim: true, default: "" },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
      validate: {
        validator: (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
        message: "Invalid email",
      },
    },

    // Role or relationship: reconciliator, client, respondent, advocate, etc.
    role: { type: String, trim: true, default: "participant" },

    // Optional free-form reference (case id, client id, external id)
    ref: { type: Schema.Types.Mixed, default: null },
  },
  { _id: false }
);

const reconciliationSchema = new Schema(
  {
    title: {
      type: String,
      required: [true, "Meeting title is required"],
      trim: true,
      maxlength: 300,
    },

    participants: {
      type: [ParticipantSchema],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: "At least one participant is required",
      },
      default: [],
    },

    scheduledAt: {
      type: Date,
      required: [true, "Scheduled date and time are required"],
      index: true,
    },

    durationMinutes: {
      type: Number,
      default: 30,
      min: [1, "Duration must be at least 1 minute"],
    },

    mode: {
      type: String,
      enum: ["virtual", "in-person", "hybrid"],
      default: "virtual",
    },

    linkOrLocation: {
      type: String,
      trim: true,
      default: "",
    },

    notes: {
      type: String,
      trim: true,
      default: "",
    },

    status: {
      type: String,
      enum: ["scheduled", "open", "closed", "cancelled"],
      default: "scheduled",
      index: true,
    },

    result: {
      type: String,
      trim: true,
      default: null,
    },

    // Relationships
    createdBy: { type: Types.ObjectId, ref: "User", required: true, index: true },
    reconciliator: { type: Types.ObjectId, ref: "User", default: null, index: true },
    caseRef: { type: Types.ObjectId, ref: "Case", default: null, index: true },

    // Soft delete
    deletedAt: { type: Date, default: null },

    // Lightweight history/audit for quick UI use
    history: [
      {
        ts: { type: Date, default: Date.now },
        by: { type: Types.ObjectId, ref: "User", default: null },
        action: { type: String, trim: true },
        note: { type: String, trim: true },
      },
    ],
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/* ---------- Indexes ---------- */
reconciliationSchema.index({ title: "text", notes: "text" }, { name: "recon_text_idx" });
reconciliationSchema.index({ scheduledAt: 1 });
reconciliationSchema.index({ createdBy: 1 });
reconciliationSchema.index({ reconciliator: 1 });

/* ---------- Virtuals ---------- */

// isUpcoming: scheduled in future and not closed/cancelled
reconciliationSchema.virtual("isUpcoming").get(function () {
  if (!this.scheduledAt) return false;
  return !this.deletedAt && (this.status === "scheduled" || this.status === "open") && this.scheduledAt > new Date();
});

// duration in milliseconds
reconciliationSchema.virtual("durationMs").get(function () {
  return (this.durationMinutes || 0) * 60 * 1000;
});

/* ---------- Static Methods ---------- */

/**
 * Soft-delete by id
 * returns the updated document
 */
reconciliationSchema.statics.softDelete = async function (id, byUser = null) {
  const doc = await this.findByIdAndUpdate(id, { deletedAt: new Date() }, { new: true });
  if (doc && byUser) {
    doc.history = doc.history || [];
    doc.history.push({ by: byUser, action: "soft_delete", note: "Soft deleted" });
    await doc.save();
  }
  return doc;
};

/**
 * Restore soft-deleted doc
 */
reconciliationSchema.statics.restore = async function (id, byUser = null) {
  const doc = await this.findByIdAndUpdate(id, { deletedAt: null }, { new: true });
  if (doc && byUser) {
    doc.history = doc.history || [];
    doc.history.push({ by: byUser, action: "restore", note: "Restored" });
    await doc.save();
  }
  return doc;
};

/* ---------- Instance Methods ---------- */

/**
 * Soft-delete instance
 */
reconciliationSchema.methods.softDelete = async function (byUser = null) {
  this.deletedAt = new Date();
  this.history = this.history || [];
  this.history.push({ by: byUser, action: "soft_delete", note: "Soft deleted" });
  await this.save();
  return this;
};

/**
 * Restore instance
 */
reconciliationSchema.methods.restore = async function (byUser = null) {
  this.deletedAt = null;
  this.history = this.history || [];
  this.history.push({ by: byUser, action: "restore", note: "Restored" });
  await this.save();
  return this;
};

/**
 * Add a history entry / note
 */
reconciliationSchema.methods.addNote = async function (byUser, action = "note", note = "") {
  this.history = this.history || [];
  this.history.push({ by: byUser || null, action, note: note || "" });
  await this.save();
  return this;
};

/**
 * Public-safe JSON for APIs (hides deletedAt, internal history objects if desired)
 */
reconciliationSchema.methods.toPublicJSON = function () {
  const obj = this.toObject({ virtuals: true });
  // hide internal fields
  delete obj.__v;
  // Keep history but limit large fields
  if (Array.isArray(obj.history)) {
    obj.history = obj.history
      .slice(-20) // last 20 entries
      .map((h) => ({ ts: h.ts, by: h.by, action: h.action, note: h.note }));
  }
  return obj;
};

/* ---------- Pre / Post hooks ---------- */

// Ensure scheduledAt is a valid Date object
reconciliationSchema.pre("save", function (next) {
  if (this.scheduledAt && !(this.scheduledAt instanceof Date)) {
    this.scheduledAt = new Date(this.scheduledAt);
  }
  next();
});

// Keep status consistent: if cancelled → set deletedAt
reconciliationSchema.pre("save", function (next) {
  if (this.status === "cancelled" && !this.deletedAt) {
    this.deletedAt = new Date();
  }
  next();
});

/* ---------- Export ---------- */
const Reconciliation = model("Reconciliation", reconciliationSchema);
export default Reconciliation;
