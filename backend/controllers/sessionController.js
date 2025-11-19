// backend/controllers/sessionController.js
import mongoose from "mongoose";
import Session from "../models/Session.js";

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

/* CREATE SESSION */
export const createSession = async (req, res) => {
  try {
    const { title, scheduledAt, durationMinutes, mode, locationOrUrl, notes, parties } = req.body;
    const mediator = req.user._id;

    if (!title || !scheduledAt) {
      return res.status(400).json({ success: false, message: "Title and scheduled date are required" });
    }

    const session = await Session.create({
      title,
      scheduledAt,
      durationMinutes,
      mode,
      locationOrUrl,
      notes,
      mediator,
      createdBy: mediator,
      parties,
    });

    const io = getIO(req);
    if (io) {
      try { io.emit("session:created", session); } catch (e) { console.warn("Socket emit failed:", e); }
    }

    return res.status(201).json({ success: true, data: session });
  } catch (err) {
    console.error("❌ Error creating session:", err);
    return res.status(500).json({ success: false, message: "Failed to create session", error: err?.message || String(err) });
  }
};

/* GET SESSIONS (scoped by role) */
export const getSessions = async (req, res) => {
  try {
    const user = req.user;
    const query = {};

    if (user.role === "mediator") {
      query.mediator = user._id;
    } else if (user.role === "client") {
      query.parties = user._id;
    } else if (user.role === "admin") {
      // admin: no filter
    } else {
      query.createdBy = user._id;
    }

    const sessions = await Session.find(query)
      .populate("mediator", "name email role")
      .populate("parties", "name email")
      .sort({ scheduledAt: -1 });

    return res.json({ success: true, data: sessions });
  } catch (err) {
    console.error("❌ Error fetching sessions:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch sessions", error: err?.message || String(err) });
  }
};

/* GET SESSION BY ID */
export const getSessionById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: "Invalid session ID" });

    const session = await Session.findById(id)
      .populate("mediator", "name email")
      .populate("parties", "name email");

    if (!session) return res.status(404).json({ success: false, message: "Session not found" });

    return res.json({ success: true, data: session });
  } catch (err) {
    console.error("❌ Error fetching session:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch session", error: err?.message || String(err) });
  }
};

/* UPDATE SESSION */
export const updateSession = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: "Invalid session ID" });

    const session = await Session.findById(id);
    if (!session) return res.status(404).json({ success: false, message: "Session not found" });

    Object.assign(session, updates);
    session.updatedBy = req.user._id;
    await session.save();

    const io = getIO(req);
    if (io) {
      try { io.emit("session:updated", session); } catch (e) { console.warn("Socket emit failed:", e); }
    }

    return res.json({ success: true, data: session });
  } catch (err) {
    console.error("❌ Error updating session:", err);
    return res.status(500).json({ success: false, message: "Failed to update session", error: err?.message || String(err) });
  }
};

/* UPDATE SESSION STATUS */
export const updateSessionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, outcome } = req.body;

    if (!["scheduled", "completed", "cancelled"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const session = await Session.findByIdAndUpdate(
      id,
      { status, outcome, updatedAt: Date.now() },
      { new: true }
    );

    if (!session) return res.status(404).json({ success: false, message: "Session not found" });

    const io = getIO(req);
    if (io) {
      try { io.emit("session:statusChanged", session); } catch (e) { console.warn("Socket emit failed:", e); }
    }

    return res.json({ success: true, data: session });
  } catch (err) {
    console.error("❌ Error updating session status:", err);
    return res.status(500).json({ success: false, message: "Failed to update session status", error: err?.message || String(err) });
  }
};

/* DELETE SESSION */
export const deleteSession = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: "Invalid session ID" });

    const session = await Session.findById(id);
    if (!session) return res.status(404).json({ success: false, message: "Session not found" });

    await session.deleteOne();

    const io = getIO(req);
    if (io) {
      try { io.emit("session:deleted", { id }); } catch (e) { console.warn("Socket emit failed:", e); }
    }

    return res.json({ success: true, message: "Session deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting session:", err);
    return res.status(500).json({ success: false, message: "Failed to delete session", error: err?.message || String(err) });
  }
};
