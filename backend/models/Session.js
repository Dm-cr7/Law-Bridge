// backend/models/Session.js
import mongoose from "mongoose";

const { Schema, model, Types } = mongoose;

/**
 * Mediation Session Schema
 * ------------------------------------------------------------
 * Supports:
 *  - Dynamic participants (Client or User)
 *  - Soft delete
 *  - History tracking
 *  - Public-safe JSON output
 *  - Virtual helpers for UI
 * ------------------------------------------------------------
 */

const PartySchema = new Schema(
  {
    ref: { type: Types.ObjectId, required: true },

    model: {
      type: String,
      enum: ["Client", "User"],
      required: true,
    },
  },
  { _id: false }
);

const sessionSchema = new Schema(
  {
    title: {
      type: String,
      required: [true, "Session title is required"],
      trim: true,
      maxlength: 250,
    },

    mediator: {
      type: Types.ObjectId,
      ref: "User",
      required: [true, "Mediator reference is required"],
      index: true,
    },

    parties: {
      type: [PartySchema],
      default: [],
    },

    scheduledAt: {
      type: Date,
      required: [true, "Scheduled date and time are required"],
      index: true,
    },

    durationMinutes: {
      type: Number,
      default: 60,
      min: [10, "Duration must be at least 10 minutes"],
    },

    mode: {
      type: String,
      enum: ["virtual", "in-person", "hybrid"],
      default: "virtual",
    },

    locationOrUrl: {
      type: String,
      trim: true,
      default: "",
    },

    notes: {
      type: String,
      trim: true,
      default: "",
    },

    outcome: {
      type: String,
      trim: true,
      default: "",
    },

    status: {
      type: String,
      enum: ["scheduled", "completed", "cancelled"],
      default: "scheduled",
      index: true,
    },

    createdBy: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    caseRef: {
      type: Types.ObjectId,
      ref: "Case",
      default: null,
    },

    deletedAt: {
      type: Date,
      default: null,
    },

    history: [
      {
        ts: { type: Date, default: Date.now },
        action: { type: String, trim: true },
        by: { type: Types.ObjectId, ref: "User" },
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

/* -----------------------------------------------------------
 * Indexes
 * ----------------------------------------------------------- */
sessionSchema.index({ scheduledAt: 1 });
sessionSchema.index({ mediator: 1 });
sessionSchema.index({ status: 1 });
sessionSchema.index({ deletedAt: 1 });

/* -----------------------------------------------------------
 * Virtuals
 * ----------------------------------------------------------- */
sessionSchema.virtual("isUpcoming").get(function () {
  return (
    this.status === "scheduled" &&
    !this.deletedAt &&
    this.scheduledAt > new Date()
  );
});

sessionSchema.virtual("durationMs").get(function () {
  return this.durationMinutes * 60000;
});

/* -----------------------------------------------------------
 * Hooks
 * ----------------------------------------------------------- */
sessionSchema.pre("save", function (next) {
  if (this.mode === "virtual" && !this.locationOrUrl) {
    this.locationOrUrl = "TBD — Virtual meeting link will be provided.";
  }
  next();
});

/* -----------------------------------------------------------
 * Instance Methods
 * ----------------------------------------------------------- */
sessionSchema.methods.softDelete = async function (byUser) {
  this.deletedAt = new Date();
  this.history.push({
    action: "soft_delete",
    by: byUser,
    note: "Session deleted",
  });
  await this.save();
  return this;
};

sessionSchema.methods.restore = async function (byUser) {
  this.deletedAt = null;
  this.history.push({
    action: "restore",
    by: byUser,
    note: "Session restored",
  });
  await this.save();
  return this;
};

sessionSchema.methods.addNote = async function (byUser, note) {
  this.history.push({
    action: "note",
    by: byUser,
    note,
  });
  await this.save();
  return this;
};

sessionSchema.methods.toPublicJSON = function () {
  const obj = this.toObject({ virtuals: true });
  delete obj.__v;

  // Trim history for UI performance
  if (obj.history && obj.history.length > 30) {
    obj.history = obj.history.slice(-30);
  }
  return obj;
};

/* -----------------------------------------------------------
 * Export (default!)
 * ----------------------------------------------------------- */
const Session = model("Session", sessionSchema);
export default Session;
