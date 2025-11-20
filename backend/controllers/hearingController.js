// backend/controllers/hearingController.js
import mongoose from "mongoose";
import Hearing from "../models/Hearing.js";
import CaseModel from "../models/Case.js";
import asyncHandler from "../middleware/asyncHandler.js";
import { Parser } from "json2csv";

/* ---------------------- Helpers ---------------------- */

/**
 * getIo(req) - defensive socket getter
 */
function getIo(req) {
  try {
    return req.app && typeof req.app.get === "function" ? req.app.get("io") : null;
  } catch {
    return null;
  }
}

/**
 * emitToRooms(req, event, payload, rooms)
 * - rooms: array of strings; if omitted emits globally
 */
function emitToRooms(req, event, payload, rooms = []) {
  const io = getIo(req);
  if (!io) return;
  try {
    if (Array.isArray(rooms) && rooms.length) {
      rooms.forEach((r) => {
        try {
          if (r && typeof io.to === "function") io.to(r).emit(event, payload);
        } catch (e) {
          // ignore single-room emit failures
        }
      });
    } else {
      io.emit(event, payload);
    }
  } catch (err) {
    console.warn("Emit failed:", err);
  }
}

/**
 * buildRoomsFromHearing(hearing)
 * - returns array of unique room ids to notify
 */
function buildRoomsFromHearing(hearing) {
  const rooms = new Set();
  if (!hearing) return [];
  try {
    if (hearing.case) rooms.add(`case_${String(hearing.case)}`);
    if (hearing.arbitration) rooms.add(`arbitration_${String(hearing.arbitration)}`);
    if (hearing.createdBy) rooms.add(`user_${String(hearing.createdBy)}`);

    const addMembers = (arr) => {
      if (!Array.isArray(arr)) return;
      arr.forEach((u) => {
        if (u && mongoose.Types.ObjectId.isValid(String(u))) rooms.add(`user_${String(u)}`);
      });
    };

    const parts = hearing.participants || {};
    addMembers(parts.advocates);
    addMembers(parts.arbitrators);
    addMembers(parts.clients);
    addMembers(parts.respondents);
  } catch (err) {
    // ignore
  }
  return Array.from(rooms);
}

/* ---------------------- Controller actions ---------------------- */

/**
 * CREATE HEARING
 * POST /api/hearings
 */
export const createHearing = asyncHandler(async (req, res) => {
  const {
    caseId,
    title,
    description = "",
    start,
    end,
    venue,
    meetingLink,
    participants = {},
    arbitration,
    recurrence = null,
    reminder = null,
    meta = {},
    status = "scheduled",
  } = req.body;

  if (!caseId || !title || !start) {
    return res.status(400).json({ success: false, message: "caseId, title and start date/time are required." });
  }
  if (!mongoose.Types.ObjectId.isValid(caseId)) {
    return res.status(400).json({ success: false, message: "Invalid caseId" });
  }

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

  const hearingPayload = {
    case: caseId,
    title: String(title).trim(),
    description: String(description || ""),
    start: startDate,
    end: endDate,
    venue: venue || "To be determined",
    meetingLink: meetingLink || null,
    participants: participants || {},
    arbitration: arbitration && mongoose.Types.ObjectId.isValid(arbitration) ? arbitration : null,
    recurrence: recurrence || { freq: "none", interval: 1 },
    reminder: reminder || { enabled: false, minutesBefore: 30 },
    meta: meta || {},
    createdBy: req.user._id,
    status: status || "scheduled",
  };

  const created = await Hearing.create(hearingPayload);

  // For legacy compatibility, try to attach to Case.hearings via model helper if it exists
  try {
    const c = await CaseModel.findById(caseId);
    if (c && typeof c.addHearing === "function") {
      await c.addHearing({ date: created.start, title: created.title, description: created.description }, req.user._id);
    }
  } catch (err) {
    // non-fatal
    console.warn("Failed to attach hearing to Case.hearings:", err?.message || err);
  }

  const populated = await Hearing.findById(created._id)
    .populate("case", "title caseNumber")
    .populate("participants.advocates participants.arbitrators participants.clients participants.respondents", "name email role")
    .populate("createdBy", "name email role")
    .lean();

  // Notify interested rooms
  const rooms = buildRoomsFromHearing(populated);
  emitToRooms(req, "hearing:new", populated, rooms);

  res.status(201).json({ success: true, data: populated });
});

/**
 * GET HEARINGS (list / calendar)
 * GET /api/hearings
 */
