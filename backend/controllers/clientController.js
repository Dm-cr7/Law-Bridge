// backend/controllers/clientController.js
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import crypto from "crypto";
import Client from "../models/Client.js";
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

const generatePassword = (length = 12) =>
  crypto.randomBytes(Math.ceil((length * 3) / 4)).toString("base64").slice(0, length);

const normalizeEmail = (email = "") => String(email).trim().toLowerCase();

const clientPopulate = (query) =>
  query
    .populate("createdBy", "name email role")
    .populate("sharedWith", "name email role")
    .populate("advocate paralegal mediator arbitrator", "name email role")
    .populate("cases", "title caseNumber status");

/* CREATE CLIENT (intake) */
export const createClient = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const {
      name,
      email,
      phone,
      address,
      company,
      notes,
      requiredService,
      caseDescription,
      sharedWith,
    } = req.body || {};

    const createdBy = req.user?._id;
    if (!createdBy) {
      await session.abortTransaction();
      session.endSession();
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (!name || !email) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: "Name and email are required" });
    }

    const normalizedEmail = normalizeEmail(email);

    // Prevent duplicate client for same creator
    const alreadyClientForUser = await Client.findOne({
      email: normalizedEmail,
      createdBy,
      deletedAt: null,
    }).session(session);

    if (alreadyClientForUser) {
      await session.abortTransaction();
      session.endSession();
      return res.status(409).json({
        success: false,
        message: "A client with this email already exists in your account",
        client: alreadyClientForUser,
      });
    }

    const existingAnyClient = await Client.findOne({ email: normalizedEmail, deletedAt: null }).session(session);

    // Find or create user
    let clientUser = await User.findOne({ email: normalizedEmail }).session(session);
    let userCreated = false;
    let tempPassword = null;

    if (!clientUser) {
      tempPassword = generatePassword(12);
      const hashed = await bcrypt.hash(tempPassword, 12);

      const created = await User.create(
        [
          {
            name: name.trim(),
            email: normalizedEmail,
            phone: phone || null,
            password: hashed,
            role: "client",
            status: "active",
          },
        ],
        { session }
      );
      clientUser = Array.isArray(created) ? created[0] : created;
      userCreated = true;
      console.info(`Created client user ${clientUser.email}`);
    }

    const clientPayload = {
      name: name.trim(),
      email: normalizedEmail,
      phone: phone || null,
      address: address || "",
      company: company || "",
      notes: notes || "",
      requiredService: requiredService || "advocate",
      caseDescription: caseDescription || "",
      createdBy,
      user: clientUser._id,
      sharedWith: Array.isArray(sharedWith) ? sharedWith : [],
      advocate: req.user.role === "advocate" ? req.user._id : null,
      paralegal: req.user.role === "paralegal" ? req.user._id : null,
      mediator: req.user.role === "mediator" ? req.user._id : null,
      arbitrator: req.user.role === "arbitrator" ? req.user._id : null,
    };

    const created = await Client.create([clientPayload], { session });
    const newClient = Array.isArray(created) ? created[0] : created;

    if (typeof newClient.addHistory === "function") {
      try {
        await newClient.addHistory("Client Created", createdBy, "New client intake recorded.");
      } catch (e) {
        // non-fatal
        console.warn("addHistory failed:", e);
      }
    }

    await session.commitTransaction();
    session.endSession();

    const populated = await clientPopulate(Client.findById(newClient._id)).exec();

    const io = getIO(req);
    if (io) {
      try { io.emit("client:created", populated); } catch (e) { console.warn("Socket emit failed for client:created", e); }
    }

    return res.status(201).json({
      success: true,
      message: "Client created successfully",
      client: populated,
      userCreated,
      tempPassword: userCreated ? tempPassword : undefined, // dev only — remove in prod
    });
  } catch (err) {
    console.error("❌ createClient error:", err);
    try { await session.abortTransaction(); session.endSession(); } catch (e) {}
    return res.status(500).json({ success: false, message: "Failed to create client", error: err?.message || String(err) });
  }
};

/* GET CLIENTS */
export const getClients = async (req, res) => {
  try {
    const userId = req.user._id;
    const role = req.user.role;
    const q = String(req.query.q || "").trim();
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "25", 10), 1), 200);
    const includeDeleted = req.query.includeDeleted === "true" && role === "admin";

    let filter = {};
    if (!includeDeleted) filter.deletedAt = null;

    if (q) {
      const term = q.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
      filter.$or = [{ name: { $regex: term, $options: "i" } }, { email: { $regex: term, $options: "i" } }, { phone: { $regex: term, $options: "i" } }];
    }

    if (role !== "admin") {
      filter.$and = filter.$and || [];
      filter.$and.push({ $or: [{ createdBy: userId }, { sharedWith: userId }] });
    }

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      clientPopulate(Client.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit)),
      Client.countDocuments(filter),
    ]);

    return res.json({ success: true, items, total, page, limit });
  } catch (err) {
    console.error("❌ getClients error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch clients", error: err?.message || String(err) });
  }
};

