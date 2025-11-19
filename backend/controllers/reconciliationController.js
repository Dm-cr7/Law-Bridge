// backend/controllers/reconciliationController.js
import mongoose from "mongoose";
import PDFDocument from "pdfkit";
import Reconciliation from "../models/Reconciliation.js";
import User from "../models/User.js";

/**
 * Helper to get Socket.IO instance safely from request
 */
const getIO = (req) => {
  try {
    return req?.app?.get("io");
  } catch (e) {
    return null;
  }
};

/* CREATE RECONCILIATION */
export const createReconciliation = async (req, res) => {
  try {
    const { title, participants, scheduledAt, durationMinutes, mode, linkOrLocation, notes } = req.body;
    if (!title || !participants || !scheduledAt) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const parsedParticipants = Array.isArray(participants)
      ? participants
      : String(participants).split(",").map((p) => p.trim()).filter(Boolean);

    const newRecon = await Reconciliation.create({
      title,
      participants: parsedParticipants,
      scheduledAt,
      durationMinutes: durationMinutes || 30,
      mode: mode || "online",
      linkOrLocation: linkOrLocation || "",
      notes: notes || "",
      createdBy: req.user._id,
      reconciliator: req.user._id,
    });

    const io = getIO(req);
    if (io) {
      try {
        io.emit("recon:created", newRecon);
      } catch (e) {
        console.warn("Socket emit failed:", e);
      }
    }

    return res.status(201).json({ success: true, data: newRecon });
  } catch (err) {
    console.error("❌ Error creating reconciliation:", err);
    return res.status(500).json({ success: false, message: "Failed to create reconciliation", error: err?.message || String(err) });
  }
};

/* GET ALL RECONCILIATIONS (scoped by user) */
export const getReconciliations = async (req, res) => {
  try {
    const query = { deletedAt: null };

    if (req.user.role === "reconciliator") {
      query.reconciliator = req.user._id;
    } else if (req.user.role === "admin") {
      // admin sees all
    } else {
      query.createdBy = req.user._id;
    }

    const recons = await Reconciliation.find(query)
      .populate("createdBy", "name email role")
      .populate("reconciliator", "name email role")
      .sort({ scheduledAt: -1 });

    return res.json({ success: true, data: recons });
  } catch (err) {
    console.error("❌ Error fetching reconciliations:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch reconciliations", error: err?.message || String(err) });
  }
};

/* GET SINGLE RECONCILIATION BY ID */
export const getReconciliationById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: "Invalid ID" });

    const recon = await Reconciliation.findById(id)
      .populate("createdBy", "name email")
      .populate("reconciliator", "name email");

    if (!recon || recon.deletedAt) return res.status(404).json({ success: false, message: "Reconciliation not found" });

    return res.json({ success: true, data: recon });
  } catch (err) {
    console.error("❌ Error fetching reconciliation:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch reconciliation", error: err?.message || String(err) });
  }
};

/* UPDATE RECONCILIATION */
export const updateReconciliation = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: "Invalid ID" });

    const recon = await Reconciliation.findById(id);
    if (!recon || recon.deletedAt) return res.status(404).json({ success: false, message: "Reconciliation not found" });

    Object.assign(recon, updates);
    recon.updatedBy = req.user._id;
    await recon.save();

    const io = getIO(req);
    if (io) {
      try {
        io.emit("recon:updated", recon);
        if (updates.status === "closed") {
          io.emit("recon:closed", { id: recon._id, result: recon.result || null });
        }
      } catch (e) {
        console.warn("Socket emit failed:", e);
      }
    }

    return res.json({ success: true, data: recon });
  } catch (err) {
    console.error("❌ Error updating reconciliation:", err);
    return res.status(500).json({ success: false, message: "Failed to update reconciliation", error: err?.message || String(err) });
  }
};

/* DELETE (soft) RECONCILIATION */
export const deleteReconciliation = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: "Invalid ID" });

    const recon = await Reconciliation.findById(id);
    if (!recon || recon.deletedAt) return res.status(404).json({ success: false, message: "Reconciliation not found" });

    recon.deletedAt = new Date();
    await recon.save();

    const io = getIO(req);
    if (io) {
      try {
        io.emit("recon:deleted", { id });
      } catch (e) {
        console.warn("Socket emit failed:", e);
      }
    }

    return res.json({ success: true, message: "Reconciliation deleted" });
  } catch (err) {
    console.error("❌ Error deleting reconciliation:", err);
    return res.status(500).json({ success: false, message: "Failed to delete reconciliation", error: err?.message || String(err) });
  }
};

/* RESTORE RECONCILIATION */
export const restoreReconciliation = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: "Invalid ID" });

    const recon = await Reconciliation.findById(id);
    if (!recon) return res.status(404).json({ success: false, message: "Reconciliation not found" });

    recon.deletedAt = null;
    await recon.save();

    const io = getIO(req);
    if (io) {
      try {
        io.emit("recon:restored", recon);
      } catch (e) {
        console.warn("Socket emit failed:", e);
      }
    }

    return res.json({ success: true, data: recon });
  } catch (err) {
    console.error("❌ Error restoring reconciliation:", err);
    return res.status(500).json({ success: false, message: "Failed to restore reconciliation", error: err?.message || String(err) });
  }
};

/* GET RECONCILIATION REPORT (PDF stream) */
export const getReconciliationReport = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: "Invalid ID" });

    const recon = await Reconciliation.findById(id)
      .populate("createdBy", "name email")
      .populate("reconciliator", "name email");

    if (!recon) return res.status(404).json({ success: false, message: "Reconciliation not found" });

    // stream PDF
    const doc = new PDFDocument({ autoFirstPage: true });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=reconciliation-${id}-report.pdf`);
    // Pipe PDF output to response; errors handled via doc.on('error')
    doc.pipe(res);

    // Content
    doc.fontSize(18).text("Reconciliation Report", { align: "center" });
    doc.moveDown();
    doc.fontSize(12).text(`Title: ${recon.title}`);
    doc.text(`Reconciliator: ${recon.reconciliator?.name || "N/A"} (${recon.reconciliator?.email || ""})`);
    doc.text(`Scheduled At: ${recon.scheduledAt ? new Date(recon.scheduledAt).toString() : "N/A"}`);
    doc.text(`Duration: ${recon.durationMinutes || "N/A"} mins`);
    doc.text(`Mode: ${recon.mode || "N/A"}`);
    doc.text(`Status: ${recon.status || "N/A"}`);
    if (recon.linkOrLocation) doc.text(`Link/Location: ${recon.linkOrLocation}`);
    doc.moveDown();

    doc.text(`Participants: ${(recon.participants || []).join(", ")}`);
    doc.moveDown();

    if (recon.notes) {
      doc.text("Notes:", { underline: true });
      doc.text(recon.notes);
      doc.moveDown();
    }

    if (recon.result) {
      doc.text("Result:", { underline: true });
      doc.text(recon.result);
    }

    // finalize
    doc.end();
    // no explicit res.json here; streaming response handled by PDF streaming
  } catch (err) {
    console.error("❌ Error generating report:", err);
    // If response already headersSent, just end
    if (res.headersSent) {
      try { res.end(); } catch (e) {}
      return;
    }
    return res.status(500).json({ success: false, message: "Failed to generate report", error: err?.message || String(err) });
  }
};