export const getHearings = asyncHandler(async (req, res) => {
  const {
    caseId,
    arbitration,
    from,
    to,
    participant,
    upcoming,
    status,
    q,
    page = 1,
    limit = 50,
    forCalendar = false,
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

  if (String(upcoming) === "true") {
    query.start = query.start || {};
    query.start.$gte = new Date();
  }

  if (participant && mongoose.Types.ObjectId.isValid(participant)) {
    query.$or = [
      { "participants.advocates": participant },
      { "participants.arbitrators": participant },
      { "participants.clients": participant },
      { "participants.respondents": participant },
    ];
  } else {
    // limit results for non-admins to hearings they are related to
    if (req.user && !String(req.user.role).toLowerCase().includes("admin")) {
      const uid = String(req.user._id);
      query.$or = [
        { "participants.advocates": uid },
        { "participants.arbitrators": uid },
        { "participants.clients": uid },
        { "participants.respondents": uid },
        { createdBy: uid },
      ];
    }
  }

  if (q && typeof q === "string") {
    query.$text = { $search: q };
  }

  const p = Math.max(1, parseInt(page, 10) || 1);
  const lim = Math.min(1000, Math.max(1, parseInt(limit, 10) || 50));

  const [items, total] = await Promise.all([
    Hearing.find(query)
      .sort({ start: 1 })
      .skip((p - 1) * lim)
      .limit(lim)
      .populate("case", "title caseNumber")
      .populate("participants.advocates participants.arbitrators participants.clients participants.respondents", "name email role")
      .lean(),
    Hearing.countDocuments(query),
  ]);

  // calendar minimal shape
  if (forCalendar === "true" || req.path?.includes("/calendar")) {
    const events = items.map((h) => ({
      id: h._id,
      title: h.title,
      start: h.start,
      end: h.end,
      extendedProps: { case: h.case, status: h.status, raw: h },
    }));
    return res.json({ success: true, data: events, meta: { total, page: p, limit: lim } });
  }

  res.json({ success: true, data: items, meta: { total, page: p, limit: lim } });
});

/**
 * GET BY ID
 * GET /api/hearings/:id
 */
export const getHearingById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: "Invalid id" });

  const hearing = await Hearing.findById(id)
    .populate("case", "title caseNumber")
    .populate("participants.advocates participants.arbitrators participants.clients participants.respondents", "name email role")
    .populate("createdBy updatedBy", "name email role")
    .lean();

  if (!hearing || hearing.deletedAt) return res.status(404).json({ success: false, message: "Hearing not found" });

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
 * UPDATE (PATCH/PUT)
 * PATCH /api/hearings/:id
 */
export const updateHearing = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: "Invalid id" });

  const hearing = await Hearing.findById(id);
  if (!hearing || hearing.deletedAt) return res.status(404).json({ success: false, message: "Hearing not found" });

  const uid = req.user && String(req.user._id);
  const isParticipant =
    (hearing.participants?.advocates || []).some((x) => String(x) === uid) ||
    (hearing.participants?.arbitrators || []).some((x) => String(x) === uid) ||
    (hearing.participants?.clients || []).some((x) => String(x) === uid) ||
    (hearing.participants?.respondents || []).some((x) => String(x) === uid) ||
    String(hearing.createdBy) === uid;

  const role = req.user && String(req.user.role).toLowerCase();
  const privileged = req.user && ["admin", "advocate", "arbitrator"].includes(role);

  if (!isParticipant && !privileged) {
    return res.status(403).json({ success: false, message: "Not authorized to update this hearing" });
  }

  const allowed = ["title", "description", "start", "end", "venue", "meetingLink", "status", "participants", "meta", "recurrence", "reminder"];
  allowed.forEach((k) => {
    if (Object.prototype.hasOwnProperty.call(req.body, k)) {
      if (k === "start" || k === "end") {
        const d = req.body[k] ? new Date(req.body[k]) : null;
        if (d && !isNaN(d)) hearing[k] = d;
      } else {
        hearing[k] = req.body[k];
      }
    }
  });

  hearing.updatedBy = req.user._id;
  await hearing.save();

  const populated = await Hearing.findById(id)
    .populate("case", "title caseNumber")
    .populate("participants.advocates participants.arbitrators participants.clients participants.respondents", "name email role")
    .populate("createdBy updatedBy", "name email role")
    .lean();

  const rooms = buildRoomsFromHearing(populated);
  emitToRooms(req, "hearing:update", populated, rooms);

  res.json({ success: true, data: populated });
});

/**
 * SOFT DELETE
 * DELETE /api/hearings/:id
 */
