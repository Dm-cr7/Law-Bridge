// backend/controllers/caseController.js
import mongoose from "mongoose";
import Case from "../models/Case.js";
import User from "../models/User.js";
import { emitSocketEvent } from "../utils/socketEmitter.js";
import asyncHandler from "../middleware/asyncHandler.js";
import { Parser } from "json2csv";

/**
 * Case Controller (enhanced)
 *
 * Highlights:
 * - createCase supports optional `initialHearing` (single) or `hearings` (array)
 * - Uses Case model helpers: addHearing, setStatus, updateCaseFields, shareWith, etc.
 * - Emits consistent socket events to rooms derived by getCaseRooms()
 * - Defensive validation for ObjectIds and required fields
 * - Clear history entries for major actions (create/update/status changes)
 */

/* ----------------------- helper: getCaseRooms ----------------------- */
/**
 * Collects user IDs relevant to a case for emitting socket events.
 * Accepts either a case document (populated or not) or a plain object.
 */
const getCaseRooms = (caseDoc) => {
  const ids = new Set();
  [
    caseDoc.filedBy,
    caseDoc.createdBy,
    caseDoc.assignedTo,
    ...(caseDoc.sharedWith || []),
    ...(caseDoc.participants || []),
    ...(caseDoc.team?.map((t) => t.user) || []),
  ]
    .filter(Boolean)
    .forEach((id) => ids.add(String(id)));
  return Array.from(ids);
};

/* ------------------------------------------------------------------ */
/* ========================= CREATE CASE ============================ */
/* ------------------------------------------------------------------ */
/**
 * POST /api/cases
 * Body may include:
 *  - title (required)
 *  - description
 *  - clientId, respondentId
 *  - category, priority, attachments, sharedWith, court, jurisdiction
 *  - initialHearing: { date, title, description, outcome } (optional single hearing)
 *  - hearings: [ { date, title, description, outcome } ] (optional multiple)
 */
export const createCase = asyncHandler(async (req, res) => {
  const actorId = req.user?._id;
  if (!actorId) return res.status(401).json({ success: false, message: "Unauthorized" });

  const {
    title,
    description,
    clientId,
    respondentId,
    priority,
    attachments,
    sharedWith,
    category,
    court,
    jurisdiction,
    initialHearing,
    hearings,
  } = req.body;

  if (!title || !String(title).trim()) {
    return res.status(400).json({ success: false, message: "Case title is required" });
  }

  // Validate object ids if provided
  const safeClient = clientId && mongoose.isValidObjectId(clientId) ? clientId : null;
  const safeRespondent = respondentId && mongoose.isValidObjectId(respondentId) ? respondentId : null;

  const formattedAttachments = Array.isArray(attachments)
    ? attachments.map((a) =>
        typeof a === "string"
          ? { name: a.split("/").pop(), fileUrl: a }
          : { name: a.name, fileUrl: a.fileUrl || a.url, fileType: a.fileType, size: a.size }
      )
    : [];

  const casePayload = {
    title: String(title).trim(),
    description: description ? String(description).trim() : "",
    filedBy: actorId,
    client: safeClient,
    respondent: safeRespondent,
    sharedWith: Array.isArray(sharedWith) ? sharedWith : sharedWith ? [sharedWith] : [],
    priority: priority || "medium",
    category: category || "civil",
    court: court?.trim() || "",
    jurisdiction: jurisdiction?.trim() || "",
    status: "filed",
    filedAt: new Date(),
    attachments: formattedAttachments,
    createdBy: actorId,
  };

  // Create case document
  const newCase = await Case.create(casePayload);

  // Optionally attach initial hearing or multiple hearings
  let addedHearings = [];
  try {
    // initialHearing (single)
    if (initialHearing && (initialHearing.date || initialHearing.title)) {
      // addHearing handles validation and persistence
      const h = await newCase.addHearing(
        {
          date: initialHearing.date,
          title: initialHearing.title || "Hearing",
          description: initialHearing.description || "",
          outcome: initialHearing.outcome || "",
        },
        actorId
      );
      addedHearings.push(h);
      // Set status to hearing_scheduled using model helper to keep history consistent
      await newCase.setStatus(actorId, "hearing_scheduled");
    }

    // hearings array (multiple)
    if (Array.isArray(hearings) && hearings.length) {
      for (const hObj of hearings) {
        if (hObj && (hObj.date || hObj.title)) {
          try {
            const h = await newCase.addHearing(
              {
                date: hObj.date,
                title: hObj.title || "Hearing",
                description: hObj.description || "",
                outcome: hObj.outcome || "",
              },
              actorId
            );
            addedHearings.push(h);
          } catch (errInner) {
            // skip invalid hearing but continue
            console.warn("createCase: invalid hearing skipped", errInner);
          }
        }
      }
      if (addedHearings.length) {
        await newCase.setStatus(actorId, "hearing_scheduled");
      }
    }
  } catch (err) {
    // don't rollback case creation; just log and proceed — frontend can show warning
    console.warn("createCase: error attaching hearings (non-fatal):", err);
  }

  // Populate before emitting/returning
  const populated = await Case.findById(newCase._id).populate(
    "filedBy client respondent sharedWith assignedTo"
  );

  // Emit case:new to relevant rooms
  emitSocketEvent("case:new", getCaseRooms(populated), populated);

  // Emit case:hearing for each added hearing
  if (addedHearings.length) {
    for (const ah of addedHearings) {
      emitSocketEvent("case:hearing", getCaseRooms(populated), { caseId: populated._id, hearing: ah });
    }
  }

  res.status(201).json({ success: true, data: populated });
});

