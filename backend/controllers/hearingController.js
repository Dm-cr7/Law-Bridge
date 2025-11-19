// backend/controllers/hearingController.js
import mongoose from "mongoose";
import Hearing from "../models/Hearing.js";
import CaseModel from "../models/Case.js";
import asyncHandler from "../middleware/asyncHandler.js";

/**
 * Helper: safe io getter (avoid circular imports)
 */
function getIo(req) {
  try {
    return req.app && req.app.get && req.app.get("io");
  } catch (err) {
    return null;
  }
}

/**
 * Helper: emit to rooms (defensive)
 */
function emitToRooms(req, event, payload, rooms = []) {
  const io = getIo(req);
  if (!io) return;
  try {
    if (Array.isArray(rooms) && rooms.length) {
      rooms.forEach((r) => {
        if (r) io.to(r).emit(event, payload);
      });
    } else {
      io.emit(event, payload);
    }
  } catch (err) {
    // don't crash on emit failures
    console.warn("Emit failed:", err);
  }
}

/**
 * Create a new hearing
 * POST /api/hearings
 */
export const createHearing = asyncHandler(async (req, res) => {
  const {
    caseId,
    title,
    description,
    start,
    end,
    venue,
    meetingLink,
    participants = {},
    arbitration,
    meta,
  } = req.body;

  if (!caseId || !title || !start) {
    return res.status(400).json({ success: false, message: "caseId, title and start date/time are required." });
  }

  if (!mongoose.Types.ObjectId.isValid(caseId)) {
    return res.status(400).json({ success: false, message: "Invalid caseId" });
  }

  // validate date
  const startDate = new Date(start);
  if (isNaN(startDate)) return res.status(400).json({ success: false, message: "Invalid start date" });

  let endDate = null;
  if (end) {
    endDate = new Date(end);
    if (isNaN(endDate)) return res.status(400).json({ success: false, message: "Invalid end date" });
  }

  // ensure case exists
  const caseDoc = await CaseModel.findById(caseId).select("_id title");
  if (!caseDoc) return res.status(404).json({ success: false, message: "Case not found" });

  const hearing = await Hearing.create({
    case: caseId,
    arbitration: arbitration && mongoose.Types.ObjectId.isValid(arbitration) ? arbitration : null,
    title,
    description: description || "",
    start: startDate,
    end: endDate,
    venue: venue || "To be determined",
    meetingLink: meetingLink || null,
    participants: participants || {},
    createdBy: req.user._id,
    meta: meta || {},
  });

  // Emit to relevant rooms: case_{id}, arbitration_{id}, user_{creator} and each participant user_* room
  const rooms = [`case_${String(caseId)}`, `user_${String(req.user._id)}`];
  if (hearing.arbitration) rooms.push(`arbitration_${String(hearing.arbitration)}`);

  // add participant rooms (if any user ids present)
  const addParticipantRooms = (arr) => {
    if (!Array.isArray(arr)) return;
    arr.forEach((u) => {
      if (mongoose.Types.ObjectId.isValid(String(u))) rooms.push(`user_${String(u)}`);
    });
  };
  addParticipantRooms(hearing.participants?.advocates);
  addParticipantRooms(hearing.participants?.arbitrators);
  addParticipantRooms(hearing.participants?.clients);
  addParticipantRooms(hearing.participants?.respondents);

  emitToRooms(req, "hearing:new", hearing.toObject(), Array.from(new Set(rooms)));

  res.status(201).json({ success: true, data: hearing });
});

/**
 * List hearings (with pagination and filters)
 * GET /api/hearings
 */
export const getHearings = asyncHandler(async (req, res) => {
  const {
    caseId,
    arbitration,
    from,
    to,
    participant, // user id to filter by membership
    page = 1,
    limit = 50,
    upcoming,
    status,
    q, // free text on title/description
  } = req.query;

  const query = { deletedAt: null };

  if (caseId && mongoose.Types.ObjectId.isValid(caseId)) query.case = caseId;
  if (arbitration && mongoose.Types.ObjectId.isValid(arbitration)) query.arbitration = arbitration;
  if (status) query.status = status;

  if (from || to) {
    query.start = {};
    if (from) {
      const f = new Date(from);
      if (!isNaN(f)) query.start.$gte = f;
    }
    if (to) {
      const t = new Date(to);
      if (!isNaN(t)) query.start.$lte = t;
    }
  }

  if (upcoming === "true") {
    query.start = query.start || {};
    query.start.$gte = new Date();
  }

  if (participant && mongoose.Types.ObjectId.isValid(participant)) {
    // participant membership in any of the participant arrays
    query.$or = [
      { "participants.advocates": participant },
      { "participants.arbitrators": participant },
      { "participants.clients": participant },
      { "participants.respondents": participant },
    ];
  } else {
    // default: limit to hearings that include the requesting user or createdBy for non-admins
    if (!req.user || !String(req.user.role).toLowerCase().includes("admin")) {
      const uid = req.user && req.user._id;
      if (uid) {
        query.$or = [
          { "participants.advocates": uid },
          { "participants.arbitrators": uid },
          { "participants.clients": uid },
          { "participants.respondents": uid },
          { createdBy: uid },
        ];
      }
    }
  }

  if (q && typeof q === "string") {
    query.$text = { $search: q }; // requires text index on title/description if you want full text
  }

  const p = Math.max(1, parseInt(page, 10) || 1);
  const lim = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));

  const [items, total] = await Promise.all([
    Hearing.find(query)
      .sort({ start: 1 })
      .skip((p - 1) * lim)
      .limit(lim)
      .populate("case", "title status")
      .populate("participants.advocates participants.arbitrators participants.clients participants.respondents", "name email role")
      .lean(),
    Hearing.countDocuments(query),
  ]);

  res.json({ success: true, data: items, meta: { total, page: p, limit: lim } });
});

