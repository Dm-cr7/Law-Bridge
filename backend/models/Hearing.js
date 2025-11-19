// backend/models/Hearing.js
import mongoose from "mongoose";

/**
 * Hearing Model
 * ------------------------------------------------------------
 * Represents scheduled hearing sessions for arbitration/court cases.
 */

const hearingSchema = new mongoose.Schema(
  {
    case: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Case",
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: [true, "Hearing title is required"],
      trim: true,
      maxlength: 200,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },

    // Use `start` and `end` for range semantics while keeping `date` for legacy compatibility
    start: {
      type: Date,
      required: true,
      index: true,
    },
    end: {
      type: Date,
      required: false,
    },

    venue: {
      type: String,
      trim: true,
      default: "To be determined",
    },

    meetingLink: {
      type: String,
      trim: true,
      default: null,
    },

    status: {
      type: String,
      enum: ["scheduled", "in_progress", "adjourned", "completed", "cancelled"],
      default: "scheduled",
      index: true,
    },

    participants: {
      advocates: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      arbitrators: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      clients: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      respondents: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    },

    notes: [
      {
        content: { type: String, trim: true },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        createdAt: { type: Date, default: Date.now },
      },
    ],

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    deletedAt: { type: Date, default: null },
    arbitration: { type: mongoose.Schema.Types.ObjectId, ref: "Arbitration", default: null }, // optional link
    meta: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// Virtual: isUpcoming (based on start)
hearingSchema.virtual("isUpcoming").get(function () {
  try {
    return this.start && new Date(this.start) > new Date() && this.status === "scheduled";
  } catch {
    return false;
  }
});

const Hearing = mongoose.model("Hearing", hearingSchema);
export default Hearing;
