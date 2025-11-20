// backend/models/Hearing.js
import mongoose from "mongoose";

/**
 * Hearing Model
 * ------------------------------------------------------------
 * Represents scheduled hearing sessions for arbitration/court cases.
 *
 * Features added:
 *  - recurrence support (freq, interval, count)
 *  - reminder scheduling metadata
 *  - text index for title/description for quick search
 *  - instance helpers: addNote, softDelete, restore, toPublicJSON
 *  - static helpers: findUpcoming, findByCase
 *  - virtuals: isUpcoming
 *  - robust toJSON transform
 */

const { Schema } = mongoose;

const ParticipantGroups = {
  advocates: [{ type: Schema.Types.ObjectId, ref: "User" }],
  arbitrators: [{ type: Schema.Types.ObjectId, ref: "User" }],
  clients: [{ type: Schema.Types.ObjectId, ref: "User" }],
  respondents: [{ type: Schema.Types.ObjectId, ref: "User" }],
};

const NoteSchema = new Schema(
  {
    content: { type: String, trim: true, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const HearingSchema = new Schema(
  {
    case: { type: Schema.Types.ObjectId, ref: "Case", required: true, index: true },

    title: { type: String, required: [true, "Hearing title is required"], trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000, default: "" },

    // timeline
    start: { type: Date, required: true, index: true },
    end: { type: Date },

    // location / remote meeting
    venue: { type: String, trim: true, default: "To be determined" },
    meetingLink: { type: String, trim: true, default: null },

    // status
    status: {
      type: String,
      enum: ["draft", "scheduled", "in_progress", "adjourned", "completed", "cancelled"],
      default: "scheduled",
      index: true,
    },

    // participants grouped by role
    participants: {
      type: new Schema(ParticipantGroups, { _id: false }),
      default: {},
    },

    // attach notes
    notes: { type: [NoteSchema], default: [] },

    // recurrence (basic)
    recurrence: {
      freq: { type: String, enum: ["none", "daily", "weekly", "monthly"], default: "none" },
      interval: { type: Number, default: 1, min: 1 },
      count: { type: Number }, // number of occurrences (optional)
    },

    // reminder metadata — scheduling of reminder worker happens outside model
    reminder: {
      enabled: { type: Boolean, default: false },
      minutesBefore: { type: Number, default: 30 },
      nextReminderAt: { type: Date, default: null }, // computed by server worker when scheduling
    },

    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },

    // soft delete
    deletedAt: { type: Date, default: null },

    arbitration: { type: Schema.Types.ObjectId, ref: "Arbitration", default: null },

    meta: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    versionKey: false,
  }
);

/* -------------------- Indexes -------------------- */
// text index for search across title + description (if enabled in app)
HearingSchema.index({ title: "text", description: "text" });
HearingSchema.index({ start: 1 });
HearingSchema.index({ case: 1 });

/* -------------------- Virtuals -------------------- */
HearingSchema.virtual("isUpcoming").get(function () {
  try {
    if (!this.start) return false;
    return new Date(this.start) > new Date() && this.status === "scheduled" && !this.deletedAt;
  } catch {
    return false;
  }
});

/* -------------------- toJSON transform -------------------- */
HearingSchema.set("toJSON", {
  transform(doc, ret) {
    // remove internals
    delete ret.__v;
    if (ret.deletedAt) {
      // optionally hide deletedAt from public JSON but keep if needed
    }
    return ret;
  },
});

/* -------------------- Instance methods -------------------- */

/**
 * addNote(content, userId)
 * Adds a note to the hearing and returns the pushed note.
 */
HearingSchema.methods.addNote = async function (content, userId) {
  if (!content || !String(content).trim()) throw new Error("Note content required");
  const note = { content: String(content).trim(), createdBy: userId, createdAt: new Date() };
  this.notes = this.notes || [];
  this.notes.push(note);
  this.updatedBy = userId;
  await this.save();
  return this.notes[this.notes.length - 1];
};

/**
 * softDelete(userId)
 * Marks hearing as soft-deleted and sets deletedAt
 */
HearingSchema.methods.softDelete = async function (userId) {
  this.deletedAt = new Date();
  this.updatedBy = userId;
  await this.save();
  return this;
};

/**
 * restore(userId)
 * Restores a previously soft-deleted hearing
 */
HearingSchema.methods.restore = async function (userId) {
  this.deletedAt = null;
  this.updatedBy = userId;
  await this.save();
  return this;
};

/**
 * toPublicJSON
 * Strips internal-only fields
 */
HearingSchema.methods.toPublicJSON = function () {
  const obj = this.toObject({ virtuals: true });
  delete obj.meta;
  return obj;
};

/* -------------------- Static helpers -------------------- */

/**
 * findUpcoming(limit)
 */
HearingSchema.statics.findUpcoming = function (limit = 20) {
  return this.find({ deletedAt: null, start: { $gte: new Date() }, status: "scheduled" })
    .sort({ start: 1 })
    .limit(limit)
    .populate("case participants.createdBy");
};

/**
 * findByCase(caseId, opts)
 */
HearingSchema.statics.findByCase = function (caseId, opts = {}) {
  const q = { case: caseId, deletedAt: null };
  const query = this.find(q).sort(opts.sort || { start: 1 });
  if (opts.limit) query.limit(opts.limit);
  return query;
};

/* -------------------- Pre-save sanity -------------------- */
HearingSchema.pre("save", function (next) {
  // If meetingLink present but no venue, set venue to "Online"
  if (this.meetingLink && (!this.venue || this.venue === "To be determined")) {
    this.venue = "Online";
  }

  // Basic start/end normalization
  if (this.start && this.end && new Date(this.end) < new Date(this.start)) {
    // ensure end is after start — drop end if invalid
    this.end = null;
  }

  next();
});

/* -------------------- Export -------------------- */
const Hearing = mongoose.models.Hearing || mongoose.model("Hearing", HearingSchema);
export default Hearing;
