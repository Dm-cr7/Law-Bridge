// backend/routes/sessionRoutes.js
import express from "express";
import {
  createSession,
  getSessions,
  getSessionById,
  updateSession,
  updateSessionStatus,
  deleteSession,
} from "../controllers/sessionController.js";

import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * Session Routes
 *
 * Notes:
 *  - protect middleware ensures route requires authenticated user
 *  - authorize(...) restricts by role where appropriate
 *
 * Endpoints:
 *  GET    /api/sessions                -> list sessions (scoped by role)
 *  POST   /api/sessions                -> create new session (mediator, admin)
 *  GET    /api/sessions/:id            -> get single session (authorized roles)
 *  PUT    /api/sessions/:id            -> update session (mediator, admin)
 *  PATCH  /api/sessions/:id/status     -> update status (mediator, admin)
 *  DELETE /api/sessions/:id            -> delete/cancel session (mediator, admin)
 */

/* Public-ish: requires auth — returns sessions scoped to user role */
router.get("/", protect, getSessions);

/* Create session: mediator or admin */
router.post("/", protect, authorize("mediator", "admin"), createSession);

/* Get single session: mediator, party (client), admin */
router.get("/:id", protect, authorize("mediator", "client", "admin"), getSessionById);

/* Update session: mediator (owner) or admin */
router.put("/:id", protect, authorize("mediator", "admin"), updateSession);

/* Update status (scheduled -> completed/cancelled): mediator or admin */
router.patch("/:id/status", protect, authorize("mediator", "admin"), updateSessionStatus);

/* Delete/cancel session: mediator or admin */
router.delete("/:id", protect, authorize("mediator", "admin"), deleteSession);

export default router;
