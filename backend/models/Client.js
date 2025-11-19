// backend/models/Client.js
/**
 * Client Model — Production Ready
 * ------------------------------------------------------------
 * Represents a client managed by advocates, mediators, paralegals, or firm staff.
 *
 * Features added / preserved:
 * - Strong validation (email, phone, name)
 * - Soft-delete with deletedAt and pre-find filter (preserves existing behavior)
 * - History / audit helpers (addHistory, softDelete, restore)
 * - Useful static helpers (findByEmail, search, paginate)
 * - toPublicJSON / toJSON transform to strip internal fields
 * - Indexes tuned for search & access patterns
 *
 * ⚠️ Note: This file is self-contained. Don't change other models/controllers
 * unless you intentionally want to update shared behavior.
 */

import mongoose from "mongoose";

const { Schema } = mongoose;

const HistoryEntry = new Schema(
  {
    action: { type: String, required: true, trim: true },
    by: { type: Schema.Types.ObjectId, ref: "User" },
    timestamp: { type: Date, default: Date.now },
    notes: { type: String, trim: true, default: "" },
  },
  { _id: true }
);

const ClientSchema = new Schema(
  {
    /* ----------------- Basic Info ----------------- */
    name: {
      type: String,
      required: [true, "Client name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters long"],
    },

    email: {
      type: String,
      required: [true, "Client email is required"],
      lowercase: true,
      trim: true,
      match: [/.+@.+\..+/, "Please provide a valid email address"],
    },

    phone: {
      type: String,
      trim: true,
      match: [/^[+0-9\-\s()]{7,25}$/, "Invalid phone number format"],
      default: null,
    },

    address: {
      // Simple freeform address. Consider swapping to structured address object later.
      type: String,
      trim: true,
      maxlength: [300, "Address too long"],
      default: "",
    },

    company: {
      type: String,
      trim: true,
      maxlength: [200, "Company name too long"],
      default: "",
    },

    /* -------------- Intake / Case data ------------- */
    requiredService: {
      type: String,
      enum: ["advocate", "mediator", "arbitrator", "reconciliator", "other"],
      default: "advocate",
      index: true,
    },

    caseDescription: {
      type: String,
      trim: true,
      maxlength: [3000, "Case description too long"],
      default: "",
    },

    /* ----------------- Links ----------------- */
    createdBy: {
      // who performed the intake (paralegal / advocate / system)
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    user: {
      // optional associated User account representing the client
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    sharedWith: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
        index: true,
      },
    ],

    advocate: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    paralegal: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    mediator: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    arbitrator: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },

    cases: [
      {
        type: Schema.Types.ObjectId,
        ref: "Case",
      },
    ],

    /* ---------------- Other ------------------ */
    notes: {
      type: String,
      trim: true,
      maxlength: [2000, "Notes cannot exceed 2000 characters"],
      default: "",
    },

    status: {
      type: String,
      enum: ["active", "pending", "closed"],
      default: "active",
      index: true,
    },

    /* --------------- Soft delete & audit ------------- */
    deletedAt: { type: Date, default: null, index: true },

    history: {
      type: [HistoryEntry],
      default: [],
    },

    // attachments (optional) - store minimal descriptor; actual files in Upload model or as fileUrl
    attachments: [
      {
        name: { type: String },
        fileUrl: { type: String },
        fileKey: { type: String },
        fileType: { type: String },
        size: { type: Number },
        uploadedAt: { type: Date, default: Date.now },
        uploadedBy: { type: Schema.Types.ObjectId, ref: "User" },
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

/* =========================================================
   PRE / PLUGINS
   - Default filter to exclude soft-deleted unless includeDeleted query flag used
   - Normalize email to lowercase on save
========================================================= */
ClientSchema.pre(/^find/, function (next) {
  // if a query explicitly asks to includeDeleted (e.g., { includeDeleted: true }), allow it
  const q = this.getQuery();
  if (!q || !q.includeDeleted) {
    this.where({ deletedAt: null });
  } else {
    // remove includeDeleted flag so it doesn't interfere with query validation
    delete q.includeDeleted;
    this.setQuery(q);
  }
  next();
});

ClientSchema.pre("save", function (next) {
  if (this.email) this.email = String(this.email).toLowerCase().trim();
  if (this.name) this.name = String(this.name).trim();
  next();
});

/* =========================================================
   VIRTUALS
========================================================= */
ClientSchema.virtual("displayName").get(function () {
  return this.name;
});

/* =========================================================
   TRANSFORM (toJSON)
   - remove internal fields that controllers don't need
========================================================= */
ClientSchema.set("toJSON", {
  transform(doc, ret) {
    // remove internal fields
    delete ret.__v;
    // keep deletedAt for audits but hide it by default from typical API responses:
    if (!doc.deletedAt) delete ret.deletedAt;
    return ret;
  },
});

/* =========================================================
   INSTANCE METHODS
========================================================= */
ClientSchema.methods.addHistory = async function (action, userId = null, notes = "") {
  this.history = this.history || [];
  this.history.push({ action, by: userId, notes, timestamp: new Date() });
  // do not always save here if caller wants to batch — but keep behavior convenient
  await this.save();
  return this;
};

ClientSchema.methods.softDelete = async function (userId = null) {
  this.deletedAt = new Date();
  await this.addHistory("Client Deleted", userId, "");
  return this;
};

ClientSchema.methods.restore = async function (userId = null) {
  this.deletedAt = null;
  await this.addHistory("Client Restored", userId, "");
  return this;
};

ClientSchema.methods.attachFile = async function (fileObj, userId = null) {
  // fileObj: { name, fileUrl, fileKey, fileType, size }
  this.attachments = this.attachments || [];
  this.attachments.push({
    name: fileObj.name,
    fileUrl: fileObj.fileUrl,
    fileKey: fileObj.fileKey,
    fileType: fileObj.fileType,
    size: fileObj.size,
    uploadedAt: new Date(),
    uploadedBy: userId,
  });
  await this.addHistory("Attachment Added", userId, fileObj.name || "");
  return this;
};

/* =========================================================
   STATIC HELPERS
========================================================= */
ClientSchema.statics.findByEmail = async function (email, includeDeleted = false) {
  if (!email) return null;
  const q = { email: String(email).toLowerCase().trim() };
  if (!includeDeleted) q.deletedAt = null;
  return this.findOne(q);
};

ClientSchema.statics.search = async function (q, { limit = 10, page = 1 } = {}) {
  // Flexible search across name / email / phone
  if (!q || String(q).trim() === "") return { items: [], total: 0, page, limit };

  const term = String(q).trim();
  const filter = {
    $and: [{ deletedAt: null }],
    $or: [
      { name: { $regex: term, $options: "i" } },
      { email: { $regex: term, $options: "i" } },
      { phone: { $regex: term, $options: "i" } },
    ],
  };

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    this.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    this.countDocuments(filter),
  ]);

  return { items, total, page, limit };
};

ClientSchema.statics.paginateForUser = async function (userId, { page = 1, limit = 25 } = {}) {
  // returns clients created by or shared with the user
  const skip = (page - 1) * limit;
  const filter = {
    deletedAt: null,
    $or: [{ createdBy: userId }, { sharedWith: userId }],
  };
  const [items, total] = await Promise.all([
    this.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("createdBy", "name email role")
      .populate("advocate", "name email")
      .populate("paralegal", "name email"),
    this.countDocuments(filter),
  ]);

  return { items, total, page, limit };
};

/* =========================================================
   INDEXES
========================================================= */
ClientSchema.index({ email: 1 }, { unique: false }); // don't force unique across soft deletes; uniqueness handled on app logic if needed
ClientSchema.index({ createdBy: 1 });
ClientSchema.index({ sharedWith: 1 });
ClientSchema.index({ deletedAt: 1 });
ClientSchema.index({ name: "text", email: "text", phone: "text" });

/* =========================================================
   EXPORT
========================================================= */
const Client = mongoose.model("Client", ClientSchema);
export default Client;
