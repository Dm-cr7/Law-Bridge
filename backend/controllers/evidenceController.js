// backend/controllers/evidenceController.js
import path from "path";
import Evidence from "../models/Evidence.js";
import Case from "../models/Case.js";
import Arbitration from "../models/Arbitration.js";

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

/**
 * Upload evidence (POST /api/cases/:caseId/evidence OR
 * POST /api/arbitrations/:arbitrationId/evidence)
 *
 * Expects middleware to provide either req.fileData (normalized)
 * or multer-style req.file.
 */
export const uploadEvidence = async (req, res) => {
  try {
    const { caseId, arbitrationId } = req.params;
    const userId = req.user && req.user._id;
    const { title, description, category } = req.body || {};

    // ensure file present
    if (!req.file && !req.fileData) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const parentId = caseId || arbitrationId;
    const parentModel = caseId ? Case : Arbitration;
    if (!parentId) {
      return res.status(400).json({ success: false, message: "Parent ID (caseId or arbitrationId) required" });
    }

    const parent = await parentModel.findById(parentId);
    if (!parent) {
      return res.status(404).json({
        success: false,
        message: `${caseId ? "Case" : "Arbitration"} not found`,
      });
    }

    // Normalize file metadata
    const fileData =
      req.fileData ||
      (req.file && {
        name: req.file.originalname,
        fileUrl: req.file.location || req.file.path || req.file.url,
        fileKey:
          req.file.key ||
          req.file.filename ||
          (req.file.path && path.basename(req.file.path)) ||
          null,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        storageProvider: process.env.STORAGE_PROVIDER || "local",
      });

    if (!fileData) {
      return res.status(500).json({ success: false, message: "Upload did not produce file metadata" });
    }

    const newEvidence = new Evidence({
      title: (title || fileData.name || "Evidence").trim(),
      description: (description || "").trim(),
      fileName: fileData.name,
      fileType: fileData.fileType,
      fileSize: fileData.fileSize,
      fileKey: fileData.fileKey,
      fileUrl: fileData.fileUrl,
      storageProvider: fileData.storageProvider,
      uploadedBy: userId,
      arbitration: arbitrationId || null,
      case: caseId || null,
      meta: { category: category || "Document" },
    });

    // Optional model-level helper hooks
    if (typeof newEvidence.addAudit === "function") {
      try {
        newEvidence.addAudit("uploaded", userId, { category });
      } catch (e) {
        // non-fatal
        console.warn("addAudit failed:", e);
      }
    }

    await newEvidence.save();

    // attach to parent record
    parent.evidence = parent.evidence || [];
    parent.evidence.push(newEvidence._id);
    await parent.save();

    // Emit event
    const io = getIO(req);
    if (io) {
      try {
        const payload = typeof newEvidence.toPublicJSON === "function" ? newEvidence.toPublicJSON() : newEvidence;
        io.emit("evidence:new", payload);
      } catch (e) {
        console.warn("Socket emit failed:", e);
      }
    }

    return res.status(201).json({
      success: true,
      message: "Evidence uploaded successfully",
      evidence: typeof newEvidence.toPublicJSON === "function" ? newEvidence.toPublicJSON() : newEvidence,
    });
  } catch (err) {
    console.error("❌ Upload evidence error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to upload evidence",
      error: err?.message || String(err),
    });
  }
};

/* GET ALL EVIDENCE FOR A CASE OR ARBITRATION */
export const getEvidenceByParent = async (req, res) => {
  try {
    const { caseId, arbitrationId } = req.params;
    const includeDeleted = req.query.includeDeleted === "true";
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "25", 10), 1), 200);

    const filter = {
      ...(caseId ? { case: caseId } : { arbitration: arbitrationId }),
      ...(includeDeleted ? {} : { deleted: false }),
    };

    const [total, items] = await Promise.all([
      Evidence.countDocuments(filter),
      Evidence.find(filter)
        .populate("uploadedBy", "name email role")
        .populate("verifiedBy", "name email role")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    return res.json({
      success: true,
      items: items.map((e) => (typeof e.toPublicJSON === "function" ? e.toPublicJSON() : e)),
      total,
      page,
      limit,
    });
  } catch (err) {
    console.error("❌ Get evidence error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch evidence",
      error: err?.message || String(err),
    });
  }
};

/* GET SINGLE EVIDENCE BY ID */
export const getEvidenceById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ success: false, message: "Evidence id required" });

    const evidence = await Evidence.findById(id)
      .populate("uploadedBy", "name email role")
      .populate("verifiedBy", "name email role");

    if (!evidence || evidence.deleted) {
      return res.status(404).json({ success: false, message: "Evidence not found or deleted" });
    }

    return res.json({
      success: true,
      evidence: typeof evidence.toPublicJSON === "function" ? evidence.toPublicJSON() : evidence,
    });
  } catch (err) {
    console.error("❌ Get evidence by ID error:", err);
    return res.status(500).json({
      success: false,
      message: "Error retrieving evidence",
      error: err?.message || String(err),
    });
  }
};

