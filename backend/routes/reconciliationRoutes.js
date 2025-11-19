// backend/routes/reconciliationRoutes.js
import express from "express";
import {
  createReconciliation,
  getReconciliations,
  getReconciliationById,
  updateReconciliation,
  deleteReconciliation,
  restoreReconciliation,
  getReconciliationReport,
} from "../controllers/reconciliationController.js";

import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

/* ===========================================================
   ROUTES — /api/reconciliations
   =========================================================== */

/**
 * @route   POST /api/reconciliations
 * @desc    Create a new reconciliation session
 * @access  Reconciliator, Admin
 */
router.post("/", protect, authorizeRoles("reconciliator", "admin"), createReconciliation);

/**
 * @route   GET /api/reconciliations
 * @desc    Fetch all reconciliations (scoped by user)
 * @access  Authenticated users
 */
router.get("/", protect, getReconciliations);

/**
 * @route   GET /api/reconciliations/:id
 * @desc    Get a specific reconciliation by ID
 * @access  Authenticated users
 */
router.get("/:id", protect, getReconciliationById);

/**
 * @route   PUT /api/reconciliations/:id
 * @desc    Update reconciliation details (status, notes, etc.)
 * @access  Reconciliator, Admin
 */
router.put("/:id", protect, authorizeRoles("reconciliator", "admin"), updateReconciliation);

/**
 * @route   DELETE /api/reconciliations/:id
 * @desc    Soft delete a reconciliation
 * @access  Reconciliator, Admin
 */
router.delete("/:id", protect, authorizeRoles("reconciliator", "admin"), deleteReconciliation);

/**
 * @route   PUT /api/reconciliations/:id/restore
 * @desc    Restore a deleted reconciliation
 * @access  Admin only
 */
router.put("/:id/restore", protect, authorizeRoles("admin"), restoreReconciliation);

/**
 * @route   GET /api/reconciliations/:id/report
 * @desc    Download reconciliation report (PDF)
 * @access  Reconciliator, Admin
 */
router.get("/:id/report", protect, authorizeRoles("reconciliator", "admin"), getReconciliationReport);

export default router;
