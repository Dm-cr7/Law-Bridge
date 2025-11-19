// backend/controllers/caseController.js
import Case from "../models/Case.js";
import User from "../models/User.js";
import { emitSocketEvent } from "../utils/socketEmitter.js";
import asyncHandler from "../middleware/asyncHandler.js";
import { Parser } from "json2csv";

/**
 * ------------------------------------------------------------
 * Case Controller (Realtime + Analytics + Collaboration)
 * ------------------------------------------------------------
 * - Uses asyncHandler for consistent error handling
 * - All socket emits go through emitSocketEvent()
 * - Emits only to users connected to relevant rooms
 * - Handles: CRUD, sharing, notes, attachments, hearings, etc.
 * ------------------------------------------------------------
 */

// 🧩 Helper — Collect all socket rooms relevant to a case
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
    .forEach((id) => ids.add(id.toString()));
  return Array.from(ids);
};

/* =======================================================
   📁 CREATE CASE
   ======================================================= */
export const createCase = asyncHandler(async (req, res) => {
  const filedBy = req.user?._id;
  if (!filedBy)
    return res.status(401).json({ success: false, message: "Unauthorized" });

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
  } = req.body;

  if (!title?.trim()) {
    return res
      .status(400)
      .json({ success: false, message: "Case title is required" });
  }

  const formattedAttachments = Array.isArray(attachments)
    ? attachments.map((a) =>
        typeof a === "string"
          ? { name: a.split("/").pop(), fileUrl: a }
          : {
              name: a.name,
              fileUrl: a.fileUrl || a.url,
              fileType: a.fileType,
              size: a.size,
            }
      )
    : [];

  const newCase = await Case.create({
    title: title.trim(),
    description: description?.trim() || "",
    filedBy,
    client: clientId || null,
    respondent: respondentId || null,
    sharedWith: Array.isArray(sharedWith)
      ? sharedWith
      : sharedWith
      ? [sharedWith]
      : [],
    priority: priority || "medium",
    category: category || "civil",
    court: court?.trim() || "",
    jurisdiction: jurisdiction?.trim() || "",
    status: "filed",
    filedAt: new Date(),
    attachments: formattedAttachments,
    createdBy: filedBy,
  });

  await newCase.addHistory("Case Filed", filedBy, "Case created and submitted.");

  const populated = await Case.findById(newCase._id).populate(
    "filedBy client respondent sharedWith assignedTo"
  );

  emitSocketEvent("case:new", getCaseRooms(populated), populated);
  res.status(201).json({ success: true, data: populated });
});

/* =======================================================
   📜 GET CASES
   ======================================================= */
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

  const skip = (Math.max(page, 1) - 1) * limit;
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

/* =======================================================
   🔍 GET CASE BY ID
   ======================================================= */
export const getCaseById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const caseDoc = await Case.findByAccess(userId, id);
  if (!caseDoc)
    return res
      .status(404)
      .json({ success: false, message: "Case not found or access denied" });

  res.json({ success: true, data: caseDoc });
});

/* =======================================================
   ✏️ UPDATE CASE
   ======================================================= */
export const updateCase = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updater = req.user._id;
  const role = req.user.role;
  const updates = req.body;

  const caseDoc = await Case.findById(id);
  if (!caseDoc)
    return res.status(404).json({ success: false, message: "Case not found" });

  const isOwner = caseDoc.filedBy?.equals(updater);
  const isAssigned = caseDoc.assignedTo?.equals(updater);
  if (!isOwner && role !== "admin" && !isAssigned)
    return res.status(403).json({ success: false, message: "Permission denied" });

  Object.assign(caseDoc, updates, { updatedBy: updater });
  await caseDoc.addHistory(
    "Case Updated",
    updater,
    `Updated: ${Object.keys(updates).join(", ")}`
  );
  await caseDoc.save();

  const populated = await Case.findById(id).populate(
    "filedBy client respondent sharedWith assignedTo"
  );
  emitSocketEvent("case:updated", getCaseRooms(populated), populated);

  res.json({ success: true, data: populated });
});

