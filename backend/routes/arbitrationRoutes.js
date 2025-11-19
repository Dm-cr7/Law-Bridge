// backend/routes/arbitrationRoutes.js
import express from "express";
import {
  createArbitration,
  getAllArbitrations,
  getArbitrationById,
  assignStaff,
  updateStatus,
  softDeleteArbitration,
  restoreArbitration,
  deleteArbitrationPermanently,
} from "../controllers/arbitrationsController.js";

import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

/* =======================================================
   📘 Arbitration Routes Overview
   =======================================================

   POST   /api/arbitrations/                        → Create new arbitration
   GET    /api/arbitrations/                        → Get all arbitrations (filtered by role)
   GET    /api/arbitrations/:id                     → Get a single arbitration by ID
   PUT    /api/arbitrations/:id/assign              → Assign arbitrator/reconciliator (Admin)
   PUT    /api/arbitrations/:id/status              → Update status (Arbitrator/Admin)
   PUT    /api/arbitrations/:id/delete              → Soft delete
   PUT    /api/arbitrations/:id/restore             → Restore deleted
   DELETE /api/arbitrations/:id/permanent           → Permanently delete arbitration + evidence
*/

/* =======================================================
   1️⃣ Create a New Arbitration Case
   ======================================================= */
router.post(
  "/",
  protect,
  authorize("admin", "lawyer", "advocate"),
  createArbitration
);

/* =======================================================
   2️⃣ Get All Arbitrations (role-aware)
   ======================================================= */
router.get("/", protect, getAllArbitrations);

/* =======================================================
   3️⃣ Get Arbitration by ID (with evidence)
   ======================================================= */
router.get("/:id", protect, getArbitrationById);

/* =======================================================
   4️⃣ Assign Arbitrator or Reconciliator (Admin only)
   ======================================================= */
router.put("/:id/assign", protect, authorize("admin"), assignStaff);

/* =======================================================
   5️⃣ Update Arbitration Status
   ======================================================= */
router.put(
  "/:id/status",
  protect,
  authorize("admin", "arbitrator"),
  updateStatus
);

/* =======================================================
   6️⃣ Soft Delete Arbitration
   ======================================================= */
router.put(
  "/:id/delete",
  protect,
  authorize("admin", "advocate", "lawyer"),
  softDeleteArbitration
);

/* =======================================================
   7️⃣ Restore Arbitration
   ======================================================= */
router.put("/:id/restore", protect, authorize("admin"), restoreArbitration);

/* =======================================================
   8️⃣ Permanently Delete Arbitration (Admin only)
   ======================================================= */
router.delete(
  "/:id/permanent",
  protect,
  authorize("admin"),
  deleteArbitrationPermanently
);

export default router;
