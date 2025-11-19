/**
 * Award Routes
 * ------------------------------------------------------------
 * Handles award CRUD operations, secure PDF generation,
 * and administrative review endpoints.
 */

import express from "express";
import {
  createAward,
  getAllAwards,
  getAwardById,
  updateAward,
  softDeleteAward,   // ✅ Correct import name
  verifyAward,
} from "../controllers/awardController.js";

import { triggerAwardPdf } from "../controllers/awardPdfJob.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

/* =======================================================
   Route Overview
   =======================================================

   POST   /api/awards/                        -> Create new award
   GET    /api/awards/                        -> Get all awards (Admin / Arbitrator)
   GET    /api/awards/:id                     -> Get specific award
   PUT    /api/awards/:id                     -> Update award details
   PUT    /api/awards/:id/verify              -> Verify / approve award
   DELETE /api/awards/:id                     -> Soft delete (Admin)
   POST   /api/awards/:id/pdf                 -> Trigger async PDF generation
*/

/* =======================================================
   1️⃣ Create a new Award
   ======================================================= */
router.post(
  "/",
  protect,
  authorize("arbitrator", "admin"),
  createAward
);

/* =======================================================
   2️⃣ Get all Awards (Admin / Arbitrator)
   ======================================================= */
router.get(
  "/",
  protect,
  authorize("admin", "arbitrator"),
  getAllAwards
);

/* =======================================================
   3️⃣ Get single Award by ID
   ======================================================= */
router.get(
  "/:id",
  protect,
  authorize("admin", "arbitrator", "reconciliator"),
  getAwardById
);

/* =======================================================
   4️⃣ Update existing Award
   ======================================================= */
router.put(
  "/:id",
  protect,
  authorize("arbitrator", "admin"),
  updateAward
);

/* =======================================================
   5️⃣ Verify / Approve Award
   ======================================================= */
router.put(
  "/:id/verify",
  protect,
  authorize("admin", "arbitrator"),
  verifyAward
);

/* =======================================================
   6️⃣ Delete (Soft Delete)
   ======================================================= */
router.delete(
  "/:id",
  protect,
  authorize("admin"),
  softDeleteAward     // ✅ Using correct function from controller
);

/* =======================================================
   7️⃣ Generate Award PDF (Async)
   ======================================================= */
router.post(
  "/:id/pdf",
  protect,
  authorize("admin", "arbitrator"),
  triggerAwardPdf
);

export default router;