/* =======================================================
   🔄 UPDATE STATUS
   ======================================================= */
export const updateCaseStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const userId = req.user._id;

  const caseDoc = await Case.findById(id);
  if (!caseDoc)
    return res.status(404).json({ success: false, message: "Case not found" });

  caseDoc.status = status;
  await caseDoc.addHistory("Status Updated", userId, `Changed to ${status}`);
  await caseDoc.save();

  emitSocketEvent("case:status", getCaseRooms(caseDoc), { id, status });
  res.json({ success: true, data: caseDoc });
});

/* =======================================================
   🔗 SHARE CASE
   ======================================================= */
export const shareCase = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { userIdToShare, permission = "view" } = req.body;
  const sharedById = req.user._id;

  if (!userIdToShare)
    return res
      .status(400)
      .json({ success: false, message: "userIdToShare is required" });

  const caseDoc = await Case.findById(id);
  if (!caseDoc)
    return res.status(404).json({ success: false, message: "Case not found" });

  await caseDoc.shareWith(userIdToShare, sharedById, permission);
  await caseDoc.save();

  const populated = await Case.findById(id).populate(
    "filedBy sharedWith client respondent assignedTo"
  );

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

/* =======================================================
   📝 ADD NOTE
   ======================================================= */
export const addCaseNote = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { content, visibility = "private" } = req.body;
  const userId = req.user._id;

  if (!content?.trim())
    return res
      .status(400)
      .json({ success: false, message: "Note content required" });

  const caseDoc = await Case.findById(id);
  if (!caseDoc)
    return res.status(404).json({ success: false, message: "Case not found" });

  await caseDoc.addNote(content, userId, visibility);
  await caseDoc.save();

  emitSocketEvent("case:noteAdded", getCaseRooms(caseDoc), { caseId: id, content });
  res.json({ success: true, message: "Note added", data: caseDoc.notes });
});

/* =======================================================
   ⚖️ ADD CASE HEARING
   ======================================================= */
export const addCaseHearing = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { date, title, description, outcome } = req.body;
  const userId = req.user._id;

  if (!date)
    return res
      .status(400)
      .json({ success: false, message: "Hearing date required" });

  const caseDoc = await Case.findById(id);
  if (!caseDoc)
    return res.status(404).json({ success: false, message: "Case not found" });

  await caseDoc.addHearing({ date, title, description, outcome }, userId);
  await caseDoc.save();

  emitSocketEvent("case:hearing", getCaseRooms(caseDoc), { caseId: id, date, title });
  res.json({ success: true, message: "Hearing added", data: caseDoc.hearings });
});

/* =======================================================
   👥 PARTICIPANTS
   ======================================================= */
export const addCaseParticipant = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { participantId } = req.body;
  const userId = req.user._id;

  const caseDoc = await Case.findById(id);
  if (!caseDoc)
    return res.status(404).json({ success: false, message: "Case not found" });

  await caseDoc.addParticipant(participantId, userId);
  await caseDoc.save();

  emitSocketEvent("case:participantAdded", getCaseRooms(caseDoc), {
    caseId: id,
    participantId,
  });
  res.json({ success: true, message: "Participant added", data: caseDoc.participants });
});

export const removeCaseParticipant = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { participantId } = req.body;
  const userId = req.user._id;

  const caseDoc = await Case.findById(id);
  if (!caseDoc)
    return res.status(404).json({ success: false, message: "Case not found" });

  await caseDoc.removeParticipant(participantId, userId);
  await caseDoc.save();

  emitSocketEvent("case:participantRemoved", getCaseRooms(caseDoc), {
    caseId: id,
    participantId,
  });
  res.json({ success: true, message: "Participant removed" });
});

/* =======================================================
   👨‍💼 TEAM MANAGEMENT
   ======================================================= */
