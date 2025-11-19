/**
 * backend/routes/caseRoutes.js
 * -------------------------------------------------------------
 * Case Management Routes (Realtime + Role-Based Access)
 * -------------------------------------------------------------
 * Features:
 *  ✅ Full CRUD operations (create, read, update, soft-delete, restore)
 *  ✅ Role-based sharing & collaboration
 *  ✅ Hearings, participants, team management
 *  ✅ Notes & attachments
 *  ✅ Analytics & export (CSV / JSON)
 * -------------------------------------------------------------
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
   🔒 ROLE SHORTCUTS
   ======================================================= */
const advocateRoles = ["advocate", "admin", "arbitrator"];
const generalRoles = ["advocate", "arbitrator", "admin", "client"];

/* =======================================================
   📊 ANALYTICS & EXPORT
   ======================================================= */

/**
 * @route   GET /api/cases/stats
 * @desc    Get case analytics summary (dashboard cards)
 * @access  Private (Advocate, Admin)
 */
router.get("/stats", protect, authorize("advocate", "admin"), getCaseStats);

/**
 * @route   GET /api/cases/export
 * @desc    Export all accessible cases (CSV or JSON)
 * @access  Private (Advocate, Admin)
 */
router.get("/export", protect, authorize("advocate", "admin"), exportCasesCSV);

/* =======================================================
   🧾 CORE CASE MANAGEMENT
   ======================================================= */

/**
 * @route   POST /api/cases
 * @desc    Create a new case
 * @access  Private (Advocate, Client)
 */
router.post("/", protect, authorize("advocate", "client"), createCase);

/**
 * @route   GET /api/cases
 * @desc    Fetch all accessible cases for logged-in user
 * @query   ?mine=true | ?category= | ?status= | ?q=
 * @access  Private
 */
router.get("/", protect, authorize(...generalRoles), getCases);

/**
 * @route   GET /api/cases/:id
 * @desc    Retrieve a case by ID (if user has access)
 * @access  Private
 */
router.get("/:id", protect, authorize(...generalRoles), getCaseById);

/**
 * @route   PUT /api/cases/:id
 * @desc    Update editable case fields
 * @access  Private (Advocate, Arbitrator, Admin)
 */
router.put("/:id", protect, authorize(...advocateRoles), updateCase);

/**
 * @route   PATCH /api/cases/:id/status
 * @desc    Update case status
 * @access  Private (Advocate, Arbitrator, Admin)
 */
router.patch("/:id/status", protect, authorize(...advocateRoles), updateCaseStatus);

/**
 * @route   DELETE /api/cases/:id
 * @desc    Soft-delete a case (mark as deleted)
 * @access  Private (Advocate, Admin)
 */
router.delete("/:id", protect, authorize("advocate", "admin"), softDeleteCase);

/**
 * @route   POST /api/cases/:id/restore
 * @desc    Restore a previously soft-deleted case
 * @access  Private (Admin)
 */
router.post("/:id/restore", protect, authorize("admin"), restoreCase);

/* =======================================================
   🤝 COLLABORATION & SHARING
   ======================================================= */

/**
 * @route   PATCH /api/cases/:id/share
 * @desc    Share a case with other users (adds to sharedWith[])
 * @access  Private (Advocate, Admin)
 */
router.patch("/:id/share", protect, authorize("advocate", "admin"), shareCase);

/**
 * @route   POST /api/cases/:id/notes
 * @desc    Add a note to a case (supports visibility levels)
 * @access  Private (Advocate, Admin, Client, Arbitrator)
 */
router.post("/:id/notes", protect, authorize(...generalRoles), addCaseNote);

/**
 * @route   POST /api/cases/:id/attachments
 * @desc    Add an attachment (metadata only — after upload)
 * @access  Private (Advocate, Admin, Client, Arbitrator)
 */
router.post("/:id/attachments", protect, authorize(...generalRoles), addAttachment);

/**
 * @route   DELETE /api/cases/:id/attachments
 * @desc    Remove attachment by file URL
 * @access  Private (Advocate, Admin, Arbitrator)
 */
router.delete("/:id/attachments", protect, authorize(...advocateRoles), deleteAttachment);

/* =======================================================
   ⚖️ HEARINGS
   ======================================================= */

/**
 * @route   POST /api/cases/:id/hearings
 * @desc    Add a hearing to a case
 * @access  Private (Advocate, Arbitrator, Admin)
 */
router.post("/:id/hearings", protect, authorize(...advocateRoles), addCaseHearing);

/* =======================================================
   👥 PARTICIPANTS
   ======================================================= */

/**
 * @route   POST /api/cases/:id/participants
 * @desc    Add a participant (client/respondent/witness)
 * @access  Private (Advocate, Arbitrator, Admin)
 */
router.post("/:id/participants", protect, authorize(...advocateRoles), addCaseParticipant);

/**
 * @route   DELETE /api/cases/:id/participants
 * @desc    Remove a participant from case
 * @access  Private (Advocate, Arbitrator, Admin)
 */
router.delete("/:id/participants", protect, authorize(...advocateRoles), removeCaseParticipant);

/* =======================================================
   👩‍⚖️ TEAM MANAGEMENT
   ======================================================= */

/**
 * @route   POST /api/cases/:id/team
 * @desc    Add a team member (assistant, paralegal, co-counsel)
 * @access  Private (Advocate, Admin)
 */
router.post("/:id/team", protect, authorize("advocate", "admin"), addTeamMember);

/**
 * @route   DELETE /api/cases/:id/team
 * @desc    Remove a team member from the case
 * @access  Private (Advocate, Admin)
 */
router.delete("/:id/team", protect, authorize("advocate", "admin"), removeTeamMember);

/* =======================================================
   🚀 EXPORT ROUTER
   ======================================================= */
export default router;
