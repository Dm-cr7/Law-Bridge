// backend/models/Award.js
/**
 * Award.js
 * ------------------------------------------------------------
 * Defines arbitration award documents linked to Arbitration cases.
 * Supports PDF storage (local or cloud), audit tracking,
 * and verification by authorized personnel.
 */

import mongoose from "mongoose";

const awardSchema = new mongoose.Schema(
  {
    arbitration: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Arbitration",
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    summary: {
      type: String,
      trim: true,
    },

    decisionText: {
      type: String,
      required: true,
    },

    // Arbitrator who issued this award
    arbitrator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Optional involved parties (for notification and access control)
    parties: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // PDF file storage info
    awardPdf: {
      type: String, // Can be a URL (S3) or local path
      default: null,
    },

    // Signature or digital verification metadata
    signedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    signatureHash: {
      type: String,
      default: null,
    },

    // Timestamps for issuance and verification
    decisionDate: {
      type: Date,
      default: Date.now,
    },
    verifiedAt: {
      type: Date,
    },
    awardGeneratedAt: {
      type: Date,
    },

    // Verification flags
    verified: {
      type: Boolean,
      default: false,
    },
    isFinalized: {
      type: Boolean,
      default: false,
    },

    // Metadata
    status: {
      type: String,
      enum: ["Draft", "Pending Review", "Approved", "Rejected", "Finalized"],
      default: "Draft",
    },

    notes: {
      type: String,
      trim: true,
    },

    // Audit tracking
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // Soft delete
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

/* =======================================================
   🔒 Hooks
   ======================================================= */

// Ensure award title is unique within an arbitration
awardSchema.index({ arbitration: 1, title: 1 }, { unique: true });

// Mark deletion time automatically
awardSchema.pre("save", function (next) {
  if (this.isDeleted && !this.deletedAt) {
    this.deletedAt = new Date();
  }
  next();
});

/* =======================================================
   ⚙️ Methods
   ======================================================= */

awardSchema.methods.markVerified = function (verifierId) {
  this.verified = true;
  this.verifiedAt = new Date();
  this.status = "Approved";
  this.updatedBy = verifierId;
  return this.save();
};

awardSchema.methods.softDelete = function (userId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.updatedBy = userId;
  return this.save();
};

awardSchema.methods.restore = function (userId) {
  this.isDeleted = false;
  this.deletedAt = null;
  this.updatedBy = userId;
  return this.save();
};

const Award = mongoose.model("Award", awardSchema);

export default Award;