/* GET CLIENT BY ID */
export const getClientById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const role = req.user.role;

    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: "Invalid client ID" });

    const client = await clientPopulate(Client.findById(id)).exec();

    if (!client || client.deletedAt) return res.status(404).json({ success: false, message: "Client not found" });

    const isOwner = client.createdBy && client.createdBy._id && String(client.createdBy._id) === String(userId);
    const isShared = Array.isArray(client.sharedWith) && client.sharedWith.some((u) => String(u._id || u) === String(userId));
    const isLinkedClientUser = client.user && String(client.user) === String(userId);

    if (!(role === "admin" || isOwner || isShared || isLinkedClientUser)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    return res.json({ success: true, client });
  } catch (err) {
    console.error("❌ getClientById error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch client", error: err?.message || String(err) });
  }
};

/* UPDATE CLIENT */
export const updateClient = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body || {};
    const userId = req.user._id;
    const role = req.user.role;

    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: "Invalid client ID" });

    const client = await Client.findById(id);
    if (!client || client.deletedAt) return res.status(404).json({ success: false, message: "Client not found" });

    const isOwner = client.createdBy && client.createdBy.equals(userId);
    const isShared = Array.isArray(client.sharedWith) && client.sharedWith.map(String).includes(String(userId));
    if (!(role === "admin" || isOwner || isShared)) return res.status(403).json({ success: false, message: "Access denied" });

    if (updates.email) updates.email = normalizeEmail(updates.email);

    Object.assign(client, updates);

    if (typeof client.addHistory === "function") {
      try {
        await client.addHistory("Client Updated", userId, "Updated via API");
      } catch (e) { console.warn("addHistory failed:", e); }
    }

    await client.save();

    const populated = await clientPopulate(Client.findById(client._id)).exec();

    const io = getIO(req);
    if (io) {
      try { io.emit("client:updated", populated); } catch (e) { console.warn("Socket emit failed for client:updated", e); }
    }

    return res.json({ success: true, client: populated });
  } catch (err) {
    console.error("❌ updateClient error:", err);
    return res.status(500).json({ success: false, message: "Failed to update client", error: err?.message || String(err) });
  }
};

/* SOFT DELETE CLIENT */
export const deleteClient = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const role = req.user.role;

    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: "Invalid client ID" });

    const client = await Client.findById(id);
    if (!client || client.deletedAt) return res.status(404).json({ success: false, message: "Client not found" });

    const isOwner = client.createdBy && client.createdBy.equals(userId);
    if (!(role === "admin" || isOwner)) return res.status(403).json({ success: false, message: "Only owner or admin can delete client" });

    if (typeof client.softDelete === "function") {
      await client.softDelete(userId);
    } else {
      client.deletedAt = new Date();
      await client.save();
    }

    const io = getIO(req);
    if (io) {
      try { io.emit("client:deleted", { id: client._id }); } catch (e) { console.warn("Socket emit failed for client:deleted", e); }
    }

    return res.json({ success: true, message: "Client deleted successfully" });
  } catch (err) {
    console.error("❌ deleteClient error:", err);
    return res.status(500).json({ success: false, message: "Failed to delete client", error: err?.message || String(err) });
  }
};

/* RESTORE CLIENT */
export const restoreClient = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const role = req.user.role;

    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: "Invalid client ID" });

    const client = await Client.findById(id);
    if (!client) return res.status(404).json({ success: false, message: "Client not found" });

    const isOwner = client.createdBy && client.createdBy.equals(userId);
    if (!(role === "admin" || isOwner)) return res.status(403).json({ success: false, message: "Only owner or admin can restore client" });

    if (typeof client.restore === "function") {
      await client.restore(userId);
    } else {
      client.deletedAt = null;
      await client.save();
    }

    const populated = await clientPopulate(Client.findById(client._id)).exec();

    const io = getIO(req);
    if (io) {
      try { io.emit("client:restored", populated); } catch (e) { console.warn("Socket emit failed for client:restored", e); }
    }

    return res.json({ success: true, client: populated });
  } catch (err) {
    console.error("❌ restoreClient error:", err);
    return res.status(500).json({ success: false, message: "Failed to restore client", error: err?.message || String(err) });
  }
};

/* SHARE CLIENT */
export const shareClient = async (req, res) => {
  try {
    const { id } = req.params;
    const { userIds } = req.body || [];
    const userId = req.user._id;
    const role = req.user.role;

    if (!Array.isArray(userIds) || userIds.length === 0) return res.status(400).json({ success: false, message: "userIds array required" });
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: "Invalid client ID" });

    const client = await Client.findById(id);
    if (!client || client.deletedAt) return res.status(404).json({ success: false, message: "Client not found" });

    const isOwner = client.createdBy && client.createdBy.equals(userId);
    if (!(role === "admin" || isOwner)) return res.status(403).json({ success: false, message: "Only owner or admin can share client" });

    const merged = new Set([...(client.sharedWith || []).map(String), ...userIds.map(String)]);
    client.sharedWith = Array.from(merged);

    if (typeof client.addHistory === "function") {
      try { await client.addHistory("Client Shared", userId, `Shared with ${userIds.length} users`); } catch (e) { console.warn("addHistory failed:", e); }
    }
    await client.save();

    const populated = await clientPopulate(Client.findById(client._id)).exec();

    const io = getIO(req);
    if (io) {
      try { io.emit("client:shared", populated); } catch (e) { console.warn("Socket emit failed for client:shared", e); }
    }

    return res.json({ success: true, message: "Client shared successfully", client: populated });
  } catch (err) {
    console.error("❌ shareClient error:", err);
    return res.status(500).json({ success: false, message: "Failed to share client", error: err?.message || String(err) });
  }
};
