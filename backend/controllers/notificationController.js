/**
 * notificationController.js (Realtime Ready)
 * ------------------------------------------------------------
 * Handles all notification CRUD, delivery, and state updates.
 * ------------------------------------------------------------
 * ✅ Uses socketEmitter for safe, room-scoped realtime updates
 * ✅ Supports user, role, or broadcast targets
 * ✅ Consistent response + event naming
 * ✅ No circular dependency on server.js
 * ------------------------------------------------------------
 */

import Notification from "../models/Notification.js";
import User from "../models/User.js";
import { emitSocketEvent } from "../utils/socketEmitter.js";

/* =======================================================
   📢 CREATE / SEND NOTIFICATION
======================================================= */
export const createNotification = async (req, res) => {
  try {
    const {
      recipientId,
      title,
      message,
      type,
      link,
      relatedCase,
      relatedTask,
      targetRoles,
    } = req.body;
    const sender = req.user?._id;

    if (!title || !message)
      return res
        .status(400)
        .json({ success: false, message: "Title and message are required." });

    let recipients = [];

    // 🎯 Determine recipients
    if (Array.isArray(targetRoles) && targetRoles.length > 0) {
      const users = await User.find({ role: { $in: targetRoles } }).select("_id");
      recipients = users.map((u) => u._id);
    } else if (recipientId) {
      recipients = Array.isArray(recipientId) ? recipientId : [recipientId];
    }

    if (recipients.length === 0)
      return res
        .status(400)
        .json({ success: false, message: "No valid recipients found." });

    // 📨 Create notifications
    const notifications = await Promise.all(
      recipients.map((recipient) =>
        Notification.create({
          recipient,
          sender,
          title,
          message,
          type: type || "general",
          link: link || null,
          relatedCase: relatedCase || null,
          relatedTask: relatedTask || null,
          targetRoles: targetRoles || [],
        })
      )
    );

    // 🔔 Emit realtime event to each recipient
    for (const notif of notifications) {
      emitSocketEvent("notification:new", notif.recipient.toString(), notif);
    }

    res.status(201).json({
      success: true,
      message: `Notification sent to ${recipients.length} recipient(s).`,
      count: recipients.length,
      data: notifications,
    });
  } catch (err) {
    console.error("❌ createNotification error:", err);
    res.status(500).json({ success: false, message: "Failed to create notification", error: err.message });
  }
};

/* =======================================================
   📬 GET USER NOTIFICATIONS
======================================================= */
export const getUserNotifications = async (req, res) => {
  try {
    const userId = req.user._id;

    const notifications = await Notification.find({
      recipient: userId,
      isDeleted: false,
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const unreadCount = await Notification.countDocuments({
      recipient: userId,
      isDeleted: false,
      isRead: false,
    });

    res.json({
      success: true,
      total: notifications.length,
      unreadCount,
      data: notifications,
    });
  } catch (err) {
    console.error("❌ getUserNotifications error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch notifications", error: err.message });
  }
};

/* =======================================================
   ✅ MARK SINGLE NOTIFICATION AS READ
======================================================= */
export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const notif = await Notification.findOne({ _id: id, recipient: userId });
    if (!notif) return res.status(404).json({ success: false, message: "Notification not found" });

    await notif.markRead();
    emitSocketEvent("notification:read", userId.toString(), { id });

    res.json({ success: true, message: "Notification marked as read", id });
  } catch (err) {
    console.error("❌ markAsRead error:", err);
    res.status(500).json({ success: false, message: "Failed to update notification", error: err.message });
  }
};

/* =======================================================
   ✅ MARK ALL AS READ
======================================================= */
export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user._id;
    const result = await Notification.updateMany(
      { recipient: userId, isRead: false },
      { isRead: true }
    );

    emitSocketEvent("notification:readAll", userId.toString(), { count: result.modifiedCount });
    res.json({ success: true, message: "All notifications marked as read", count: result.modifiedCount });
  } catch (err) {
    console.error("❌ markAllAsRead error:", err);
    res.status(500).json({ success: false, message: "Failed to mark all as read", error: err.message });
  }
};

/* =======================================================
   🗑️ SOFT DELETE NOTIFICATION
======================================================= */
export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const notif = await Notification.findOne({ _id: id, recipient: userId });
    if (!notif) return res.status(404).json({ success: false, message: "Notification not found" });

    await notif.softDelete();
    emitSocketEvent("notification:deleted", userId.toString(), { id });

    res.json({ success: true, message: "Notification deleted", id });
  } catch (err) {
    console.error("❌ deleteNotification error:", err);
    res.status(500).json({ success: false, message: "Failed to delete notification", error: err.message });
  }
};

/* =======================================================
   🧹 CLEAR ALL READ NOTIFICATIONS
======================================================= */
export const clearReadNotifications = async (req, res) => {
  try {
    const userId = req.user._id;

    const result = await Notification.updateMany(
      { recipient: userId, isRead: true },
      { isDeleted: true }
    );

    emitSocketEvent("notification:cleared", userId.toString(), { count: result.modifiedCount });
    res.json({ success: true, message: "All read notifications cleared", count: result.modifiedCount });
  } catch (err) {
    console.error("❌ clearReadNotifications error:", err);
    res.status(500).json({ success: false, message: "Failed to clear notifications", error: err.message });
  }
};
