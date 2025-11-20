// backend/routes/hearingRoutes.js
import express from "express";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";

import {
  createHearing,
  getHearings,
  getHearingById,
  updateHearing,
  deleteHearing,
  addNote,
  // the following may need to be implemented if missing in your controller:
  restoreHearing,
  exportHearingsCSV,
  addHearingParticipant,
  removeHearingParticipant,
  scheduleHearingReminder,
} from "../controllers/hearingController.js";

import { protect, authorize } from "../middleware/authMiddleware.js";
import Hearing from "../models/Hearing.js"; // keep for queries when needed

const router = express.Router();

/* -------------------- small helpers -------------------- */

/**
 * parseDateInput(val)
 * Accepts:
 *  - YYYY-MM-DD (interpreted as midnight UTC start)
 *  - ISO strings
 *  - milliseconds since epoch (string or number)
 * Returns a Date or null
 */
function parseDateInput(val) {
  if (!val && val !== 0) return null;
  // YYYY-MM-DD
  if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
    const d = new Date(`${val}T00:00:00Z`);
    return isNaN(d.valueOf()) ? null : d;
  }

  // integer ms
  if (/^\d+$/.test(String(val))) {
    const n = Number(val);
    const d = new Date(n);
    return isNaN(d.valueOf()) ? null : d;
  }

  // fallback ISO/other parseable string
  const d = new Date(val);
  return isNaN(d.valueOf()) ? null : d;
}

/**
 * validateObjectId middleware
 */
function validateObjectId(paramName = "id") {
  return (req, res, next) => {
    const val = req.params[paramName] || req.body[paramName] || req.query[paramName];
    if (!val) return next();
    if (!mongoose.Types.ObjectId.isValid(String(val))) {
      return res.status(400).json({ success: false, message: `Invalid ObjectId for ${paramName}` });
    }
    next();
  };
}

/* -------------------- rate limiters (lightweight) -------------------- */
const createLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  message: { success: false, message: "Too many hearing creation attempts, please wait a minute." },
});

const updateLimiter = rateLimit({
  windowMs: 30 * 1000, // 30s
  max: 30,
  message: { success: false, message: "Too many updates, slow down a bit." },
});

/* -------------------- Calendar endpoint (protected) -------------------- */
/**
 * GET /api/hearings/calendar
 * Required query params: start, end
 * Accepts: YYYY-MM-DD | ISO | epoch ms
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

      // Enforce a sane maximum range to protect the DB (configurable)
      const maxRangeMs = Number(process.env.HEARINGS_MAX_RANGE_MS || 1000 * 60 * 60 * 24 * 366); // ~1 year default
      if (e - s > maxRangeMs) {
        return res.status(400).json({ success: false, message: "Requested date range too large." });
      }

      // Query for hearings starting within [s, e] OR any legacy `date` field in that range.
      const q = {
        $and: [
          { deletedAt: null },
          {
            $or: [
              { start: { $gte: s, $lte: e } },
              { date: { $gte: s, $lte: e } }, // in case you still use `date`
            ],
          },
        ],
      };

      // Optionally restrict results for non-admins to hearings related to them
      if (req.user && !String(req.user.role).toLowerCase().includes("admin")) {
        const uid = String(req.user._id);
        q.$and.push({
          $or: [
            { "participants.advocates": uid },
            { "participants.arbitrators": uid },
            { "participants.clients": uid },
            { "participants.respondents": uid },
            { createdBy: uid },
            { "case": { $exists: true } }, // leave generic: frontend will further restrict if needed
          ],
        });
      }

      const hearings = await Hearing.find(q).sort({ start: 1 }).lean().exec();
      return res.json({ success: true, data: hearings });
    } catch (err) {
      next(err);
    }
  }
);

/* -------------------- core routes -------------------- */

/**
 * GET /api/hearings
 * Query: caseId, arbitration, from, to, participant, upcoming, status, q, page, limit
 */
