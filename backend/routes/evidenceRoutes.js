/**
 * backend/routes/evidenceRoutes.js
 * ------------------------------------------------------------
 * Evidence Routes — Production Ready
 * ------------------------------------------------------------
 * - Reuses upload middleware from uploadController (single source of truth)
 * - Consistent error propagation via asyncHandler -> app-level handler
 * - Role-based authorization on sensitive endpoints
 * ------------------------------------------------------------
 */

import express from "express";
import {
  uploadEvidence,
  getEvidenceByParent,
  getEvidenceById,
  verifyEvidence,
  softDeleteEvidence,
  restoreEvidence,
  deleteEvidencePermanently,
  searchEvidence,
} from "../controllers/evidenceController.js";

import { uploadSingle } from "../controllers/uploadController.js"; // reuse centralized upload middleware
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

// async wrapper to forward errors to express error handler
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/**
 * Routes overview (final paths combine with app.use('/api/evidence', router))
 *
 * POST   /case/:caseId/upload            -> Upload evidence for a case (field name: "file") -> returns 201 { success, message, evidence }
 * POST   /arbitration/:arbitrationId/upload -> Upload evidence for arbitration (field name: "file")
 * GET    /case/:caseId                   -> Get all evidence for a case
 * GET    /arbitration/:arbitrationId     -> Get all evidence for an arbitration
 * GET    /:id                            -> Get single evidence
 * PUT    /:id/verify                     -> Verify evidence
 * PUT    /:id/delete                     -> Soft delete evidence
 * PUT    /:id/restore                    -> Restore evidence
 * DELETE /:id/permanent                  -> Permanently delete
 * GET    /search?q=                      -> Search evidence globally
 */

/* -------------------------
   1) Upload evidence for CASE
   ------------------------- */
router.post(
  "/case/:caseId/upload",
  protect,
  authorize("admin", "lawyer", "party"),
  // Use centralized upload middleware (memory or disk depends on your controller config)
  uploadSingle("file"),
  asyncHandler(uploadEvidence)
);

/* -------------------------
   2) Upload evidence for ARBITRATION
   ------------------------- */
router.post(
  "/arbitration/:arbitrationId/upload",
  protect,
  authorize("admin", "lawyer", "party"),
  uploadSingle("file"),
  asyncHandler(uploadEvidence)
);

/* -------------------------
   3) Get all evidence for CASE
   ------------------------- */
router.get(
  "/case/:caseId",
  protect,
  authorize("admin", "lawyer", "party"),
  asyncHandler(getEvidenceByParent)
);

/* -------------------------
   4) Get all evidence for ARBITRATION
   ------------------------- */
router.get(
  "/arbitration/:arbitrationId",
  protect,
  authorize("admin", "lawyer", "party"),
  asyncHandler(getEvidenceByParent)
);

/* -------------------------
   5) Get a single evidence record
   ------------------------- */
router.get(
  "/:id",
  protect,
  authorize("admin", "lawyer", "party"),
  asyncHandler(getEvidenceById)
);

/* -------------------------
   6) Verify evidence (Admin or Arbitrator)
   ------------------------- */
router.put(
  "/:id/verify",
  protect,
  authorize("admin", "arbitrator"),
  asyncHandler(verifyEvidence)
);

/* -------------------------
   7) Soft delete evidence (Uploader or Admin)
   ------------------------- */
router.put(
  "/:id/delete",
  protect,
  // authorize allows uploader roles — if you need uploader-specific logic, handle inside controller
  authorize("admin", "lawyer", "party"),
  asyncHandler(softDeleteEvidence)
);

/* -------------------------
   8) Restore soft-deleted evidence (Admin)
   ------------------------- */
router.put(
  "/:id/restore",
  protect,
  authorize("admin"),
  asyncHandler(restoreEvidence)
);

/* -------------------------
   9) Permanently delete evidence (Admin)
   ------------------------- */
router.delete(
  "/:id/permanent",
  protect,
  authorize("admin"),
  asyncHandler(deleteEvidencePermanently)
);

/* -------------------------
   10) Global search (Admin / Arbitrator)
   ------------------------- */
router.get(
  "/search",
  protect,
  authorize("admin", "arbitrator"),
  asyncHandler(searchEvidence)
);

export default router;
