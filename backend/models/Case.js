// backend/models/Case.js
import mongoose from "mongoose";
import path from "path";

/**
 * Case Model — Production Ready
 * ------------------------------------------------------------
 * - Atomic caseNumber generation (counters collection) to avoid races
 * - Pre-validate hook ensures required fields are present before validation
 * - Metrics maintained automatically
 * - Soft-delete & restore with audit trail
 * - Utility: toPublicJSON() for safe API output
 * ------------------------------------------------------------
 */

const { Schema } = mongoose;

/* ------------------------------------------------------------------
   COUNTER SCHEMA (for atomic sequential numbers)
   ------------------------------------------------------------------ */
const CounterSchema = new Schema(
  {
    _id: { type: String, required: true }, // e.g., 'case'
    seq: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false }
);

const Counter = mongoose.models.Counter || mongoose.model("Counter", CounterSchema);

/* ===========================================================
   SUB-SCHEMAS (unchanged semantics, compact)
   =========================================================== */
const HearingSchema = new Schema(
  {
    date: { type: Date, required: true, index: true },
    title: { type: String, trim: true },
    description: { type: String, trim: true },
    outcome: { type: String, trim: true },
    addedBy: { type: Schema.Types.ObjectId, ref: "User" },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const AttachmentSchema = new Schema(
  {
    name: { type: String, trim: true },
    fileUrl: { type: String, trim: true },
    fileType: { type: String, trim: true },
    size: { type: Number },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User" },
    uploadedAt: { type: Date, default: Date.now },
    tags: [{ type: String }],
  },
  { _id: true }
);

const NoteSchema = new Schema(
  {
    content: { type: String, trim: true, required: true },
    visibility: {
      type: String,
      enum: ["private", "shared", "public"],
      default: "private",
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    createdAt: { type: Date, default: Date.now },
    editedAt: { type: Date },
  },
  { _id: true }
);

const HistoryEntrySchema = new Schema(
  {
    action: { type: String, trim: true, required: true },
    performedBy: { type: Schema.Types.ObjectId, ref: "User" },
    timestamp: { type: Date, default: Date.now },
    note: { type: String, trim: true },
    meta: { type: Schema.Types.Mixed },
  },
  { _id: true }
);

const TeamMemberSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: {
      type: String,
      enum: ["assistant", "paralegal", "co-counsel", "reviewer", "other"],
      default: "assistant",
    },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const SharedLogSchema = new Schema(
  {
    sharedWith: { type: Schema.Types.ObjectId, ref: "User", required: true },
    sharedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    sharedAt: { type: Date, default: Date.now },
    permission: { type: String, enum: ["view", "comment", "edit"], default: "view" },
  },
  { _id: true }
);

/* ===========================================================
   MAIN CASE SCHEMA
   =========================================================== */
const caseSchema = new Schema(
  {
    // Core identification
    caseNumber: { type: String, unique: true, required: true, trim: true, index: true },
    title: { type: String, required: [true, "Case title is required"], trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 10000 },

    // Ownership & Access
    filedBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", index: true },
    sharedWith: [{ type: Schema.Types.ObjectId, ref: "User", index: true }],
    participants: [{ type: Schema.Types.ObjectId, ref: "User", index: true }],

    // Parties
    client: { type: Schema.Types.ObjectId, ref: "User", index: true },
    respondent: { type: Schema.Types.ObjectId, ref: "User", index: true },

    // ADR / outcomes
    arbitration: { type: Schema.Types.ObjectId, ref: "Arbitration" },
    award: { type: Schema.Types.ObjectId, ref: "Award" },

    // Category, status, priority
    category: { type: String, enum: ["civil", "criminal", "adr", "other"], default: "civil", index: true },
    status: {
      type: String,
      enum: [
        "draft",
        "filed",
        "under_review",
        "accepted",
        "hearing_scheduled",
        "hearing_in_progress",
        "award_issued",
        "resolved",
        "closed",
        "rejected",
        "archived",
      ],
      default: "draft",
      index: true,
    },
    priority: { type: String, enum: ["low", "medium", "high", "urgent"], default: "medium", index: true },

    // Dates
    filedAt: { type: Date },
    acceptedAt: { type: Date },
    closedAt: { type: Date },

    // Hearings
    hearingDate: { type: Date }, // legacy
    hearings: [HearingSchema],

    // Attachments & evidence
    attachments: [AttachmentSchema],
    evidence: [{ type: Schema.Types.ObjectId, ref: "Evidence" }],

    // Notes & history
    notes: [NoteSchema],
    history: [HistoryEntrySchema],

    // Team & sharing
    team: [TeamMemberSchema],
    sharedLogs: [SharedLogSchema],

    // Metadata
    court: { type: String, trim: true, index: true },
    jurisdiction: { type: String, trim: true, index: true },

    // Analytics metrics
    metrics: {
      totalDocuments: { type: Number, default: 0 },
      totalNotes: { type: Number, default: 0 },
      lastActivityAt: { type: Date },
      durationDays: { type: Number, default: 0 },
    },

    // Snapshot of last event
    lastEvent: {
      action: { type: String },
      message: { type: String },
      timestamp: { type: Date },
      by: { type: Schema.Types.ObjectId, ref: "User" },
    },

    // Soft-delete & audit
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    deletedAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/* ===========================================================
   INDEXES
   =========================================================== */
caseSchema.index({ title: "text", description: "text" });
caseSchema.index({ filedBy: 1, status: 1 });
caseSchema.index({ client: 1, respondent: 1 });
caseSchema.index({ category: 1, priority: 1 });
caseSchema.index({ createdAt: -1 });

/* ===========================================================
   TRANSFORMERS & HELPERS
   =========================================================== */
caseSchema.set("toJSON", {
  transform(doc, ret) {
    delete ret.__v;
    return ret;
  },
});

/**
 * toPublicJSON
 * returns a slim, safe representation for API responses
 */
caseSchema.methods.toPublicJSON = function () {
  const obj = this.toObject({ virtuals: true });
  // hide internal flags
  delete obj.isDeleted;
  delete obj.deletedAt;
  return obj;
};

/* ===========================================================
   HELPERS: atomic counter for case numbers
   =========================================================== */
async function getNextCaseSequence() {
  // Uses the Counter collection with id 'case' to atomically increment
  const counter = await Counter.findOneAndUpdate(
    { _id: "case" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).exec();
  return counter.seq;
}

/* ===========================================================
   PRE-VALIDATE HOOKS (generate caseNumber before validation)
   =========================================================== */
caseSchema.pre("validate", async function (next) {
  try {
    // ensure metrics object exists
    this.metrics = this.metrics || {};

    // Generate caseNumber only when missing
    if (!this.caseNumber) {
      // Prefer patterned case number with advocate suffix when we have filedBy
      if (this.filedBy) {
        // Try to allocate a sequence number atomically
        const seq = await getNextCaseSequence(); // integer
        // Build: ADV-<last4ofUser>-<YYYYMMDD>-<seq padded>
        const advocateIdSuffix = this.filedBy.toString().slice(-4).toUpperCase();
        const d = new Date();
        const y = d.getFullYear();
        const mm = (`0${d.getMonth() + 1}`).slice(-2);
        const dd = (`0${d.getDate()}`).slice(-2);
        const datePart = `${y}${mm}${dd}`;
        const seqPart = `${seq}`.padStart(6, "0"); // zero-pad to 6 digits
        this.caseNumber = `ADV-${advocateIdSuffix}-${datePart}-${seqPart}`;
      } else {
        // Fallback: timestamp + random
        const now = Date.now().toString(36).toUpperCase();
        const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
        this.caseNumber = `CASE-${now}-${rand}`;
      }
    }

    // Default filedAt when status is 'filed' or filedAt missing
    if (!this.filedAt && this.status === "filed") {
      this.filedAt = new Date();
    }

    // Metrics: simple derivations
    this.metrics.totalDocuments = (this.attachments || []).length || 0;
    this.metrics.totalNotes = (this.notes || []).length || 0;
    this.metrics.lastActivityAt = new Date();

    // durationDays if closedAt & filedAt exist
    if (this.closedAt && this.filedAt) {
      const ms = Math.abs(new Date(this.closedAt) - new Date(this.filedAt));
      this.metrics.durationDays = Math.ceil(ms / (1000 * 60 * 60 * 24));
    }

    next();
  } catch (err) {
    next(err);
  }
});

/* ===========================================================
   INSTANCE METHODS (preserve and harden)
   =========================================================== */
caseSchema.methods.addHistory = async function (action, userId = null, note = "", meta = {}) {
  this.history = this.history || [];
  this.history.push({ action, performedBy: userId, note, meta, timestamp: new Date() });
  this.lastEvent = { action, message: note, timestamp: new Date(), by: userId };
  this.metrics = this.metrics || {};
  this.metrics.lastActivityAt = new Date();
  return this.save();
};

caseSchema.methods.addNote = async function (content, userId, visibility = "private") {
  if (!content || !userId) throw new Error("Note content and user required");
  this.notes = this.notes || [];
  this.notes.push({ content, createdBy: userId, visibility, createdAt: new Date() });
  await this.addHistory("Note Added", userId, content);
  return this;
};

caseSchema.methods.addAttachment = async function (fileObj, userId) {
  this.attachments = this.attachments || [];
  const attachment = {
    name: fileObj.name || "document",
    fileUrl: fileObj.fileUrl,
    fileType: fileObj.fileType,
    size: fileObj.size,
    uploadedBy: userId,
    uploadedAt: new Date(),
    tags: fileObj.tags || [],
  };
  this.attachments.push(attachment);
  await this.addHistory("File Uploaded", userId, fileObj.name || "document", { fileUrl: fileObj.fileUrl });
  // update metrics without forcing full save outside addHistory
  this.metrics = this.metrics || {};
  this.metrics.totalDocuments = (this.attachments || []).length;
  this.metrics.lastActivityAt = new Date();
  await this.save();
  return this;
};

caseSchema.methods.addHearing = async function (hearingObj, userId) {
  this.hearings = this.hearings || [];
  const h = {
    date: hearingObj.date,
    title: hearingObj.title,
    description: hearingObj.description,
    outcome: hearingObj.outcome,
    addedBy: userId,
    createdAt: new Date(),
  };
  this.hearings.push(h);
  this.hearingDate = h.date;
  await this.addHistory("Hearing Added", userId, `${hearingObj.title || ""}`.trim());
  return this;
};

caseSchema.methods.shareWith = async function (userIdToShare, sharedById, permission = "view") {
  this.sharedWith = this.sharedWith || [];
  if (!this.sharedWith.find((id) => id.toString() === userIdToShare.toString())) {
    this.sharedWith.push(userIdToShare);
  }
  this.sharedLogs = this.sharedLogs || [];
  this.sharedLogs.push({ sharedWith: userIdToShare, sharedBy: sharedById, sharedAt: new Date(), permission });
  await this.addHistory("Case Shared", sharedById, `Shared with ${userIdToShare}`, { permission });
  return this;
};

caseSchema.methods.addParticipant = async function (userId, addedBy = null) {
  this.participants = this.participants || [];
  if (!this.participants.find((p) => p.toString() === userId.toString())) {
    this.participants.push(userId);
    await this.addHistory("Participant Added", addedBy, `Added participant ${userId}`);
  }
  return this;
};

caseSchema.methods.removeParticipant = async function (userId, removedBy = null) {
  this.participants = (this.participants || []).filter((p) => p.toString() !== userId.toString());
  await this.addHistory("Participant Removed", removedBy, `Removed participant ${userId}`);
  return this;
};

caseSchema.methods.softDelete = async function (userId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  await this.addHistory("Soft Deleted", userId);
  return this;
};

caseSchema.methods.restore = async function (userId) {
  this.isDeleted = false;
  this.deletedAt = null;
  await this.addHistory("Restored", userId);
  return this;
};

/* ===========================================================
   STATIC HELPERS
   =========================================================== */
caseSchema.statics.findActive = function (userId, includeShared = true) {
  const accessCriteria = includeShared
    ? [
        { filedBy: userId },
        { createdBy: userId },
        { assignedTo: userId },
        { sharedWith: userId },
        { participants: userId },
        { "team.user": userId },
      ]
    : [{ filedBy: userId }];

  return this.find({ isDeleted: false, $or: accessCriteria })
    .populate([
      { path: "filedBy", select: "name email role" },
      { path: "sharedWith", select: "name email role" },
      { path: "client", select: "name email" },
      { path: "respondent", select: "name email" },
      { path: "assignedTo", select: "name email" },
      { path: "team.user", select: "name email role" },
    ])
    .sort({ createdAt: -1 });
};

caseSchema.statics.findByAccess = function (userId, caseId) {
  return this.findOne({
    _id: caseId,
    isDeleted: false,
    $or: [
      { filedBy: userId },
      { createdBy: userId },
      { assignedTo: userId },
      { sharedWith: userId },
      { participants: userId },
      { "team.user": userId },
    ],
  }).populate([
    { path: "filedBy", select: "name email role" },
    { path: "sharedWith", select: "name email role" },
    { path: "client", select: "name email" },
    { path: "respondent", select: "name email" },
    { path: "attachments.uploadedBy", select: "name email" },
    { path: "notes.createdBy", select: "name email" },
    { path: "history.performedBy", select: "name email" },
    { path: "team.user", select: "name email role" },
  ]);
};

/* ===========================================================
   EXPORT
   =========================================================== */
const Case = mongoose.models.Case || mongoose.model("Case", caseSchema);
export default Case;
