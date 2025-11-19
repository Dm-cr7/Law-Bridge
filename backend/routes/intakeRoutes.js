// backend/routes/intakeRoutes.js
/**
 * intakeRoutes.js
 * -------------------------------------------------------------
 * Routes used by the Intake workflow (frontend /dashboard/intake)
 * -------------------------------------------------------------
 * Responsibilities:
 *  - Duplicate checks (by email / phone / name)
 *  - Dry-run preview (validate payload, return normalized preview without persisting)
 *  - Create client (delegates to clientController.createClient)
 *
 * Design notes:
 *  - File uploads are handled by the central uploadRoutes/uploadController.
 *    This routes file DOES NOT attempt to re-implement upload handling.
 *  - Use protect() + authorize() to guard endpoints.
 *  - Input validation via express-validator.
 *  - Do not change other controllers/middleware logic here.
 *
 * Routes:
 *  GET  /api/intake/duplicate?q=...         -> quick duplicate search
 *  POST /api/intake/preview                 -> returns validated preview (no DB write)
 *  POST /api/intake                         -> create client, calls controllers/clientController.createClient
 */

import express from "express";
import { query, body, validationResult } from "express-validator";
import mongoose from "mongoose";

import Client from "../models/Client.js";
import { createClient as createClientController } from "../controllers/clientController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

/* -------------------------
   Role shortcuts
   ------------------------- */
const fullAccessRoles = ["advocate", "paralegal", "mediator", "arbitrator", "admin"];

/* =======================================================
   Helper - validation runner
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
   GET /api/intake/duplicate?q=<term>
   Quick duplicate check by email, phone or name fragment
   Access: protected (advocate/paralegal/mediator/arbitrator/admin)
   Response: { success, matches: [ Client ] }
   ======================================================= */
router.get(
  "/duplicate",
  protect,
  authorize(...fullAccessRoles),
  [query("q").exists().withMessage("q (search term) is required").isString().trim().isLength({ min: 1 })],
  runValidation,
  async (req, res) => {
    try {
      const q = String(req.query.q || "").trim();
      // if q looks like an email -> search by exact email (case-insensitive)
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q);
      const isPhone = /^[+0-9\-\s]{7,20}$/.test(q);
      const filter = { deletedAt: null };

      if (isEmail) {
        filter.email = q.toLowerCase();
      } else if (isPhone) {
        // loose phone match
        filter.phone = { $regex: q.replace(/[^\d+]/g, ""), $options: "i" };
      } else {
        // name / partial
        const term = q.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
        filter.$or = [{ name: { $regex: term, $options: "i" } }, { email: { $regex: term, $options: "i" } }];
      }

      // limit matches to reasonable amount
      const matches = await Client.find(filter)
        .select("name email phone createdBy createdAt")
        .sort({ createdAt: -1 })
        .limit(15)
        .populate("createdBy", "name email role")
        .lean();

      return res.json({ success: true, matches });
    } catch (err) {
      console.error("❌ intake duplicate check error:", err);
      return res.status(500).json({ success: false, message: "Failed to run duplicate check", error: err.message });
    }
  }
);

/* =======================================================
   POST /api/intake/preview
   Validate incoming intake payload and return normalized preview
   (no DB writes). Useful for frontend showing final preview before submit.
   Access: protected (advocate/paralegal/mediator/arbitrator/admin)
   Body: { name, email, phone?, address?, company?, requiredService?, caseDescription?, notes? }
   ======================================================= */