/* ------------------------------------------------------------------ */
/* ============================ GET CASES ============================ */
/* ------------------------------------------------------------------ */
export const getCases = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const userRole = req.user.role;
  const { category, status, priority, q, page = 1, limit = 50 } = req.query;

  const baseQuery = { isDeleted: false };
  const accessQuery =
    userRole === "admin"
      ? {}
      : {
          $or: [
            { filedBy: userId },
            { createdBy: userId },
            { assignedTo: userId },
            { sharedWith: userId },
            { participants: userId },
            { "team.user": userId },
          ],
        };

  const filters = { ...baseQuery, ...accessQuery };
  if (category) filters.category = category;
  if (status) filters.status = status;
  if (priority) filters.priority = priority;
  if (q) filters.$text = { $search: q };

  const skip = (Math.max(Number(page), 1) - 1) * Number(limit);
  const [cases, total] = await Promise.all([
    Case.find(filters)
      .populate("filedBy client respondent sharedWith assignedTo")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Case.countDocuments(filters),
  ]);

  res.json({
    success: true,
    data: cases,
    meta: { total, page: Number(page), limit: Number(limit) },
  });
});

/* ------------------------------------------------------------------ */
/* ========================= GET CASE BY ID ========================= */
/* ------------------------------------------------------------------ */
export const getCaseById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: "Invalid case id" });

  const caseDoc = await Case.findByAccess(userId, id);
  if (!caseDoc) return res.status(404).json({ success: false, message: "Case not found or access denied" });

  res.json({ success: true, data: caseDoc });
});

/* ------------------------------------------------------------------ */
/* ============================ UPDATE CASE ========================= */
/* ------------------------------------------------------------------ */
/**
 * PUT /api/cases/:id
 * - Uses Case.updateCaseFields to apply safe updates and record history.
 * - If status present in updates, uses caseDoc.setStatus(...) to centralize status behavior.
 */
export const updateCase = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updater = req.user._id;
  const role = req.user.role;
  const updates = req.body || {};

  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: "Invalid case id" });

  const caseDoc = await Case.findById(id);
  if (!caseDoc) return res.status(404).json({ success: false, message: "Case not found" });

  const isOwner = caseDoc.filedBy?.equals(updater);
  const isAssigned = caseDoc.assignedTo?.equals(updater);
  if (!isOwner && role !== "admin" && !isAssigned)
    return res.status(403).json({ success: false, message: "Permission denied" });

  // If the update includes a status change, use the model's setStatus
  if (Object.prototype.hasOwnProperty.call(updates, "status")) {
    try {
      await caseDoc.setStatus(updater, updates.status);
      // Remove status from updates so updateCaseFields doesn't reapply it
      delete updates.status;
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message || "Invalid status transition" });
    }
  }

  // Use updateCaseFields to apply allowed updates and keep history
  const saved = await caseDoc.updateCaseFields(updates, updater);

  // Populate for response & emit
  const populated = await Case.findById(saved._id).populate("filedBy client respondent sharedWith assignedTo");

  emitSocketEvent("case:updated", getCaseRooms(populated), populated);

  res.json({ success: true, data: populated });
});

/* ------------------------------------------------------------------ */
/* ========================= UPDATE CASE STATUS ===================== */
/* ------------------------------------------------------------------ */
/**
 * PATCH /api/cases/:id/status
 * - Body: { status: "paused" | "closed" | ... }
 * - Uses Case.setStatus to centralize transitions
 */
export const updateCaseStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const userId = req.user._id;

  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: "Invalid case id" });
  if (!status) return res.status(400).json({ success: false, message: "Status is required" });

  const caseDoc = await Case.findById(id);
  if (!caseDoc) return res.status(404).json({ success: false, message: "Case not found" });

  try {
    await caseDoc.setStatus(userId, status);
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message || "Failed to set status" });
  }

  // emit the status change (send minimal payload)
  emitSocketEvent("case:status", getCaseRooms(caseDoc), { caseId: id, status });

  res.json({ success: true, data: caseDoc });
});

