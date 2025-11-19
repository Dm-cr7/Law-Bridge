// backend/controllers/awardController.js
/**
 * awardController.js
 * ------------------------------------------------------------
 * Controller for managing arbitration awards.
 * Handles creation, updating, verification, and file management.
 */

import fs from "fs";
import path from "path";
import Award from "../models/Award.js";
import Arbitration from "../models/Arbitration.js";
import { saveFile, deleteFile } from "../services/storage.js";


/* =======================================================
   🧩 CREATE AWARD
   ======================================================= */
export const createAward = async (req, res) => {
  try {
    const { arbitrationId, title, summary, decisionText, notes } = req.body;
    const userId = req.user._id;

    const arbitration = await Arbitration.findById(arbitrationId);
    if (!arbitration) {
      return res.status(404).json({ message: "Arbitration not found." });
    }

    const newAward = new Award({
      arbitration: arbitrationId,
      title,
      summary,
      decisionText,
      notes,
      arbitrator: userId,
      createdBy: userId,
    });

    await newAward.save();

    res.status(201).json({
      message: "Award created successfully.",
      award: newAward,
    });
  } catch (err) {
    console.error("❌ Error creating award:", err);
    res.status(500).json({ message: "Failed to create award.", error: err.message });
  }
};

/* =======================================================
   🧾 GET ALL AWARDS (Optionally filter by arbitration)
   ======================================================= */
export const getAllAwards = async (req, res) => {
  try {
    const { arbitrationId } = req.query;
    const query = { isDeleted: false };
    if (arbitrationId) query.arbitration = arbitrationId;

    const awards = await Award.find(query)
      .populate("arbitration", "caseNumber title status")
      .populate("arbitrator", "name email")
      .populate("createdBy", "name")
      .sort({ createdAt: -1 });

    res.json({ count: awards.length, awards });
  } catch (err) {
    console.error("❌ Error fetching awards:", err);
    res.status(500).json({ message: "Failed to fetch awards.", error: err.message });
  }
};

/* =======================================================
   📄 GET SINGLE AWARD BY ID
   ======================================================= */
export const getAwardById = async (req, res) => {
  try {
    const award = await Award.findById(req.params.id)
      .populate("arbitration", "caseNumber title")
      .populate("arbitrator", "name email")
      .populate("parties", "name email")
      .populate("createdBy", "name");

    if (!award || award.isDeleted)
      return res.status(404).json({ message: "Award not found." });

    res.json(award);
  } catch (err) {
    console.error("❌ Error getting award:", err);
    res.status(500).json({ message: "Failed to retrieve award.", error: err.message });
  }
};

/* =======================================================
   ✍️ UPDATE AWARD
   ======================================================= */
export const updateAward = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    updates.updatedBy = req.user._id;

    const award = await Award.findByIdAndUpdate(id, updates, { new: true });
    if (!award) return res.status(404).json({ message: "Award not found." });

    res.json({ message: "Award updated successfully.", award });
  } catch (err) {
    console.error("❌ Error updating award:", err);
    res.status(500).json({ message: "Failed to update award.", error: err.message });
  }
};

/* =======================================================
   📎 UPLOAD / REPLACE AWARD PDF
   ======================================================= */
export const uploadAwardFile = async (req, res) => {
  try {
    const { id } = req.params;
    const award = await Award.findById(id);
    if (!award) return res.status(404).json({ message: "Award not found." });

    if (!req.file) return res.status(400).json({ message: "No file uploaded." });

    // Remove old file if exists
    if (award.awardPdf) await deleteFile(award.awardPdf);

    // Upload new file (to local or cloud)
    const uploadResult = await uploadFile(req.file, `awards/${award._id}`);

    award.awardPdf = uploadResult.url || uploadResult.path;
    award.awardGeneratedAt = new Date();
    award.updatedBy = req.user._id;
    await award.save();

    res.json({
      message: "Award file uploaded successfully.",
      fileUrl: award.awardPdf,
    });
  } catch (err) {
    console.error("❌ Error uploading award file:", err);
    res.status(500).json({ message: "File upload failed.", error: err.message });
  }
};

/* =======================================================
   ✅ VERIFY / FINALIZE AWARD
   ======================================================= */
export const verifyAward = async (req, res) => {
  try {
    const { id } = req.params;
    const verifierId = req.user._id;

    const award = await Award.findById(id);
    if (!award) return res.status(404).json({ message: "Award not found." });

    await award.markVerified(verifierId);
    res.json({ message: "Award verified successfully.", award });
  } catch (err) {
    console.error("❌ Error verifying award:", err);
    res.status(500).json({ message: "Failed to verify award.", error: err.message });
  }
};

/* =======================================================
   🗑️ SOFT DELETE / RESTORE
   ======================================================= */
export const softDeleteAward = async (req, res) => {
  try {
    const { id } = req.params;
    const award = await Award.findById(id);
    if (!award) return res.status(404).json({ message: "Award not found." });

    await award.softDelete(req.user._id);
    res.json({ message: "Award moved to archive." });
  } catch (err) {
    console.error("❌ Error deleting award:", err);
    res.status(500).json({ message: "Failed to delete award.", error: err.message });
  }
};

export const restoreAward = async (req, res) => {
  try {
    const { id } = req.params;
    const award = await Award.findById(id);
    if (!award) return res.status(404).json({ message: "Award not found." });

    await award.restore(req.user._id);
    res.json({ message: "Award restored successfully." });
  } catch (err) {
    console.error("❌ Error restoring award:", err);
    res.status(500).json({ message: "Failed to restore award.", error: err.message });
  }
};

/* =======================================================
   💣 PERMANENT DELETE (Admin only)
   ======================================================= */
export const deleteAwardPermanently = async (req, res) => {
  try {
    const { id } = req.params;
    const award = await Award.findById(id);
    if (!award) return res.status(404).json({ message: "Award not found." });

    if (award.awardPdf) await deleteFile(award.awardPdf);
    await award.deleteOne();

    res.json({ message: "Award permanently deleted." });
  } catch (err) {
    console.error("❌ Error deleting award permanently:", err);
    res.status(500).json({ message: "Failed to permanently delete award.", error: err.message });
  }
};
