/**
 * backend/routes/advocateDashboardRoutes.js
 * -------------------------------------------------------------
 * ADVOCATE DASHBOARD ROUTES
 * -------------------------------------------------------------
 * Provides analytics, summaries, and quick insights
 * for advocates and their related entities:
 *  ✅ Case statistics
 *  ✅ Task progress
 *  ✅ Notification overview
 *  ✅ ADR (arbitration) success metrics
 *  ✅ Upcoming hearings
 * -------------------------------------------------------------
 * Base URL: /api/dashboard/advocate
 */

import express from "express";
import { getAdvocateDashboard } from "../controllers/advocateDashboardController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

/* =======================================================
   🎯 ADVOCATE DASHBOARD ROUTE
   ======================================================= */

/**
 * @route   GET /api/dashboard/advocate
 * @desc    Fetch advocate dashboard analytics
 *          Includes cases, tasks, ADR stats, notifications, hearings
 * @access  Private (Advocate, Admin)
 */
router.get("/", protect, authorize("advocate", "admin"), getAdvocateDashboard);

export default router;
