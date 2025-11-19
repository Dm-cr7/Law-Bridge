// backend/routes/clientRoutes.js
/**
 * clientRoutes.js
 * -------------------------------------------------------------
 * CLIENT MANAGEMENT ROUTES (rewritten, production-ready)
 * -------------------------------------------------------------
 * Responsibilities:
 *  - Full CRUD for Client records (create, read, update, soft-delete, restore)
 *  - Role-based access control via protect() and authorize()
 *  - Lightweight request validation for create/update
 *  - Clear route ordering (non-dynamic before dynamic)
 *
 * IMPORTANT:
 *  - This file purposefully does not change other application logic.
 *  - Keep route signatures stable so controllers and frontend keep working.
 *
 * Routes:
 *  GET    /api/clients                -> list clients visible to user
 *  POST   /api/clients                -> create client (intake)
 *  GET    /api/clients/:id            -> get a single client
 *  PUT    /api/clients/:id            -> update client
 *  DELETE /api/clients/:id            -> soft-delete client
 *  PATCH  /api/clients/:id/restore    -> restore soft-deleted client
 *  PATCH  /api/clients/:id/share      -> share client with other users
 */

import express from "express";
import { body, param, query, validationResult } from "express-validator";

import {
  createClient,
  getClients,
  getClientById,
  updateClient,
  deleteClient,
  restoreClient,
  shareClient,
} from "../controllers/clientController.js";

import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

/* ----------------------
   Role Shortcuts
   ---------------------- */
const fullAccessRoles = ["advocate", "paralegal", "mediator", "arbitrator", "admin"];
const managementRoles = ["advocate", "paralegal", "admin"];

/* =======================================================
   Helper: validation result middleware
   ======================================================= */
const runValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array().map((e) => ({ field: e.param, msg: e.msg })),
    });
  }
  next();
};

/* =======================================================
   Public / Protected routes
   NOTE: Keep non-dynamic routes above dynamic ones
   ======================================================= */

/**
 * GET /api/clients
 * - Returns clients visible to the authenticated user.
 * - Query params supported:
 *    q (string)       -> search term (name/email/phone)
 *    page, limit      -> pagination
 *    includeDeleted   -> optional (admin only) include soft-deleted
 */
router.get(
  "/",
  protect,
  // allow main roles + clients themselves to call; controllers enforce returned set
  authorize(...fullAccessRoles, "client"),
  // optional request validation
  [
    query("q").optional().isString().trim().isLength({ min: 1 }).withMessage("q must be a non-empty string"),
    query("page").optional().isInt({ min: 1 }).toInt(),
    query("limit").optional().isInt({ min: 1, max: 200 }).toInt(),
    query("includeDeleted").optional().isBoolean().toBoolean(),
  ],
  runValidation,
  getClients
);

/**
 * POST /api/clients
 * - Create a new client (intake)
 * - Expected body: { name, email, phone?, address?, company?, requiredService?, caseDescription?, notes? }
 * - Controller will create or link User account as required.
 */
router.post(
  "/",
  protect,
  authorize(...fullAccessRoles),
  [
    body("name").exists().withMessage("name is required").isString().trim().isLength({ min: 2 }),
    body("email").exists().withMessage("email is required").isEmail().withMessage("valid email required").normalizeEmail(),
    body("phone").optional({ nullable: true }).isString().trim().isLength({ min: 7 }).withMessage("phone seems too short"),
    body("address").optional({ nullable: true }).isString().trim().isLength({ max: 300 }),
    body("company").optional({ nullable: true }).isString().trim().isLength({ max: 200 }),
    body("requiredService")
      .optional()
      .isIn(["advocate", "mediator", "arbitrator", "reconciliator", "other"])
      .withMessage("invalid requiredService"),
    body("caseDescription").optional({ nullable: true }).isString().trim().isLength({ max: 3000 }),
    body("notes").optional({ nullable: true }).isString().trim().isLength({ max: 2000 }),
  ],
  runValidation,
  createClient
);

/**
 * PATCH /api/clients/:id/restore
 * - Restore soft-deleted client
 * - Admin only
 */
router.patch(
  "/:id/restore",
  protect,
  authorize("admin"),
  [param("id").isMongoId().withMessage("Invalid client id")],
  runValidation,
  restoreClient
);

/**
 * PATCH /api/clients/:id/share
 * - Share a client with other internal users.
 * - Body: { userIds: [<userId>, ...], permission?: "view"|"comment"|"edit" }
 * - Only owner or admin may share; controller must enforce that.
 */
router.patch(
  "/:id/share",
  protect,
  authorize(...fullAccessRoles),
  [
    param("id").isMongoId().withMessage("Invalid client id"),
    body("userIds").isArray({ min: 1 }).withMessage("userIds must be a non-empty array"),
    body("userIds.*").isMongoId().withMessage("each userId must be a valid id"),
    body("permission").optional().isIn(["view", "comment", "edit"]).withMessage("invalid permission"),
  ],
  runValidation,
  shareClient
);

/**
 * GET /api/clients/:id
 * - Fetch single client record
 * - Access controlled in controller
 */
router.get(
  "/:id",
  protect,
  authorize(...fullAccessRoles, "client"),
  [param("id").isMongoId().withMessage("Invalid client id")],
  runValidation,
  getClientById
);

/**
 * PUT /api/clients/:id
 * - Update client fields; partial allowed
 * - Controller should verify access (owner/shared/admin)
 */
router.put(
  "/:id",
  protect,
  authorize(...fullAccessRoles),
  [
    param("id").isMongoId().withMessage("Invalid client id"),
    body("name").optional().isString().trim().isLength({ min: 2 }),
    body("email").optional().isEmail().normalizeEmail(),
    body("phone").optional({ nullable: true }).isString().trim(),
    body("address").optional({ nullable: true }).isString().trim().isLength({ max: 300 }),
    body("company").optional({ nullable: true }).isString().trim().isLength({ max: 200 }),
    body("requiredService").optional().isIn(["advocate", "mediator", "arbitrator", "reconciliator", "other"]),
    body("caseDescription").optional({ nullable: true }).isString().trim().isLength({ max: 3000 }),
    body("notes").optional({ nullable: true }).isString().trim().isLength({ max: 2000 }),
  ],
  runValidation,
  updateClient
);

/**
 * DELETE /api/clients/:id
 * - Soft delete
 * - Only managementRoles allowed (advocate, paralegal, admin)
 */
router.delete(
  "/:id",
  protect,
  authorize(...managementRoles),
  [param("id").isMongoId().withMessage("Invalid client id")],
  runValidation,
  deleteClient
);

export default router;
