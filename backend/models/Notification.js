import mongoose from "mongoose";

/* =======================================================
   NOTIFICATION MODEL — Unified Alerting System
   -------------------------------------------------------
   Supports:
   • Individual or multi-recipient notifications
   • Role-based delivery
   • Soft delete and expiry policies
   • Deep-linking to tasks, cases, or ADR entities
   ======================================================= */

const notificationSchema = new mongoose.Schema(
  {
    /* =======================================================
       👥 RECIPIENT & SENDER
       ======================================================= */
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    /* =======================================================
       🧾 CONTENT
       ======================================================= */
    title: {
      type: String,
      required: [true, "Notification title is required"],
      trim: true,
      maxlength: 200,
    },
    message: {
      type: String,
      required: [true, "Notification message is required"],
      trim: true,
      maxlength: 1000,
    },

    /* =======================================================
       📁 REFERENCE LINKS
       ======================================================= */
    type: {
      type: String,
      enum: [
        "general",
        "system",
        "case_update",
        "task_update",
        "adr_update",
        "document",
        "reminder",
        "alert",
        "message",
      ],
      default: "general",
      index: true,
    },
    link: {
      type: String,
      trim: true,
      default: null, // Optional deep link for frontend (e.g. /cases/:id)
    },
    relatedCase: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Case",
      default: null,
    },
    relatedTask: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      default: null,
    },

    /* =======================================================
       ⚙️ STATE & VISIBILITY
       ======================================================= */
    isRead: { type: Boolean, default: false, index: true },
    isDeleted: { type: Boolean, default: false, index: true },

    /* =======================================================
       🎭 ROLE BROADCASTING (optional)
       ======================================================= */
    targetRoles: [
      {
        type: String,
        enum: [
          "advocate",
          "paralegal",
          "mediator",
          "arbitrator",
          "reconciliator",
          "client",
          "admin",
        ],
      },
    ],
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

/* =======================================================
   ⚡ INDEXES & EXPIRY
   ======================================================= */

// Auto-expire deleted notifications after 30 days
notificationSchema.index(
  { updatedAt: 1 },
  {
    expireAfterSeconds: 60 * 60 * 24 * 30, // 30 days
    partialFilterExpression: { isDeleted: true },
  }
);

// Quick lookups by recipient + unread
notificationSchema.index({ recipient: 1, isRead: 1 });

/* =======================================================
   🧠 VIRTUALS
   ======================================================= */

// Short message preview for UI lists
notificationSchema.virtual("preview").get(function () {
  return this.message.length > 80
    ? this.message.substring(0, 77) + "..."
    : this.message;
});

/* =======================================================
   ⚙️ METHODS
   ======================================================= */

// Mark as read
notificationSchema.methods.markRead = async function () {
  this.isRead = true;
  await this.save();
  return this;
};

// Mark as unread
notificationSchema.methods.markUnread = async function () {
  this.isRead = false;
  await this.save();
  return this;
};

// Soft delete
notificationSchema.methods.softDelete = async function () {
  this.isDeleted = true;
  await this.save();
  return this;
};

// Quick static helper to create & broadcast notifications
notificationSchema.statics.createAndNotify = async function (data, io = null) {
  const notification = await this.create(data);

  // Optional realtime broadcast
  if (io) {
    io.emit("notification:new", {
      _id: notification._id,
      title: notification.title,
      message: notification.message,
      recipient: notification.recipient,
      type: notification.type,
      link: notification.link,
      createdAt: notification.createdAt,
    });
  }

  return notification;
};

/* =======================================================
   ✅ MODEL EXPORT
   ======================================================= */
const Notification = mongoose.model("Notification", notificationSchema);
export default Notification;