router.get("/", protect, authorize("advocate", "arbitrator", "client", "admin"), getHearings);

/**
 * POST /api/hearings
 * Create a hearing. Protected to advocates/arbitrators/admins by default.
 */
router.post("/", protect, authorize("advocate", "arbitrator", "admin"), createLimiter, createHearing);

/**
 * GET /api/hearings/:id
 */
router.get("/:id", protect, validateObjectId("id"), getHearingById);

/**
 * PUT /api/hearings/:id
 * Full update/replacement semantics in your controller (or treat as PATCH)
 */
router.put("/:id", protect, authorize("advocate", "arbitrator", "admin"), validateObjectId("id"), updateLimiter, updateHearing);

/**
 * PATCH /api/hearings/:id   (alias to update for partial updates)
 */
router.patch("/:id", protect, authorize("advocate", "arbitrator", "admin"), validateObjectId("id"), updateLimiter, updateHearing);

/**
 * DELETE /api/hearings/:id
 * Soft delete
 */
router.delete("/:id", protect, authorize("advocate", "admin"), validateObjectId("id"), deleteHearing);

/**
 * POST /api/hearings/:id/restore
 * Restore a soft-deleted hearing (admin only)
 */
router.post("/:id/restore", protect, authorize("admin"), validateObjectId("id"), async (req, res, next) => {
  try {
    if (typeof restoreHearing !== "function") {
      return res.status(501).json({ success: false, message: "restoreHearing not implemented on server" });
    }
    return restoreHearing(req, res, next);
  } catch (err) {
    next(err);
  }
});

/* -------------------- notes -------------------- */
/**
 * POST /api/hearings/:id/notes
 */
router.post("/:id/notes", protect, authorize("advocate", "arbitrator", "client", "admin"), validateObjectId("id"), addNote);

/* -------------------- participants (helpers for UI) -------------------- */
/**
 * POST /api/hearings/:id/participants
 * Body: { group: 'advocates' | 'arbitrators' | 'clients' | 'respondents', userId }
 */
