// backend/controllers/arbitrationsController.js
import Arbitration from "../models/Arbitration.js";
import Evidence from "../models/Evidence.js";
import User from "../models/User.js";
import asyncHandler from "express-async-handler";

/* =======================================================
   🔹 Create New Arbitration
   ======================================================= */
export const createArbitration = asyncHandler(async (req, res) => {
  const { title, description, claimantId, respondentId, category } = req.body;

  if (!title || !claimantId || !respondentId) {
    res.status(400);
    throw new Error("Title, claimant, and respondent are required");
  }

  const claimant = await User.findById(claimantId);
  const respondent = await User.findById(respondentId);

  if (!claimant || !respondent) {
    res.status(404);
    throw new Error("Claimant or respondent not found");
  }

  const arbitration = await Arbitration.create({
    title,
    description,
    category,
    claimant: claimantId,
    respondent: respondentId,
    createdBy: req.user._id,
    status: "Pending",
  });

  res.status(201).json(arbitration);
});

/* =======================================================
   🔹 Get All Arbitrations (Role-Filtered)
   ======================================================= */
export const getAllArbitrations = asyncHandler(async (req, res) => {
  let query = {};

  // Role filtering
  switch (req.user.role) {
    case "admin":
      query = {}; // full access
      break;
    case "arbitrator":
      query = { arbitrator: req.user._id };
      break;
    case "lawyer":
      query = { $or: [{ claimant: req.user._id }, { respondent: req.user._id }] };
      break;
    case "reconciliator":
      query = { reconciliator: req.user._id };
      break;
    default:
      query = { $or: [{ claimant: req.user._id }, { respondent: req.user._id }] };
  }

  const arbitrations = await Arbitration.find(query)
    .populate("claimant", "name email")
    .populate("respondent", "name email")
    .populate("arbitrator", "name email")
    .populate("reconciliator", "name email")
    .sort({ createdAt: -1 });

  res.json(arbitrations);
});

/* =======================================================
   🔹 Get Single Arbitration by ID
   ======================================================= */
export const getArbitrationById = asyncHandler(async (req, res) => {
  const arbitration = await Arbitration.findById(req.params.id)
    .populate("claimant", "name email")
    .populate("respondent", "name email")
    .populate("arbitrator", "name email")
    .populate("reconciliator", "name email");

  if (!arbitration) {
    res.status(404);
    throw new Error("Arbitration not found");
  }

  // Access control: only parties or assigned staff
  if (
    req.user.role !== "admin" &&
    ![
      arbitration.claimant?._id.toString(),
      arbitration.respondent?._id.toString(),
      arbitration.arbitrator?._id.toString(),
      arbitration.reconciliator?._id.toString(),
    ].includes(req.user._id.toString())
  ) {
    res.status(403);
    throw new Error("Access denied to this arbitration");
  }

  // Include linked evidence
  const evidence = await Evidence.find({
    arbitration: arbitration._id,
    deleted: false,
  }).select("fileName verified uploadedBy createdAt");

  res.json({ arbitration, evidence });
});

/* =======================================================
   🔹 Assign Arbitrator or Reconciliator (Admin Only)
   ======================================================= */
export const assignStaff = asyncHandler(async (req, res) => {
  const { arbitratorId, reconciliatorId } = req.body;
  const arbitration = await Arbitration.findById(req.params.id);
  if (!arbitration) {
    res.status(404);
    throw new Error("Arbitration not found");
  }

  if (arbitratorId) {
    const arbitrator = await User.findById(arbitratorId);
    if (!arbitrator) throw new Error("Arbitrator not found");
    arbitration.arbitrator = arbitratorId;
  }

  if (reconciliatorId) {
    const reconciliator = await User.findById(reconciliatorId);
    if (!reconciliator) throw new Error("Reconciliator not found");
    arbitration.reconciliator = reconciliatorId;
  }

  await arbitration.save();
  res.json({ message: "Assignment updated", arbitration });
});

/* =======================================================
   🔹 Update Arbitration Status
   ======================================================= */
export const updateStatus = asyncHandler(async (req, res) => {
  const { status, notes } = req.body;
  const validStatuses = [
    "Pending",
    "Under Review",
    "In Progress",
    "Resolved",
    "Closed",
  ];

  if (!validStatuses.includes(status)) {
    res.status(400);
    throw new Error("Invalid status");
  }

  const arbitration = await Arbitration.findById(req.params.id);
  if (!arbitration) {
    res.status(404);
    throw new Error("Arbitration not found");
  }

  arbitration.status = status;
  if (notes) arbitration.statusNotes = notes;

  await arbitration.save();
  res.json({ message: "Status updated", arbitration });
});

/* =======================================================
   🔹 Soft Delete / Restore / Permanent Delete
   ======================================================= */
export const softDeleteArbitration = asyncHandler(async (req, res) => {
  const arbitration = await Arbitration.findById(req.params.id);
  if (!arbitration) throw new Error("Not found");
  arbitration.deleted = true;
  await arbitration.save();
  res.json({ message: "Arbitration moved to archive" });
});

export const restoreArbitration = asyncHandler(async (req, res) => {
  const arbitration = await Arbitration.findById(req.params.id);
  if (!arbitration) throw new Error("Not found");
  arbitration.deleted = false;
  await arbitration.save();
  res.json({ message: "Arbitration restored" });
});

export const deleteArbitrationPermanently = asyncHandler(async (req, res) => {
  const arbitration = await Arbitration.findById(req.params.id);
  if (!arbitration) throw new Error("Not found");

  await Evidence.deleteMany({ arbitration: arbitration._id });
  await arbitration.deleteOne();
  res.json({ message: "Arbitration and evidence permanently removed" });
});