/* ------------------------------------------------------------------ */
/* ============================== SHARE ============================= */
/* ------------------------------------------------------------------ */
export const shareCase = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { userIdToShare, permission = "view" } = req.body;
  const sharedById = req.user._id;

  if (!userIdToShare) return res.status(400).json({ success: false, message: "userIdToShare is required" });
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: "Invalid case id" });

  const caseDoc = await Case.findById(id);
  if (!caseDoc) return res.status(404).json({ success: false, message: "Case not found" });

  await caseDoc.shareWith(userIdToShare, sharedById, permission);
  await caseDoc.save();

  const populated = await Case.findById(id).populate("filedBy sharedWith client respondent assignedTo");

  emitSocketEvent("case:shared", getCaseRooms(caseDoc), {
    caseId: id,
    sharedWith: userIdToShare,
    permission,
  });

  res.json({
    success: true,
    message: `Case shared successfully with user ${userIdToShare}`,
    data: populated,
  });
});

/* ------------------------------------------------------------------ */
/* ============================== NOTES ============================= */
/* ------------------------------------------------------------------ */
export const addCaseNote = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { content, visibility = "private" } = req.body;
  const userId = req.user._id;

  if (!content || !String(content).trim()) return res.status(400).json({ success: false, message: "Note content required" });
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: "Invalid case id" });

  const caseDoc = await Case.findById(id);
  if (!caseDoc) return res.status(404).json({ success: false, message: "Case not found" });

  await caseDoc.addNote(String(content).trim(), userId, visibility);
  await caseDoc.save();

  emitSocketEvent("case:noteAdded", getCaseRooms(caseDoc), { caseId: id, content });
  res.status(201).json({ success: true, message: "Note added", data: caseDoc.notes });
});

/* ------------------------------------------------------------------ */
/* =========================== CASE HEARINGS ========================= */
/* ------------------------------------------------------------------ */
export const addCaseHearing = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { date, title, description, outcome } = req.body;
  const userId = req.user._id;

  if (!date) return res.status(400).json({ success: false, message: "Hearing date required" });
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: "Invalid case id" });

  const caseDoc = await Case.findById(id);
  if (!caseDoc) return res.status(404).json({ success: false, message: "Case not found" });

  try {
    const newH = await caseDoc.addHearing({ date, title, description, outcome }, userId);
    // on adding hearing, set status to hearing_scheduled if not already in progress or scheduled
    if (!["hearing_scheduled", "hearing_in_progress"].includes(caseDoc.status)) {
      await caseDoc.setStatus(userId, "hearing_scheduled");
    }
    await caseDoc.save();

    emitSocketEvent("case:hearing", getCaseRooms(caseDoc), { caseId: id, hearing: newH });
    res.status(201).json({ success: true, message: "Hearing added", data: caseDoc.hearings });
  } catch (err) {
    console.error("addCaseHearing error:", err);
    res.status(400).json({ success: false, message: err.message || "Failed to add hearing" });
  }
});

/* ------------------------------------------------------------------ */
/* ========================= PARTICIPANTS / TEAM ===================== */
/* ------------------------------------------------------------------ */
export const addCaseParticipant = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { participantId } = req.body;
  const userId = req.user._id;

  if (!participantId) return res.status(400).json({ success: false, message: "participantId required" });
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: "Invalid case id" });

  const caseDoc = await Case.findById(id);
  if (!caseDoc) return res.status(404).json({ success: false, message: "Case not found" });

  await caseDoc.addParticipant(participantId, userId);
  await caseDoc.save();

  emitSocketEvent("case:participantAdded", getCaseRooms(caseDoc), { caseId: id, participantId });
  res.json({ success: true, message: "Participant added", data: caseDoc.participants });
});

export const removeCaseParticipant = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { participantId } = req.body;
  const userId = req.user._id;

  if (!participantId) return res.status(400).json({ success: false, message: "participantId required" });
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: "Invalid case id" });

  const caseDoc = await Case.findById(id);
  if (!caseDoc) return res.status(404).json({ success: false, message: "Case not found" });

  await caseDoc.removeParticipant(participantId, userId);
  await caseDoc.save();

  emitSocketEvent("case:participantRemoved", getCaseRooms(caseDoc), { caseId: id, participantId });
  res.json({ success: true, message: "Participant removed" });
});