router.post("/:id/participants", protect, authorize("advocate", "arbitrator", "admin"), validateObjectId("id"), async (req, res, next) => {
  try {
    if (typeof addHearingParticipant === "function") {
      return addHearingParticipant(req, res, next);
    }
    // fallback: small default implementation if controller not provided:
    const { group, userId } = req.body;
    if (!group || !userId) return res.status(400).json({ success: false, message: "group and userId required" });
    if (!["advocates", "arbitrators", "clients", "respondents"].includes(group)) {
      return res.status(400).json({ success: false, message: "Invalid participant group" });
    }
    if (!mongoose.Types.ObjectId.isValid(userId)) return res.status(400).json({ success: false, message: "Invalid userId" });

    const hearing = await Hearing.findById(req.params.id);
    if (!hearing || hearing.deletedAt) return res.status(404).json({ success: false, message: "Hearing not found" });

    hearing.participants = hearing.participants || {};
    hearing.participants[group] = hearing.participants[group] || [];
    if (!hearing.participants[group].some((u) => String(u) === String(userId))) {
      hearing.participants[group].push(userId);
      hearing.updatedBy = req.user._id;
      await hearing.save();
    }

    return res.json({ success: true, message: "Participant added", data: hearing.participants });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/hearings/:id/participants
 * Body: { group, userId }
 */
router.delete("/:id/participants", protect, authorize("advocate", "arbitrator", "admin"), validateObjectId("id"), async (req, res, next) => {
  try {
    if (typeof removeHearingParticipant === "function") {
      return removeHearingParticipant(req, res, next);
    }

    const { group, userId } = req.body;
    if (!group || !userId) return res.status(400).json({ success: false, message: "group and userId required" });
    if (!["advocates", "arbitrators", "clients", "respondents"].includes(group)) {
      return res.status(400).json({ success: false, message: "Invalid participant group" });
    }
    if (!mongoose.Types.ObjectId.isValid(userId)) return res.status(400).json({ success: false, message: "Invalid userId" });

    const hearing = await Hearing.findById(req.params.id);
    if (!hearing || hearing.deletedAt) return res.status(404).json({ success: false, message: "Hearing not found" });

    hearing.participants = hearing.participants || {};
    hearing.participants[group] = (hearing.participants[group] || []).filter((u) => String(u) !== String(userId));
    hearing.updatedBy = req.user._id;
    await hearing.save();

    return res.json({ success: true, message: "Participant removed", data: hearing.participants });
  } catch (err) {
    next(err);
  }
});

/* -------------------- reminders / scheduling helpers -------------------- */
/**
 * POST /api/hearings/:id/reminder
 * Body: { enabled: boolean, minutesBefore: number }
 * Schedules/updates a reminder for a hearing. The actual worker to send notifications
 * should be implemented separately (job queue).
 */
router.post("/:id/reminder", protect, authorize("advocate", "arbitrator", "admin"), validateObjectId("id"), async (req, res, next) => {
  try {
    if (typeof scheduleHearingReminder === "function") {
      return scheduleHearingReminder(req, res, next);
    }

    const { enabled = true, minutesBefore = 30 } = req.body;
    if (typeof enabled !== "boolean") return res.status(400).json({ success: false, message: "enabled must be boolean" });
    if (typeof minutesBefore !== "number" || minutesBefore < 0) return res.status(400).json({ success: false, message: "invalid minutesBefore" });

    const hearing = await Hearing.findById(req.params.id);
    if (!hearing || hearing.deletedAt) return res.status(404).json({ success: false, message: "Hearing not found" });

    hearing.reminder = hearing.reminder || {};
    hearing.reminder.enabled = enabled;
    hearing.reminder.minutesBefore = minutesBefore;
    // nextReminderAt should be computed by a scheduler job (worker)
    hearing.reminder.nextReminderAt = enabled ? new Date(new Date(hearing.start).getTime() - minutesBefore * 60000) : null;
    hearing.updatedBy = req.user._id;
    await hearing.save();

    // TODO: enqueue a job to send the reminder at nextReminderAt (BullMQ/Agenda/etc.)
    return res.json({ success: true, message: "Reminder updated", data: hearing.reminder });
  } catch (err) {
    next(err);
  }
});

/* -------------------- export -------------------- */
/**
 * GET /api/hearings/export
 * Query: from, to, caseId, arbitration
 * Protected: advocate/admin
 */
router.get("/export", protect, authorize("advocate", "admin"), async (req, res, next) => {
  try {
    if (typeof exportHearingsCSV === "function") {
      return exportHearingsCSV(req, res, next);
    }
    // fallback: call controller.getHearings and convert basic CSV
    const fakeReq = { ...req, query: { ...req.query, page: 1, limit: 10000 } };
    const proxyRes = {
      jsonPayload: null,
      json(payload) {
        this.jsonPayload = payload;
      },
      status(code) {
        this._status = code;
        return this;
      },
      send() {
        return this;
      },
    };
    await getHearings(fakeReq, proxyRes, next);
    const payload = proxyRes.jsonPayload;
    const rows = (payload?.data || []).map((h) => ({
      id: h._id,
      title: h.title,
      start: h.start,
      end: h.end,
      case: h.case?.title || h.case,
      status: h.status,
    }));
    if (!rows.length) return res.json({ success: true, data: [], message: "No hearings to export" });

    // simple CSV
    const header = Object.keys(rows[0]).join(",");
    const csv = [header, ...rows.map((r) => Object.values(r).map((v) => `"${String(v || "").replace(/"/g, '""')}"`).join(","))].join("\n");
    res.header("Content-Type", "text/csv");
    res.attachment(`hearings_export_${Date.now()}.csv`);
    return res.send(csv);
  } catch (err) {
    next(err);
  }
});

export default router;