export const deleteHearing = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: "Invalid id" });

  const hearing = await Hearing.findById(id);
  if (!hearing || hearing.deletedAt) return res.status(404).json({ success: false, message: "Hearing not found" });

  const uid = req.user && String(req.user._id);
  const isCreator = String(hearing.createdBy) === uid;
  const role = req.user && String(req.user.role).toLowerCase();
  const isPrivileged = req.user && ["admin", "advocate", "arbitrator"].includes(role);

  if (!isCreator && !isPrivileged) {
    return res.status(403).json({ success: false, message: "Not authorized to delete this hearing" });
  }

  hearing.deletedAt = new Date();
  hearing.updatedBy = req.user._id;
  await hearing.save();

  const rooms = buildRoomsFromHearing(hearing);
  emitToRooms(req, "hearing:deleted", { id: hearing._id }, rooms);

  res.json({ success: true, message: "Hearing soft-deleted" });
});

/**
 * RESTORE hearing (admin-only)
 * POST /api/hearings/:id/restore
 */
export const restoreHearing = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: "Invalid id" });

  const hearing = await Hearing.findById(id);
  if (!hearing) return res.status(404).json({ success: false, message: "Hearing not found" });

  if (!(req.user && String(req.user.role).toLowerCase().includes("admin"))) {
    return res.status(403).json({ success: false, message: "Only admins can restore hearings" });
  }

  hearing.deletedAt = null;
  hearing.updatedBy = req.user._id;
  await hearing.save();

  const rooms = buildRoomsFromHearing(hearing);
  emitToRooms(req, "hearing:restored", hearing.toObject(), rooms);

  res.json({ success: true, data: hearing });
});

/**
 * ADD NOTE
 * POST /api/hearings/:id/notes
 *
 * NOTE: Hearing model in your repo didn't include an instance addNote helper,
 * so we implement note push here and save. If you'd prefer, add an instance
 * method on the Hearing model and call that instead.
 */
export const addNote = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;
  if (!content || !String(content).trim()) return res.status(400).json({ success: false, message: "Note content required" });
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: "Invalid id" });

  const hearing = await Hearing.findById(id);
  if (!hearing || hearing.deletedAt) return res.status(404).json({ success: false, message: "Hearing not found" });

  // Authorization: only participants/creator/admin can add note
  const uid = req.user && String(req.user._id);
  const isParticipant =
    (hearing.participants?.advocates || []).some((x) => String(x) === uid) ||
    (hearing.participants?.arbitrators || []).some((x) => String(x) === uid) ||
    (hearing.participants?.clients || []).some((x) => String(x) === uid) ||
    (hearing.participants?.respondents || []).some((x) => String(x) === uid) ||
    String(hearing.createdBy) === uid;

  if (!isParticipant && !(req.user && String(req.user.role).toLowerCase().includes("admin"))) {
    return res.status(403).json({ success: false, message: "Not authorized to add note to this hearing" });
  }

  const note = { content: String(content).trim(), createdBy: req.user._id, createdAt: new Date() };
  hearing.notes = hearing.notes || [];
  hearing.notes.push(note);
  hearing.updatedBy = req.user._id;
  await hearing.save();

  const rooms = buildRoomsFromHearing(hearing);
  emitToRooms(req, "hearing:note", { hearingId: hearing._id, note }, rooms);

  res.status(201).json({ success: true, data: note });
});

/**
 * EXPORT CSV
 * GET /api/hearings/export
 */
export const exportHearingsCSV = asyncHandler(async (req, res) => {
  const { from, to, caseId, arbitration } = req.query;
  const query = { deletedAt: null };
  if (caseId && mongoose.Types.ObjectId.isValid(caseId)) query.case = caseId;
  if (arbitration && mongoose.Types.ObjectId.isValid(arbitration)) query.arbitration = arbitration;
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

  const list = await Hearing.find(query).populate("case createdBy").lean();

  const rows = list.map((h) => ({
    id: h._id,
    title: h.title,
    caseNumber: h.case?.caseNumber || "",
    caseTitle: h.case?.title || "",
    start: h.start ? new Date(h.start).toISOString() : "",
    end: h.end ? new Date(h.end).toISOString() : "",
    venue: h.venue || h.meetingLink || "",
    status: h.status,
    createdBy: h.createdBy?.email || "",
  }));

  if (!rows.length) {
    return res.status(200).json({ success: true, data: [], message: "No hearings found for the requested filter." });
  }

  try {
    const fields = Object.keys(rows[0]);
    const parser = new Parser({ fields });
    const csv = parser.parse(rows);
    res.header("Content-Type", "text/csv");
    res.attachment(`hearings_export_${Date.now()}.csv`);
    return res.send(csv);
  } catch (err) {
    // fallback CSV serializer
    const header = Object.keys(rows[0]).join(",");
    const csv = [header, ...rows.map((r) => Object.values(r).map((v) => `"${String(v || "").replace(/"/g, '""')}"`).join(","))].join("\n");
    res.header("Content-Type", "text/csv");
    res.attachment(`hearings_export_${Date.now()}.csv`);
    return res.send(csv);
  }
});

