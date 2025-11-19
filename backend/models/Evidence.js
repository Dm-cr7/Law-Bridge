/**
 * backend/models/Evidence.js
 * ------------------------------------------------------------
 * Evidence Model — Secure, Auditable, and Case-Integrated
 * ------------------------------------------------------------
 * Supports:
 *   - File uploads (S3, GCP, Azure, Local)
 *   - Audit history with capped size
 *   - Verification workflow
 *   - Soft delete and restore operations
 *   - Linkage to both Cases and Arbitration proceedings
 * ------------------------------------------------------------
 */

import mongoose from "mongoose";
const { Schema } = mongoose;

/* =======================================================
   📘 Audit Subdocument
   ======================================================= */
const AuditSchema = new Schema(
  {
    action: {
      type: String,
      required: true, // e.g. "uploaded", "verified", "deleted"
    },
    by: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    at: {
      type: Date,
      default: Date.now,
    },
    meta: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { _id: false }
);

/* =======================================================
   🧾 Evidence Schema
   ======================================================= */
const EvidenceSchema = new Schema(
  {
    /* =======================================================
       📋 CORE INFO
       ======================================================= */
    title: {
      type: String,
      required: [true, "Evidence title is required"],
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },

    /* =======================================================
       🗂️ FILE DETAILS
       ======================================================= */
    storageProvider: {
      type: String,
      enum: ["local", "aws_s3", "gcp", "azure"],
      default: "local",
    },
    fileName: {
      type: String,
      required: true,
      trim: true,
    },
    fileType: {
      type: String,
      required: true,
      trim: true,
    },
    fileSize: {
      type: Number,
      required: true,
      min: 0,
    },
    fileKey: {
      type: String,
      required: true, // internal storage key/path
      trim: true,
    },
    fileUrl: {
      type: String,
      default: null, // public or signed URL
      trim: true,
    },

    /* =======================================================
       ⚖️ RELATIONSHIPS
       ======================================================= */
    case: {
      type: Schema.Types.ObjectId,
      ref: "Case",
      index: true,
      default: null,
    },
    arbitration: {
      type: Schema.Types.ObjectId,
      ref: "Arbitration",
      index: true,
      default: null,
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    /* =======================================================
       🔐 ACCESS CONTROL
       ======================================================= */
    accessLevel: {
      type: String,
      enum: ["private", "restricted", "public"],
      default: "private",
    },
    verified: {
      type: Boolean,
      default: false,
    },
    verifiedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },

    /* =======================================================
       🧾 AUDIT TRAIL
       ======================================================= */
    audit: {
      type: [AuditSchema],
      default: [],
    },

    /* =======================================================
       🗑️ SOFT DELETE
       ======================================================= */
    deleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },

    /* =======================================================
       🧩 METADATA
       ======================================================= */
    meta: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    versionKey: "__v", // ✅ fixes Mongoose optimisticConcurrency error
    optimisticConcurrency: true,
    toJSON: {
      virtuals: true,
      transform(doc, ret) {
        delete ret.fileKey;
        delete ret.deleted;
        delete ret.deletedAt;
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

/* =======================================================
   🔍 INDEXES
   ======================================================= */
EvidenceSchema.index({ case: 1, createdAt: -1 });
EvidenceSchema.index({ arbitration: 1, createdAt: -1 });
EvidenceSchema.index({ uploadedBy: 1, createdAt: -1 });
EvidenceSchema.index({ title: "text", description: "text" });

/* =======================================================
   🧠 VIRTUALS
   ======================================================= */
EvidenceSchema.virtual("isDeleted").get(function () {
  return !!this.deleted;
});

/* =======================================================
   ⚙️ INSTANCE METHODS
   ======================================================= */
EvidenceSchema.methods.addAudit = function (action, by, meta = {}) {
  this.audit.unshift({ action, by, meta, at: new Date() });
  if (this.audit.length > 50) this.audit = this.audit.slice(0, 50); // cap size
  return this;
};

EvidenceSchema.methods.verify = function (verifiedBy) {
  this.verified = true;
  this.verifiedBy = verifiedBy;
  this.verifiedAt = new Date();
  this.addAudit("verified", verifiedBy);
  return this;
};

EvidenceSchema.methods.softDelete = function (by = null) {
  this.deleted = true;
  this.deletedAt = new Date();
  this.addAudit("deleted", by);
  return this;
};

EvidenceSchema.methods.restore = function (by = null) {
  this.deleted = false;
  this.deletedAt = null;
  this.addAudit("restored", by);
  return this;
};

EvidenceSchema.methods.toPublicJSON = function () {
  const obj = this.toJSON();
  delete obj.fileKey;
  delete obj.deleted;
  delete obj.deletedAt;
  return obj;
};

/* =======================================================
   🧩 STATIC METHODS
   ======================================================= */
EvidenceSchema.statics.findByContext = function (
  contextId,
  type = "case",
  includeDeleted = false
) {
  const filter =
    type === "case"
      ? { case: contextId }
      : { arbitration: contextId };

  if (!includeDeleted) filter.deleted = false;
  return this.find(filter).sort({ createdAt: -1 }).exec();
};

EvidenceSchema.statics.paginate = async function ({
  filter = {},
  sort = { createdAt: -1 },
  page = 1,
  limit = 20,
}) {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    this.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    this.countDocuments(filter),
  ]);
  return {
    items,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  };
};

/* =======================================================
   🧼 PRE-SAVE HOOK
   ======================================================= */
EvidenceSchema.pre("save", function (next) {
  if (this.title) this.title = this.title.trim();
  if (this.description) this.description = this.description.trim();
  next();
});

/* =======================================================
   ✅ EXPORT MODEL
   ======================================================= */
const Evidence = mongoose.model("Evidence", EvidenceSchema);
export default Evidence;
