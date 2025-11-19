/**
 * Task.js
 * ------------------------------------------------------------
 * TASK MODEL — Productivity, Collaboration & Case Integration
 * ------------------------------------------------------------
 * Supports:
 *  ✅ Unique task per creator (user-level ownership)
 *  ✅ Multiple assignees
 *  ✅ Case-linked or standalone tasks
 *  ✅ Reminders, due dates, progress, and analytics
 *  ✅ Real-time + soft delete + audit trail
 * ------------------------------------------------------------
 */

import mongoose from "mongoose";
const { Schema } = mongoose;

/* =======================================================
   🧾 AUDIT SUBSCHEMA
   ======================================================= */
const AuditSchema = new Schema(
  {
    action: { type: String, required: true }, // created, updated, completed, deleted
    by: { type: Schema.Types.ObjectId, ref: "User" },
    at: { type: Date, default: Date.now },
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

/* =======================================================
   📋 MAIN TASK SCHEMA
   ======================================================= */
const TaskSchema = new Schema(
  {
    /* =======================================================
       🔗 RELATIONSHIPS
       ======================================================= */
    case: {
      type: Schema.Types.ObjectId,
      ref: "Case",
      default: null, // Standalone task if null
      index: true,
    },
    hearing: {
      type: Schema.Types.ObjectId,
      ref: "Hearing",
      default: null,
    },

    /* =======================================================
       🏷️ DETAILS
       ======================================================= */
    title: {
      type: String,
      required: [true, "Task title is required"],
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: "",
    },

    /* =======================================================
       👥 RESPONSIBILITY
       ======================================================= */
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Task must have a creator"],
      index: true,
    },
    assignedTo: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ], // multiple assignees supported
    sharedWith: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ], // for collaboration and visibility
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    /* =======================================================
       📅 TIMELINE
       ======================================================= */
    dueDate: {
      type: Date,
      required: [true, "Due date is required"],
    },
    reminderAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },

    /* =======================================================
       📊 PROGRESS & STATUS
       ======================================================= */
    status: {
      type: String,
      enum: ["pending", "in-progress", "completed", "overdue", "archived"],
      default: "pending",
      index: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },

    /* =======================================================
       🔔 REMINDERS
       ======================================================= */
    reminder: {
      enabled: { type: Boolean, default: false },
      remindAt: { type: Date },
    },

    /* =======================================================
       🧾 AUDIT & META
       ======================================================= */
    audit: {
      type: [AuditSchema],
      default: [],
    },
    meta: {
      type: Schema.Types.Mixed,
      default: {},
    },

    /* =======================================================
       🗑️ SOFT DELETE
       ======================================================= */
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      virtuals: true,
      transform(doc, ret) {
        delete ret.__v;
        delete ret.deletedAt;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

/* =======================================================
   🔍 INDEXES
   ======================================================= */
TaskSchema.index({ createdBy: 1, dueDate: 1 });
TaskSchema.index({ assignedTo: 1 });
TaskSchema.index({ sharedWith: 1 });
TaskSchema.index({ case: 1, status: 1 });
TaskSchema.index({ priority: 1 });
TaskSchema.index({ isDeleted: 1 });
TaskSchema.index({ title: "text", description: "text" });

/* =======================================================
   🧠 VIRTUALS
   ======================================================= */

// Is task overdue?
TaskSchema.virtual("isOverdue").get(function () {
  return (
    this.status !== "completed" &&
    this.dueDate &&
    new Date() > new Date(this.dueDate)
  );
});

// Days remaining until due date
TaskSchema.virtual("daysRemaining").get(function () {
  if (!this.dueDate) return null;
  const diff = Math.ceil((this.dueDate - Date.now()) / (1000 * 60 * 60 * 24));
  return diff >= 0 ? diff : 0;
});

/* =======================================================
   ⚙️ MIDDLEWARE
   ======================================================= */
TaskSchema.pre("save", function (next) {
  // Automatically mark overdue tasks
  if (
    this.status !== "completed" &&
    this.dueDate &&
    new Date() > new Date(this.dueDate)
  ) {
    this.status = "overdue";
  }

  // Cap audit log to 50 entries
  if (this.audit.length > 50) this.audit = this.audit.slice(0, 50);

  next();
});

/* =======================================================
   📦 METHODS
   ======================================================= */

// Add audit entry
TaskSchema.methods.addAudit = function (action, by, meta = {}) {
  this.audit.unshift({ action, by, meta, at: new Date() });
  return this;
};

// Mark completed
TaskSchema.methods.markCompleted = async function (userId) {
  this.status = "completed";
  this.completedAt = new Date();
  this.progress = 100;
  this.updatedBy = userId;
  this.addAudit("completed", userId);
  await this.save();
  return this;
};

// Soft delete
TaskSchema.methods.softDelete = async function (userId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.status = "archived";
  this.updatedBy = userId;
  this.addAudit("deleted", userId);
  await this.save();
  return this;
};

// Restore
TaskSchema.methods.restore = async function (userId) {
  this.isDeleted = false;
  this.deletedAt = null;
  this.status = "pending";
  this.updatedBy = userId;
  this.addAudit("restored", userId);
  await this.save();
  return this;
};

/* =======================================================
   ✅ MODEL EXPORT
   ======================================================= */
const Task = mongoose.model("Task", TaskSchema);
export default Task;
