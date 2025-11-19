// backend/models/Arbitration.js
import mongoose from "mongoose";

const { Schema } = mongoose;

/**
 * Arbitration Schema
 *
 * Notes:
 *  - Uses optimisticConcurrency to reduce races on updates (mongoose >=5.7)
 *  - Stores minimal evidence references; metadata for evidence is in Evidence model
 *  - Award is embedded as a subdocument (decision text, amount, issuedBy, fileUrl)
 *  - Audit trail captures important actions; consider moving to separate collection if large
 *  - caseRef index is case-insensitive (collation strength 2)
 */

const AuditSchema = new Schema(
  {
    action: { type: String, required: true }, // e.g. "created", "evidence_uploaded", "award_issued"
    by: { type: Schema.Types.ObjectId, ref: "User" }, // user that performed the action
    at: { type: Date, default: Date.now },
    meta: { type: Schema.Types.Mixed }, // free-form metadata
  },
  { _id: false }
);

const AwardSchema = new Schema(
  {
    issued: { type: Boolean, default: false },
    decisionText: { type: String },
    awardAmount: { type: Number, default: null },
    effectiveDate: { type: Date, default: null },
    issuedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    issuedAt: { type: Date },
    fileUrl: { type: String, default: null }, // URL to award PDF (signed URL if using S3)
    fileKey: { type: String, default: null }, // storage key (optional)
  },
  { _id: false }
);

const ArbitrationSchema = new Schema(
  {
    caseRef: {
      type: String,
      required: [true, "Case reference is required"],
      trim: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      text: true,
    },
    parties: {
      // store as array of strings (identifiers or names) - can be expanded to objects
      type: [String],
      default: [],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: "At least one party is required",
      },
    },
    scheduledAt: { type: Date, default: null },
    durationMinutes: { type: Number, default: 60, min: 1 },
    locationOrUrl: {
      type: String,
      trim: true,
      default: null,
    },
    virtualRoomUrl: {
      type: String,
      trim: true,
      default: null,
    },
    notes: { type: String, trim: true, default: null },

    status: {
      type: String,
      enum: ["draft", "scheduled", "in_progress", "decided", "cancelled"],
      default: "draft",
      index: true,
    },

    // who is responsible / assigned arbitrator
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", index: true, default: null },

    // createdBy (user who created the arbitration record)
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

    // Evidence references: separate Evidence collection holds metadata and storage URL
    evidence: [{ type: Schema.Types.ObjectId, ref: "Evidence" }],

    // embedded award
    award: { type: AwardSchema, default: () => ({}) },

    // optional lightweight audit trail - array of recent actions
    audit: { type: [AuditSchema], default: [] },

    // soft-delete flag (we keep records for audit)
    deleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },

    // additional metadata flexible object
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    optimisticConcurrency: true, // enable versioning-based OCC
    versionKey: "version", // optional - name the version key explicitly
    toJSON: {
      virtuals: true,
      transform(doc, ret) {
        // remove internal fields from JSON
        delete ret.__v;
        // version is useful but hide internal deleted flag if false
        // if you prefer to keep version, comment out the next line
        // delete ret.version;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

/**
 * Indexes
 *
 * - caseRef unique per organization could be added if needed.
 * - Provide a case-insensitive unique index for caseRef if desired:
 *   ArbitrationSchema.index({ caseRef: 1 }, { unique: true, collation: { locale: 'en', strength: 2 }});
 *
 * We add a compound index on assignedTo + status for efficient listing.
 */
ArbitrationSchema.index({ assignedTo: 1, status: 1, scheduledAt: -1 });
ArbitrationSchema.index({ createdBy: 1, createdAt: -1 });

/**
 * Virtuals
 *
 * - durationHuman: friendly duration string
 */
ArbitrationSchema.virtual("durationHuman").get(function () {
  if (!this.durationMinutes) return null;
  const mins = this.durationMinutes;
  const hours = Math.floor(mins / 60);
  const remainder = mins % 60;
  if (hours > 0) return `${hours}h ${remainder}m`;
  return `${mins}m`;
});

/**
 * Instance Methods
 */

// Add an audit entry (keeps latest N entries optionally)
ArbitrationSchema.methods.addAudit = async function (action, by = null, meta = {}) {
  this.audit = this.audit || [];
  this.audit.unshift({ action, by, meta, at: new Date() });
  // Keep audit array trimmed to recent N (e.g., 50) to avoid document growth
  if (this.audit.length > 50) this.audit = this.audit.slice(0, 50);
  // do not save here to allow callers to batch updates; caller may call .save()
  return this;
};

// Attach evidence reference (push evidence ObjectId)
ArbitrationSchema.methods.addEvidenceRef = function (evidenceId, uploadedBy, meta = {}) {
  this.evidence = this.evidence || [];
  // avoid duplicates
  if (!this.evidence.find((id) => id.toString() === evidenceId.toString())) {
    this.evidence.push(evidenceId);
  }
  // record audit
  this.addAudit("evidence_added", uploadedBy, { evidenceId, ...meta });
  return this;
};

// Issue award (updates embedded award subdoc and audit)
ArbitrationSchema.methods.issueAward = function ({ decisionText, awardAmount = null, effectiveDate = null, issuedBy = null, fileUrl = null, fileKey = null }) {
  this.award = {
    issued: true,
    decisionText: decisionText || "",
    awardAmount: awardAmount !== undefined ? awardAmount : null,
    effectiveDate: effectiveDate || null,
    issuedBy: issuedBy || null,
    issuedAt: new Date(),
    fileUrl: fileUrl || null,
    fileKey: fileKey || null,
  };
  this.status = "decided";
  this.addAudit("award_issued", issuedBy, { awardAmount, effectiveDate, fileUrl });
  return this;
};

// Soft-delete helper
ArbitrationSchema.methods.softDelete = function (by = null) {
  this.deleted = true;
  this.deletedAt = new Date();
  this.addAudit("deleted", by, {});
  return this;
};

// Public-facing JSON that omits sensitive internal meta
ArbitrationSchema.methods.toPublicJSON = function () {
  const obj = this.toJSON ? this.toJSON() : this;
  // Remove internal flags
  delete obj.deleted;
  delete obj.deletedAt;
  // If storing fileKey for internal storage, do not expose it
  if (obj.award && obj.award.fileKey) delete obj.award.fileKey;
  return obj;
};

/**
 * Static helpers
 */

// simple paginator (cursor/page) — lightweight and does not depend on plugins
ArbitrationSchema.statics.paginate = async function ({ filter = {}, sort = { createdAt: -1 }, page = 1, limit = 25 }) {
  page = Math.max(1, parseInt(page, 10) || 1);
  limit = Math.max(1, parseInt(limit, 10) || 25);
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([this.find(filter).sort(sort).skip(skip).limit(limit).lean().exec(), this.countDocuments(filter)]);
  return { items, total, page, limit, pages: Math.ceil(total / limit) };
};

/**
 * Pre-save hooks
 */
ArbitrationSchema.pre("save", function (next) {
  // normalize caseRef to uppercase trimmed (optional)
  if (this.caseRef && typeof this.caseRef === "string") {
    this.caseRef = this.caseRef.trim();
  }
  next();
});

/**
 * Export model
 */
const Arbitration = mongoose.model("Arbitration", ArbitrationSchema);

export default Arbitration;