router.post(
  "/preview",
  protect,
  authorize(...fullAccessRoles),
  [
    body("name").exists().withMessage("name is required").isString().trim().isLength({ min: 2 }),
    body("email").exists().withMessage("email is required").isEmail().withMessage("valid email required").normalizeEmail(),
    body("phone").optional({ nullable: true }).isString().trim(),
    body("address").optional({ nullable: true }).isString().trim().isLength({ max: 300 }),
    body("company").optional({ nullable: true }).isString().trim().isLength({ max: 200 }),
    body("requiredService").optional().isIn(["advocate", "mediator", "arbitrator", "reconciliator", "other"]),
    body("caseDescription").optional({ nullable: true }).isString().trim().isLength({ max: 3000 }),
    body("notes").optional({ nullable: true }).isString().trim().isLength({ max: 2000 }),
  ],
  runValidation,
  (req, res) => {
    try {
      // Create a normalized preview object; do not persist
      const preview = {
        name: String(req.body.name).trim(),
        email: String(req.body.email).trim().toLowerCase(),
        phone: req.body.phone || null,
        address: req.body.address || "",
        company: req.body.company || "",
        requiredService: req.body.requiredService || "advocate",
        caseDescription: req.body.caseDescription || "",
        notes: req.body.notes || "",
        createdBy: {
          _id: req.user._id,
          name: req.user.name,
          email: req.user.email,
          role: req.user.role,
        },
        attachments: req.files ? (req.files.map ? req.files.map((f) => ({ originalname: f.originalname, mimetype: f.mimetype, size: f.size })) : []) : [],
        previewAt: new Date(),
      };

      return res.json({ success: true, preview });
    } catch (err) {
      console.error("❌ intake preview error:", err);
      return res.status(500).json({ success: false, message: "Failed to generate preview", error: err.message });
    }
  }
);

/* =======================================================
   POST /api/intake
   Create a client intake record.
   Delegates to controllers/clientController.createClient so we keep
   creation logic centralized.
   Access: protected (advocate/paralegal/mediator/arbitrator/admin)
   Body: same as preview; files should be uploaded separately via uploadRoutes
   ======================================================= */
router.post(
  "/",
  protect,
  authorize(...fullAccessRoles),
  [
    body("name").exists().withMessage("name is required").isString().trim().isLength({ min: 2 }),
    body("email").exists().withMessage("email is required").isEmail().withMessage("valid email required").normalizeEmail(),
    body("phone").optional({ nullable: true }).isString().trim(),
    body("address").optional({ nullable: true }).isString().trim().isLength({ max: 300 }),
    body("company").optional({ nullable: true }).isString().trim().isLength({ max: 200 }),
    body("requiredService").optional().isIn(["advocate", "mediator", "arbitrator", "reconciliator", "other"]),
    body("caseDescription").optional({ nullable: true }).isString().trim().isLength({ max: 3000 }),
    body("notes").optional({ nullable: true }).isString().trim().isLength({ max: 2000 }),
    body("sharedWith").optional().isArray(),
    body("sharedWith.*").optional().isMongoId().withMessage("sharedWith items must be valid user ids"),
  ],
  runValidation,
  // delegate to the existing createClient controller to perform creation + socket emits
  async (req, res, next) => {
    try {
      // Note:
      // - Uploads should be handled by /api/upload (uploadRoutes) before calling this route,
      //   and the frontend should include uploaded file references (fileUrl/fileKey) in the body
      //   e.g. body.attachments = [{ name, fileUrl, fileKey, fileType, size }, ...]
      //
      // - createClient controller expects req.body to contain the client payload and req.user set by protect()
      //   so we can simply forward the same req/res to it.
      //
      // This wrapper exists to allow us to enrich req.body with any preview/attachments metadata if needed.
      if (req.body && req.body.attachments && typeof req.body.attachments === "string") {
        try {
          // If frontend sent attachments as JSON string, parse it
          req.body.attachments = JSON.parse(req.body.attachments);
        } catch (e) {
          // do nothing, leave as-is
        }
      }

      // Call existing controller directly
      return createClientController(req, res, next);
    } catch (err) {
      console.error("❌ intake create wrapper error:", err);
      return res.status(500).json({ success: false, message: "Failed to create intake", error: err.message });
    }
  }
);

export default router;
