/**
 * backend/routes/notificationRoutes.js
 * -------------------------------------------------------------
 * NOTIFICATION ROUTES
 * -------------------------------------------------------------
 * Handles:
 *  ✅ Create / broadcast notifications
 *  ✅ Fetch user-specific notifications
 *  ✅ Mark one / all as read
 *  ✅ Soft delete or clear read notifications
 * -------------------------------------------------------------
 */

import express from "express";
import {
  createNotification,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearReadNotifications,
} from "../controllers/notificationController.js";

import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

/* =======================================================
   🔔 NOTIFICATION ROUTES
   ======================================================= */

/**
 * @route   POST /api/notifications
 * @desc    Create or send a new notification
 * @body    { recipientId, title, message, type, link }
 * @access  Private
 */
router.post("/", protect, createNotification);

/**
 * @route   GET /api/notifications
 * @desc    Get paginated notifications for logged-in user
 * @query   ?limit=20&skip=0
 * @access  Private
 */
router.get("/", protect, getUserNotifications);

/**
 * @route   PATCH /api/notifications/read-all
 * @desc    Mark all notifications as read for the user
 * @access  Private
 */
router.patch("/read-all", protect, markAllAsRead);

/**
 * @route   PATCH /api/notifications/:id/read
 * @desc    Mark a single notification as read
 * @access  Private
 */
router.patch("/:id/read", protect, markAsRead);

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Soft delete a single notification
 * @access  Private
 */
router.delete("/:id", protect, deleteNotification);

/**
 * @route   DELETE /api/notifications/clear-read
 * @desc    Soft delete all read notifications for the user
 * @access  Private
 */
router.delete("/clear-read", protect, clearReadNotifications);

export default router;
