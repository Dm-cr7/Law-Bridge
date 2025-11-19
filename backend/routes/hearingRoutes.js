// backend/routes/hearingRoutes.js
import express from "express";
import {
  createHearing,
  getHearings,
  getHearingById,
  updateHearing,
  deleteHearing,
  addNote,
} from "../controllers/hearingController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";
import Hearing from "../models/Hearing.js"; // adjust path if needed

const router = express.Router();

/**
 * Helper: parse date input (YYYY-MM-DD OR ISO string OR epoch ms)
 */
function parseDateInput(val) {
  if (!val) return null;
  if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
    // treat as UTC date start
    const d = new Date(`${val}T00:00:00Z`);
    return isNaN(d.valueOf()) ? null : d;
  }
  if (/^\d+$/.test(String(val))) {
    const n = Number(val);
    const d = new Date(n);
    return isNaN(d.valueOf()) ? null : d;
  }
  // ISO / other parseable string
  const d = new Date(val);
  return isNaN(d.valueOf()) ? null : d;
}

/**
 * GET /api/hearings/calendar
 * Query params: start, end (YYYY-MM-DD | ISO string | epoch ms)
 * Protected route (requires authentication)
 */
router.get(
  "/calendar",
  protect,
  async (req, res, next) => {
    try {
      const { start, end } = req.query;

      if (!start || !end) {
        return res.status(400).json({ success: false, message: "Missing required query params: start and end" });
      }

      const s = parseDateInput(start);
      const e = parseDateInput(end);

      if (!s || !e) {
        return res.status(400).json({
          success: false,
          message: "Invalid date format. Accepts YYYY-MM-DD, ISO string, or milliseconds timestamp.",
        });
      }

      if (e < s) {
        return res.status(400).json({ success: false, message: "Invalid range: end must be on or after start." });
      }

      // optional: enforce sane maximum range (e.g., 1 year)
      const maxRangeMs = Number(process.env.HEARINGS_MAX_RANGE_MS || 1000 * 60 * 60 * 24 * 365);
      if (e - s > maxRangeMs) {
        return res.status(400).json({ success: false, message: "Requested date range too large." });
      }

      // Query: adapt fields to your schema - many setups have `start` or `date` fields.
      // This queries any hearings whose start/date falls within [s, e].
      const q = {
        $or: [
          { start: { $gte: s, $lte: e } },
          { date: { $gte: s, $lte: e } },
        ],
      };

      // If the user is not an admin, scope to their client/user if needed.
      // Example: if req.user.role === "advocate" restrict to their organization, etc.
      // (Uncomment and adapt as required)
      // if (req.user && req.user.role !== "admin") {
      //   q.organisationId = req.user.organisationId;
      // }

      const hearings = await Hearing.find(q).sort({ start: 1 }).lean().exec();

      return res.json({ success: true, data: hearings });
    } catch (err) {
      next(err);
    }
  }
);

// list (existing)
router.get("/", protect, authorize("advocate", "arbitrator", "client", "admin"), getHearings);

// create
router.post("/", protect, authorize("advocate", "arbitrator", "admin"), createHearing);

// single
router.get("/:id", protect, getHearingById);

// update
router.put("/:id", protect, authorize("advocate", "arbitrator", "admin"), updateHearing);

// delete (soft)
router.delete("/:id", protect, authorize("advocate", "admin"), deleteHearing);

// add note
router.post("/:id/notes", protect, authorize("advocate", "arbitrator", "client", "admin"), addNote);

export default router;
