// backend/routes/caseRoutes.js
/**
 * Case Management Routes (Realtime + Role-Based Access)
 * -------------------------------------------------------------
 * - Full CRUD operations (create, read, update, soft-delete, restore)
 * - Role-based sharing & collaboration
 * - Hearings, participants, team management
 * - Notes & attachments
 * - Analytics & export (CSV / JSON)
 *
 * Additions:
 * - PATCH /:id (partial update) alongside PUT /:id
 * - Convenience endpoints:
 *    PATCH /:id/pause   -> sets status to 'paused' (delegates to updateCaseStatus)
 *    PATCH /:id/resume  -> sets status back to provided or 'filed' (delegates to updateCaseStatus)
 *
 * Important:
 * - All routes are protected with `protect`.
 * - Authorization uses role shortcuts defined below.
 */

import express from "express";
import {
  createCase,
  getCases,
  getCaseById,
  updateCase,
  updateCaseStatus,
  softDeleteCase,
  restoreCase,
  shareCase,
  addCaseNote,
  addAttachment,
  deleteAttachment,
  addCaseHearing,
  addCaseParticipant,
  removeCaseParticipant,
  addTeamMember,
  removeTeamMember,
  getCaseStats,
  exportCasesCSV,
} from "../controllers/caseController.js";

import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

/* =======================================================
   Role shortcut helpers
   ======================================================= */
const advocateRoles = ["advocate", "admin", "arbitrator"];
const generalRoles = ["advocate", "arbitrator", "admin", "client"];

/* =======================================================
   Analytics & Export
   -------------------------------------------------------
   keep these before parameterized routes (/:id)
   ======================================================= */

/**
 * GET /api/cases/stats
 * access: Advocate, Admin
 */
router.get("/stats", protect, authorize("advocate", "admin"), getCaseStats);

/**
 * GET /api/cases/export
 * access: Advocate, Admin
 */
router.get("/export", protect, authorize("advocate", "admin"), exportCasesCSV);

/* =======================================================
   Core case management
   ======================================================= */

/**
 * POST /api/cases
 * Create a new case (optionally with initial hearing(s) in body)
 * access: Advocate, Client
 */
router.post("/", protect, authorize("advocate", "client"), createCase);

/**
 * GET /api/cases
 * List cases (filters: ?page=&limit=&category=&status=&q=)
 * access: Private (advocate, arbitrator, admin, client)
 */
router.get("/", protect, authorize(...generalRoles), getCases);

/**
 * GET /api/cases/:id
 * Retrieve a case by ID (access enforced in controller)
 */
router.get("/:id", protect, authorize(...generalRoles), getCaseById);

/**
 * PUT /api/cases/:id
 * Full replace/update of allowed case fields (keeps history)
 * access: Advocate, Arbitrator, Admin
 */
router.put("/:id", protect, authorize(...advocateRoles), updateCase);

/**
 * PATCH /api/cases/:id
 * Partial update (only provided fields will be updated)
 * access: Advocate, Arbitrator, Admin
 *
 * Uses same controller `updateCase` which already handles updates & permission checks.
 * Keeping both PUT and PATCH for client flexibility.
 */
router.patch("/:id", protect, authorize(...advocateRoles), updateCase);

/* =======================================================
   Status / Pause / Resume
   ======================================================= */

/**
 * PATCH /api/cases/:id/status
 * Generic status update (body: { status: '...' })
 * access: Advocate, Arbitrator, Admin
 */
router.patch("/:id/status", protect, authorize(...advocateRoles), updateCaseStatus);

/**
 * PATCH /api/cases/:id/pause
 * Convenience route — sets status to 'paused' via updateCaseStatus
 * access: Advocate, Arbitrator, Admin
 */
router.patch(
  "/:id/pause",
  protect,
  authorize(...advocateRoles),
  (req, res, next) => {
    // set requested status and reuse centralized handler
    req.body = req.body || {};
    req.body.status = "paused";
    return updateCaseStatus(req, res, next);
  }
);

/**
 * PATCH /api/cases/:id/resume
 * Convenience route — resumes a paused case.
 * By default we set status back to 'filed' but callers can pass desired status in body.
 * access: Advocate, Arbitrator, Admin
 */
router.patch(
  "/:id/resume",
  protect,
  authorize(...advocateRoles),
  (req, res, next) => {
    req.body = req.body || {};
    // allow caller to pass status explicitly, otherwise resume to 'filed'
    req.body.status = req.body.status || "filed";
    return updateCaseStatus(req, res, next);
  }
);

/* =======================================================
   Delete / Restore
   ======================================================= */

/**
 * DELETE /api/cases/:id
 * Soft-delete (mark case as deleted)
 * access: Advocate, Admin
 */
router.delete("/:id", protect, authorize("advocate", "admin"), softDeleteCase);

/**
 * POST /api/cases/:id/restore
 * Restore a previously soft-deleted case
 * access: Admin
 */
router.post("/:id/restore", protect, authorize("admin"), restoreCase);

/* =======================================================
   Collaboration & Sharing
   ======================================================= */

/**
 * PATCH /api/cases/:id/share
 * Share a case with another user (adds to sharedWith[])
 * access: Advocate, Admin
 */
router.patch("/:id/share", protect, authorize("advocate", "admin"), shareCase);

/**
 * POST /api/cases/:id/notes
 * Add a note (visibility: private|shared|public)
 * access: Advocate, Admin, Client, Arbitrator
 */
router.post("/:id/notes", protect, authorize(...generalRoles), addCaseNote);

/**
 * POST /api/cases/:id/attachments
 * Add attachment (metadata only — file should already be uploaded)
 * access: Advocate, Admin, Client, Arbitrator
 */
router.post("/:id/attachments", protect, authorize(...generalRoles), addAttachment);

/**
 * DELETE /api/cases/:id/attachments
 * Remove attachment by fileUrl
 * access: Advocate, Admin, Arbitrator
 */
router.delete("/:id/attachments", protect, authorize(...advocateRoles), deleteAttachment);

/* =======================================================
   Hearings
   ======================================================= */

/**
 * POST /api/cases/:id/hearings
 * Add a hearing to a case
 * access: Advocate, Arbitrator, Admin
 */
router.post("/:id/hearings", protect, authorize(...advocateRoles), addCaseHearing);

/* =======================================================
   Participants
   ======================================================= */

/**
 * POST /api/cases/:id/participants
 * Add participant to a case
 * access: Advocate, Arbitrator, Admin
 */
router.post("/:id/participants", protect, authorize(...advocateRoles), addCaseParticipant);

/**
 * DELETE /api/cases/:id/participants
 * Remove a participant from a case
 * access: Advocate, Arbitrator, Admin
 */
router.delete("/:id/participants", protect, authorize(...advocateRoles), removeCaseParticipant);

/* =======================================================
   Team management
   ======================================================= */

/**
 * POST /api/cases/:id/team
 * Add team member (assistant, paralegal, co-counsel)
 * access: Advocate, Admin
 */
router.post("/:id/team", protect, authorize("advocate", "admin"), addTeamMember);

/**
 * DELETE /api/cases/:id/team
 * Remove team member
 * access: Advocate, Admin
 */
router.delete("/:id/team", protect, authorize("advocate", "admin"), removeTeamMember);

/* =======================================================
   Export the router
   ======================================================= */
export default router;
