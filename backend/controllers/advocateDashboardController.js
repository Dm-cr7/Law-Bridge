/**
 * advocateDashboardController.js (Production Ready)
 * ------------------------------------------------------------
 * Aggregates advocate-specific dashboard data:
 * ✅ Case summary (filed, active, closed)
 * ✅ Task stats (pending, completed, overdue)
 * ✅ ADR resolution rates
 * ✅ Unread & recent notifications
 * ✅ Upcoming hearings
 * ------------------------------------------------------------
 */

import Case from "../models/Case.js";
import Task from "../models/Task.js";
import Notification from "../models/Notification.js";
import Arbitration from "../models/Arbitration.js";
import asyncHandler from "../middleware/asyncHandler.js";
import { emitSocketEvent } from "../utils/socketEmitter.js";

/* =======================================================
   🎯 GET ADVOCATE DASHBOARD DATA
======================================================= */
export const getAdvocateDashboard = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const role = req.user.role?.toLowerCase();

  // 🧩 Authorization
  if (!["advocate", "admin"].includes(role)) {
    return res.status(403).json({
      success: false,
      message: "Access denied. Advocates only.",
    });
  }

  // ======================================================
  // Parallel DB queries for performance
  // ======================================================
  const [
    caseStats,
    taskStats,
    unreadNotifications,
    recentNotifications,
    adrStats,
    upcomingHearings,
  ] = await Promise.all([
    // 1️⃣ CASE STATS
    Case.aggregate([
      { $match: { filedBy: userId, isDeleted: false } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),

    // 2️⃣ TASK STATS
    Task.aggregate([
      { $match: { createdBy: userId, isDeleted: false } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),

    // 3️⃣ UNREAD NOTIFICATIONS COUNT
    Notification.countDocuments({
      recipient: userId,
      isDeleted: false,
      isRead: false,
    }),

    // 4️⃣ RECENT NOTIFICATIONS (latest 5)
    Notification.find({
      recipient: userId,
      isDeleted: false,
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("title message type link createdAt")
      .lean(),

    // 5️⃣ ADR (Arbitrations) STATS
    Arbitration.aggregate([
      { $match: { deleted: { $ne: true }, createdBy: userId } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),

    // 6️⃣ UPCOMING HEARINGS (5 soonest)
    Case.find({
      filedBy: userId,
      isDeleted: false,
      hearingDate: { $gte: new Date() },
    })
      .select("title hearingDate status")
      .sort({ hearingDate: 1 })
      .limit(5)
      .lean(),
  ]);

  // ======================================================
  // Compute summaries
  // ======================================================

  // CASE SUMMARY
  const totalCases = caseStats.reduce((sum, s) => sum + s.count, 0);
  const activeCases =
    caseStats.find((s) => ["filed", "under_review", "open"].includes(s._id))?.count || 0;
  const closedCases =
    caseStats.find((s) => ["closed", "resolved"].includes(s._id))?.count || 0;

  // TASK SUMMARY
  const totalTasks = taskStats.reduce((sum, s) => sum + s.count, 0);
  const pendingTasks = taskStats.find((s) => s._id === "pending")?.count || 0;
  const completedTasks = taskStats.find((s) => s._id === "completed")?.count || 0;
  const overdueTasks = taskStats.find((s) => s._id === "overdue")?.count || 0;

  // ADR SUMMARY
  const adrTotal = adrStats.reduce((sum, s) => sum + s.count, 0);
  const adrResolved =
    adrStats
      .filter((s) => ["resolved", "settled", "closed"].includes(s._id))
      .reduce((sum, s) => sum + s.count, 0) || 0;
  const adrSuccessRate = adrTotal > 0 ? ((adrResolved / adrTotal) * 100).toFixed(2) : 0;

  // ======================================================
  // COMPILED DASHBOARD PAYLOAD
  // ======================================================
  const dashboard = {
    user: {
      id: userId,
      role,
    },
    cases: {
      total: totalCases,
      active: activeCases,
      closed: closedCases,
    },
    tasks: {
      total: totalTasks,
      pending: pendingTasks,
      completed: completedTasks,
      overdue: overdueTasks,
    },
    adr: {
      total: adrTotal,
      resolved: adrResolved,
      successRate: adrSuccessRate,
    },
    notifications: {
      unread: unreadNotifications,
      recent: recentNotifications,
    },
    hearings: {
      upcoming: upcomingHearings,
    },
  };

  // Optional: emit realtime dashboard refresh event
  emitSocketEvent("dashboard:update", userId.toString(), dashboard);

  res.status(200).json({
    success: true,
    message: "Advocate dashboard data loaded successfully.",
    data: dashboard,
  });
});