/* VERIFY EVIDENCE */
export const verifyEvidence = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    if (!id) return res.status(400).json({ success: false, message: "Evidence id required" });

    const evidence = await Evidence.findById(id);
    if (!evidence || evidence.deleted) {
      return res.status(404).json({ success: false, message: "Evidence not found" });
    }

    if (typeof evidence.verify === "function") {
      evidence.verify(user._id);
      await evidence.save();
    } else {
      return res.status(500).json({ success: false, message: "Evidence model missing verify() method" });
    }

    const io = getIO(req);
    if (io) {
      try {
        io.emit("evidence:verified", { evidenceId: id, verifiedBy: user.name || user.email });
      } catch (e) {
        console.warn("Socket emit failed:", e);
      }
    }

    return res.json({
      success: true,
      message: "Evidence verified successfully",
      evidence: typeof evidence.toPublicJSON === "function" ? evidence.toPublicJSON() : evidence,
    });
  } catch (err) {
    console.error("❌ Verify evidence error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to verify evidence",
      error: err?.message || String(err),
    });
  }
};

/* SOFT DELETE */
export const softDeleteEvidence = async (req, res) => {
  try {
    const { caseId, evidenceId } = req.params;
    const userId = req.user._id;

    if (!evidenceId) return res.status(400).json({ success: false, message: "evidenceId required" });

    const evidence = await Evidence.findById(evidenceId);
    if (!evidence) {
      return res.status(404).json({ success: false, message: "Evidence not found" });
    }

    if (typeof evidence.softDelete === "function") {
      evidence.softDelete(userId);
      await evidence.save();
    } else {
      // fallback: mark deleted flag
      evidence.deleted = true;
      evidence.deletedAt = new Date();
      await evidence.save();
    }

    if (caseId) {
      await Case.findByIdAndUpdate(caseId, { $pull: { evidence: evidenceId } }).catch(() => {});
    }

    const io = getIO(req);
    if (io) {
      try {
        io.emit("evidence:deleted", { evidenceId });
      } catch (e) {
        console.warn("Socket emit failed:", e);
      }
    }

    return res.json({ success: true, message: "Evidence deleted successfully" });
  } catch (err) {
    console.error("❌ Delete evidence error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to delete evidence",
      error: err?.message || String(err),
    });
  }
};

/* PERMANENT DELETE */
export const deleteEvidencePermanently = async (req, res) => {
  try {
    const { caseId, evidenceId } = req.params;
    if (!evidenceId) return res.status(400).json({ success: false, message: "evidenceId required" });

    const evidence = await Evidence.findById(evidenceId);
    if (!evidence) return res.status(404).json({ success: false, message: "Evidence not found" });

    await Evidence.findByIdAndDelete(evidenceId);

    if (caseId) {
      await Case.findByIdAndUpdate(caseId, { $pull: { evidence: evidenceId } }).catch(() => {});
    }

    const io = getIO(req);
    if (io) {
      try {
        io.emit("evidence:permanentDeleted", { evidenceId });
      } catch (e) {
        console.warn("Socket emit failed:", e);
      }
    }

    return res.json({ success: true, message: "Evidence permanently deleted" });
  } catch (err) {
    console.error("❌ Permanent delete evidence error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to permanently delete evidence",
      error: err?.message || String(err),
    });
  }
};

/* RESTORE */
export const restoreEvidence = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    if (!id) return res.status(400).json({ success: false, message: "Evidence id required" });

    const evidence = await Evidence.findById(id);
    if (!evidence) return res.status(404).json({ success: false, message: "Evidence not found" });

    if (typeof evidence.restore === "function") {
      evidence.restore(userId);
      await evidence.save();
    } else {
      evidence.deleted = false;
      evidence.deletedAt = null;
      await evidence.save();
    }

    const io = getIO(req);
    if (io) {
      try {
        const payload = typeof evidence.toPublicJSON === "function" ? evidence.toPublicJSON() : evidence;
        io.emit("evidence:restored", payload);
      } catch (e) {
        console.warn("Socket emit failed:", e);
      }
    }

    return res.json({
      success: true,
      message: "Evidence restored successfully",
      evidence: typeof evidence.toPublicJSON === "function" ? evidence.toPublicJSON() : evidence,
    });
  } catch (err) {
    console.error("❌ Restore evidence error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to restore evidence",
      error: err?.message || String(err),
    });
  }
};

/* SEARCH */
export const searchEvidence = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ success: false, message: "Search query missing" });

    const results = await Evidence.find({
      $text: { $search: q },
      deleted: false,
    })
      .select("title description fileName fileUrl case arbitration uploadedBy createdAt")
      .populate("uploadedBy", "name email role")
      .sort({ createdAt: -1 })
      .limit(50);

    return res.json({
      success: true,
      results: results.map((e) => (typeof e.toPublicJSON === "function" ? e.toPublicJSON() : e)),
    });
  } catch (err) {
    console.error("❌ Search evidence error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to search evidence",
      error: err?.message || String(err),
    });
  }
};