/**
 * Get single hearing by id
 * GET /api/hearings/:id
 */
export const getHearingById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: "Invalid id" });

  const hearing = await Hearing.findById(id)
    .populate("case", "title status")
    .populate("participants.advocates participants.arbitrators participants.clients participants.respondents", "name email role")
    .lean();

  if (!hearing || hearing.deletedAt) return res.status(404).json({ success: false, message: "Hearing not found" });

  // Optionally enforce access: only participants, creator, or admin can view
  const uid = req.user && String(req.user._id);
  const isParticipant =
    (hearing.participants?.advocates || []).some((x) => String(x) === uid) ||
    (hearing.participants?.arbitrators || []).some((x) => String(x) === uid) ||
    (hearing.participants?.clients || []).some((x) => String(x) === uid) ||
    (hearing.participants?.respondents || []).some((x) => String(x) === uid) ||
    String(hearing.createdBy) === uid;

  if (!isParticipant && !(req.user && String(req.user.role).toLowerCase().includes("admin"))) {
    return res.status(403).json({ success: false, message: "Not authorized to view this hearing" });
  }

  res.json({ success: true, data: hearing });
});

/**
 * Update hearing
 * PUT /api/hearings/:id
 */
export const updateHearing = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: "Invalid id" });

  const hearing = await Hearing.findById(id);
  if (!hearing || hearing.deletedAt) return res.status(404).json({ success: false, message: "Hearing not found" });

  // Basic authorization: only createdBy, participants, or admin can update
  const uid = req.user && String(req.user._id);
  const isParticipant =
    (hearing.participants?.advocates || []).some((x) => String(x) === uid) ||
    (hearing.participants?.arbitrators || []).some((x) => String(x) === uid) ||
    (hearing.participants?.clients || []).some((x) => String(x) === uid) ||
    (hearing.participants?.respondents || []).some((x) => String(x) === uid) ||
    String(hearing.createdBy) === uid;
  if (!isParticipant && !(req.user && String(req.user.role).toLowerCase().includes("admin"))) {
    return res.status(403).json({ success: false, message: "Not authorized to update this hearing" });
  }

  // Allowed updates
  const allowed = ["title", "description", "start", "end", "venue", "meetingLink", "status", "participants", "meta"];
  allowed.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(req.body, key)) {
      if (key === "start" || key === "end") {
        const d = req.body[key] ? new Date(req.body[key]) : null;
        if (d && !isNaN(d)) hearing[key] = d;
      } else {
        hearing[key] = req.body[key];
      }
    }
  });

  hearing.updatedBy = req.user._id;
  await hearing.save();

  // emit updates to rooms
  const rooms = [`case_${String(hearing.case)}`, `user_${String(hearing.createdBy)}`];
  if (hearing.arbitration) rooms.push(`arbitration_${String(hearing.arbitration)}`);
  const addParticipantRooms = (arr) => {
    if (!Array.isArray(arr)) return;
    arr.forEach((u) => {
      if (mongoose.Types.ObjectId.isValid(String(u))) rooms.push(`user_${String(u)}`);
    });
  };
  addParticipantRooms(hearing.participants?.advocates);
  addParticipantRooms(hearing.participants?.arbitrators);
  addParticipantRooms(hearing.participants?.clients);
  addParticipantRooms(hearing.participants?.respondents);

  emitToRooms(req, "hearing:update", hearing.toObject(), Array.from(new Set(rooms)));

  res.json({ success: true, data: hearing });
});

/**
 * Soft delete hearing
 * DELETE /api/hearings/:id
 */
export const deleteHearing = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: "Invalid id" });

  const hearing = await Hearing.findById(id);
  if (!hearing || hearing.deletedAt) return res.status(404).json({ success: false, message: "Hearing not found" });

  // Authorization: only creator or admin or advocate can soft delete
  const uid = req.user && String(req.user._id);
  const isCreator = String(hearing.createdBy) === uid;
  const isAdvocateOrAdmin = req.user && ["advocate", "admin", "arbitrator"].includes(String(req.user.role));

  if (!isCreator && !isAdvocateOrAdmin) {
    return res.status(403).json({ success: false, message: "Not authorized to delete this hearing" });
  }

  hearing.deletedAt = new Date();
  await hearing.save();

  emitToRooms(req, "hearing:deleted", { id: hearing._id }, [`case_${String(hearing.case)}`, `user_${String(hearing.createdBy)}`]);

  res.json({ success: true, message: "Hearing deleted (soft)" });
});

/**
 * Add a note to a hearing
 * POST /api/hearings/:id/notes
 */
export const addNote = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ success: false, message: "Note content required" });

  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: "Invalid id" });

  const hearing = await Hearing.findById(id);
  if (!hearing || hearing.deletedAt) return res.status(404).json({ success: false, message: "Hearing not found" });

  const note = { content: String(content).trim(), createdBy: req.user._id };
  hearing.notes.push(note);
  await hearing.save();

  // send note event
  emitToRooms(req, "hearing:note", { hearingId: hearing._id, note }, [`case_${String(hearing.case)}`, `user_${String(hearing.createdBy)}`]);

  res.status(201).json({ success: true, data: note });
});