export const addTeamMember = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { userId, role } = req.body;
  const actorId = req.user._id;

  const caseDoc = await Case.findById(id);
  if (!caseDoc)
    return res.status(404).json({ success: false, message: "Case not found" });

  if (caseDoc.team?.some((t) => t.user.equals(userId)))
    return res
      .status(400)
      .json({ success: false, message: "Team member already exists" });

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

  const caseDoc = await Case.findById(id);
  if (!caseDoc)
    return res.status(404).json({ success: false, message: "Case not found" });

  caseDoc.team = caseDoc.team.filter((t) => t.user.toString() !== userId);
  await caseDoc.addHistory("Team Member Removed", actorId, userId.toString());
  await caseDoc.save();

  emitSocketEvent("case:teamRemoved", getCaseRooms(caseDoc), { caseId: id, userId });
  res.json({ success: true, message: "Team member removed" });
});

/* =======================================================
   📎 ATTACHMENTS
   ======================================================= */
export const addAttachment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { fileUrl, name, fileType, size } = req.body;
  const userId = req.user._id;

  if (!fileUrl)
    return res
      .status(400)
      .json({ success: false, message: "File URL is required" });

  const caseDoc = await Case.findById(id);
  if (!caseDoc)
    return res.status(404).json({ success: false, message: "Case not found" });

  await caseDoc.addAttachment({ name, fileUrl, fileType, size }, userId);
  await caseDoc.save();

  emitSocketEvent("case:attachmentAdded", getCaseRooms(caseDoc), { caseId: id, fileUrl });
  res.json({ success: true, message: "Attachment added", data: caseDoc.attachments });
});

export const deleteAttachment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { fileUrl } = req.body;
  const userId = req.user._id;

  const caseDoc = await Case.findById(id);
  if (!caseDoc)
    return res.status(404).json({ success: false, message: "Case not found" });

  caseDoc.attachments = caseDoc.attachments.filter((a) => a.fileUrl !== fileUrl);
  await caseDoc.addHistory("Attachment Deleted", userId, fileUrl);
  await caseDoc.save();

  emitSocketEvent("case:attachmentDeleted", getCaseRooms(caseDoc), { caseId: id, fileUrl });
  res.json({ success: true, message: "Attachment deleted" });
});

/* =======================================================
   🗑️ DELETE / RESTORE / STATS
   ======================================================= */
export const softDeleteCase = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const caseDoc = await Case.findById(id);
  if (!caseDoc)
    return res.status(404).json({ success: false, message: "Case not found" });

  await caseDoc.softDelete(userId);
  await caseDoc.save();

  emitSocketEvent("case:deleted", getCaseRooms(caseDoc), { caseId: id });
  res.json({ success: true, message: "Case soft deleted" });
});

export const restoreCase = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const caseDoc = await Case.findById(id);
  if (!caseDoc)
    return res.status(404).json({ success: false, message: "Case not found" });

  await caseDoc.restore(userId);
  await caseDoc.save();

  emitSocketEvent("case:restored", getCaseRooms(caseDoc), { caseId: id });
  res.json({ success: true, message: "Case restored", data: caseDoc });
});

export const getCaseStats = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const stats = await Case.aggregate([
    { $match: { filedBy: userId, isDeleted: false } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  const total = stats.reduce((sum, s) => sum + s.count, 0);
  const active =
    stats.find((s) => ["filed", "under_review"].includes(s._id))?.count || 0;
  const closed =
    stats.find((s) => ["closed", "resolved"].includes(s._id))?.count || 0;

  res.json({ success: true, data: { total, active, closed } });
});

/* =======================================================
   📤 EXPORT CASES (CSV)
   ======================================================= */
export const exportCasesCSV = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const cases = await Case.findActive(userId);

  const fields = [
    "caseNumber",
    "title",
    "category",
    "status",
    "priority",
    "court",
    "jurisdiction",
    "filedAt",
  ];
  const json2csv = new Parser({ fields });
  const csv = json2csv.parse(cases);

  res.header("Content-Type", "text/csv");
  res.attachment("cases_export.csv");
  res.send(csv);
});