/* ---------------------- participant helpers ---------------------- */

/**
 * addHearingParticipant(req,res)
 * Body: { group: 'advocates'|'arbitrators'|'clients'|'respondents', userId }
 */
export const addHearingParticipant = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { group, userId } = req.body;
  if (!group || !userId) return res.status(400).json({ success: false, message: "group and userId required" });
  if (!["advocates", "arbitrators", "clients", "respondents"].includes(group)) {
    return res.status(400).json({ success: false, message: "Invalid participant group" });
  }
  if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ success: false, message: "Invalid id or userId" });
  }

  const hearing = await Hearing.findById(id);
  if (!hearing || hearing.deletedAt) return res.status(404).json({ success: false, message: "Hearing not found" });

  hearing.participants = hearing.participants || {};
  hearing.participants[group] = hearing.participants[group] || [];
  if (!hearing.participants[group].some((u) => String(u) === String(userId))) {
    hearing.participants[group].push(userId);
    hearing.updatedBy = req.user._id;
    await hearing.save();

    const populated = await Hearing.findById(id)
      .populate("participants.advocates participants.arbitrators participants.clients participants.respondents", "name email role")
      .lean();

    // emit participant added
    const rooms = buildRoomsFromHearing(populated);
    emitToRooms(req, "hearing:participantAdded", { hearingId: id, group, userId }, rooms);

    return res.json({ success: true, message: "Participant added", data: populated.participants });
  }

  res.status(200).json({ success: true, message: "Participant already present", data: hearing.participants });
});

/**
 * removeHearingParticipant(req,res)
 * Body: { group, userId }
 */
export const removeHearingParticipant = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { group, userId } = req.body;
  if (!group || !userId) return res.status(400).json({ success: false, message: "group and userId required" });
  if (!["advocates", "arbitrators", "clients", "respondents"].includes(group)) {
    return res.status(400).json({ success: false, message: "Invalid participant group" });
  }
  if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ success: false, message: "Invalid id or userId" });
  }

  const hearing = await Hearing.findById(id);
  if (!hearing || hearing.deletedAt) return res.status(404).json({ success: false, message: "Hearing not found" });

  hearing.participants = hearing.participants || {};
  hearing.participants[group] = (hearing.participants[group] || []).filter((u) => String(u) !== String(userId));
  hearing.updatedBy = req.user._id;
  await hearing.save();

  const populated = await Hearing.findById(id)
    .populate("participants.advocates participants.arbitrators participants.clients participants.respondents", "name email role")
    .lean();

  const rooms = buildRoomsFromHearing(populated);
  emitToRooms(req, "hearing:participantRemoved", { hearingId: id, group, userId }, rooms);

  res.json({ success: true, message: "Participant removed", data: populated.participants });
});

/* ---------------------- reminder scheduling (placeholder) ---------------------- */

/**
 * scheduleHearingReminder(req,res)
 * Body: { enabled:boolean, minutesBefore:number }
 *
 * NOTE: This only stores reminder config on the hearing. Integrate a worker
 * (BullMQ, Agenda, etc.) to actually enqueue/send reminders at hearing.reminder.nextReminderAt.
 */
export const scheduleHearingReminder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { enabled = true, minutesBefore = 30 } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: "Invalid id" });
  const hearing = await Hearing.findById(id);
  if (!hearing || hearing.deletedAt) return res.status(404).json({ success: false, message: "Hearing not found" });

  hearing.reminder = hearing.reminder || {};
  hearing.reminder.enabled = Boolean(enabled);
  hearing.reminder.minutesBefore = Number(minutesBefore) || 30;
  hearing.reminder.nextReminderAt = hearing.reminder.enabled ? new Date(new Date(hearing.start).getTime() - hearing.reminder.minutesBefore * 60000) : null;
  hearing.updatedBy = req.user._id;
  await hearing.save();

  // TODO: enqueue a background job here to dispatch the reminder at nextReminderAt
  // Example: queue.add('hearing:reminder', { hearingId: id, ... }, { delay: nextReminderAt - Date.now() })

  const rooms = buildRoomsFromHearing(hearing);
  emitToRooms(req, "hearing:reminderUpdated", { hearingId: id, reminder: hearing.reminder }, rooms);

  res.json({ success: true, message: "Reminder updated", data: hearing.reminder });
});