export const addTeamMember = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { userId, role } = req.body;
  const actorId = req.user._id;

  if (!userId) return res.status(400).json({ success: false, message: "userId is required" });
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: "Invalid case id" });

  const caseDoc = await Case.findById(id);
  if (!caseDoc) return res.status(404).json({ success: false, message: "Case not found" });

  if (caseDoc.team?.some((t) => String(t.user) === String(userId)))
    return res.status(400).json({ success: false, message: "Team member already exists" });

  caseDoc.team.push({ user: userId, role: role || "assistant", addedAt: new Date() });
  await caseDoc.addHistory("Team Member Added", actorId, userId.toString());
  await caseDoc.save();

  emitSocketEvent("case:teamAdded", getCaseRooms(caseDoc), { caseId: id, userId });
  res.json({ success: true, message: "Team member added" });
});

export const removeTeamMember = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  const actorId = req.user._id;

  if (!userId) return res.status(400).json({ success: false, message: "userId is required" });
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: "Invalid case id" });

  const caseDoc = await Case.findById(id);
  if (!caseDoc) return res.status(404).json({ success: false, message: "Case not found" });

  caseDoc.team = caseDoc.team.filter((t) => String(t.user) !== String(userId));
  await caseDoc.addHistory("Team Member Removed", actorId, userId.toString());
  await caseDoc.save();

  emitSocketEvent("case:teamRemoved", getCaseRooms(caseDoc), { caseId: id, userId });
  res.json({ success: true, message: "Team member removed" });
});

/* ------------------------------------------------------------------ */
/* ========================= ATTACHMENTS ============================ */
/* ------------------------------------------------------------------ */
export const addAttachment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { fileUrl, name, fileType, size } = req.body;
  const userId = req.user._id;

  if (!fileUrl) return res.status(400).json({ success: false, message: "File URL is required" });
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: "Invalid case id" });

  const caseDoc = await Case.findById(id);
  if (!caseDoc) return res.status(404).json({ success: false, message: "Case not found" });

  const attachment = await caseDoc.addAttachment({ name, fileUrl, fileType, size }, userId);
  await caseDoc.save();

  emitSocketEvent("case:attachmentAdded", getCaseRooms(caseDoc), { caseId: id, fileUrl });
  res.json({ success: true, message: "Attachment added", data: caseDoc.attachments });
});

export const deleteAttachment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { fileUrl } = req.body;
  const userId = req.user._id;

  if (!fileUrl) return res.status(400).json({ success: false, message: "fileUrl is required" });
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: "Invalid case id" });

  const caseDoc = await Case.findById(id);
  if (!caseDoc) return res.status(404).json({ success: false, message: "Case not found" });

  caseDoc.attachments = (caseDoc.attachments || []).filter((a) => a.fileUrl !== fileUrl);
  await caseDoc.addHistory("Attachment Deleted", userId, fileUrl);
  await caseDoc.save();

  emitSocketEvent("case:attachmentDeleted", getCaseRooms(caseDoc), { caseId: id, fileUrl });
  res.json({ success: true, message: "Attachment deleted" });
});

/* ------------------------------------------------------------------ */
/* ======================== SOFT DELETE / RESTORE =================== */
/* ------------------------------------------------------------------ */
export const softDeleteCase = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: "Invalid case id" });

  const caseDoc = await Case.findById(id);
  if (!caseDoc) return res.status(404).json({ success: false, message: "Case not found" });

  await caseDoc.softDelete(userId);
  await caseDoc.save();

  emitSocketEvent("case:deleted", getCaseRooms(caseDoc), { caseId: id });
  res.json({ success: true, message: "Case soft deleted" });
});

export const restoreCase = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: "Invalid case id" });

  const caseDoc = await Case.findById(id);
  if (!caseDoc) return res.status(404).json({ success: false, message: "Case not found" });

  await caseDoc.restore(userId);
  await caseDoc.save();

  emitSocketEvent("case:restored", getCaseRooms(caseDoc), { caseId: id });
  res.json({ success: true, message: "Case restored", data: caseDoc });
});

/* ------------------------------------------------------------------ */
/* ========================== STATS & EXPORT ======================== */
/* ------------------------------------------------------------------ */
export const getCaseStats = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const stats = await Case.aggregate([
    { $match: { filedBy: userId, isDeleted: false } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  const total = stats.reduce((sum, s) => sum + s.count, 0);
  const active = stats.find((s) => ["filed", "under_review"].includes(s._id))?.count || 0;
  const closed = stats.find((s) => ["closed", "resolved"].includes(s._id))?.count || 0;

  res.json({ success: true, data: { total, active, closed } });
});

export const exportCasesCSV = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const cases = await Case.findActive(userId);

  const fields = ["caseNumber", "title", "category", "status", "priority", "court", "jurisdiction", "filedAt"];
  const json2csv = new Parser({ fields });
  const csv = json2csv.parse(cases);

  res.header("Content-Type", "text/csv");
  res.attachment("cases_export.csv");
  res.send(csv);
});
