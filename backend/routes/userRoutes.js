// backend/routes/userRoutes.js

import express from "express";
import User from "../models/User.js";
import { protect } from "../middleware/authMiddleware.js";
import multer from "multer";
import sharp from "sharp";
import path from "path";
import fs from "fs";
import PDFDocument from "pdfkit";

const router = express.Router();

/* ============================================================
   MULTER (Avatar upload)
   ============================================================ */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024 }, // 6MB
});

/* ============================================================
   GET /api/users
   ============================================================ */
router.get("/", protect, async (req, res) => {
  try {
    const { role } = req.query;
    const query = {};
    if (role) query.role = role;

    const users = await User.find(query).select("name email role");
    res.json(users);
  } catch (err) {
    console.error("❌ Error fetching users:", err);
    res.status(500).json({ error: "Failed to load users" });
  }
});

/* ============================================================
   GET /api/users/profile
   ============================================================ */
router.get("/profile", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).lean();
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    console.error("❌ Profile fetch error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ============================================================
   PUT /api/users/profile
   Extended to update:
   - name
   - email
   - phone
   - organization
   - bio
   - address (optional)
   ============================================================ */
router.put("/profile", protect, async (req, res) => {
  const allowed = ["name", "email", "phone", "organization", "bio", "address", "designation"];
  const updates = {};

  allowed.forEach((f) => {
    if (req.body[f] !== undefined) updates[f] = req.body[f];
  });

  if (updates.email) {
    const exists = await User.findOne({ email: updates.email });
    if (exists && exists._id.toString() !== req.user._id.toString()) {
      return res.status(400).json({ error: "Email already in use" });
    }
  }

  try {
    const updated = await User.findByIdAndUpdate(req.user._id, updates, { new: true }).lean();
    if (!updated) return res.status(404).json({ error: "User not found" });
    res.json(updated);
  } catch (err) {
    console.error("❌ Profile update error:", err);
    res.status(500).json({ error: "Could not update profile" });
  }
});

/* ============================================================
   PUT /api/users/password
   ============================================================ */
router.put("/password", protect, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Both current and new passwords are required" });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: "New password must be at least 6 characters long" });
  }

  try {
    const user = await User.findById(req.user._id).select("+password");
    if (!user) return res.status(404).json({ error: "User not found" });

    const correct = await user.comparePassword(currentPassword);
    if (!correct) return res.status(401).json({ error: "Current password is incorrect" });

    user.password = newPassword;
    await user.save();

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("❌ Password update error:", err);
    res.status(500).json({ error: "Could not update password" });
  }
});

/* ============================================================
   POST /api/users/profile/avatar
   Uses SHARP to crop/resize to 400x400
   ============================================================ */
router.post(
  "/profile/avatar",
  protect,
  upload.single("avatar"),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const outDir = path.join(process.cwd(), "public", "uploads", "avatars");
    await fs.promises.mkdir(outDir, { recursive: true });

    const filename = `avatar-${req.user._id}-${Date.now()}.png`;
    const outPath = path.join(outDir, filename);

    try {
      await sharp(req.file.buffer)
        .resize(400, 400, { fit: "cover" })
        .png({ quality: 90 })
        .toFile(outPath);

      const avatarUrl = `/uploads/avatars/${filename}`;

      const updated = await User.findByIdAndUpdate(
        req.user._id,
        { avatar: avatarUrl },
        { new: true }
      ).lean();

      res.json({ success: true, avatarUrl });
    } catch (err) {
      console.error("❌ Avatar error:", err);
      res.status(500).json({ error: "Failed to process avatar" });
    }
  }
);

/* ============================================================
   GET /api/users/profile/export?format=pdf
   - Streams PDF safely
   - Avoids write-after-end errors
   ============================================================ */
router.get("/profile/export", protect, async (req, res) => {
  const user = await User.findById(req.user._id).lean();
  if (!user) return res.status(404).json({ error: "User not found" });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="profile-${user._id}.pdf"`
  );

  const doc = new PDFDocument({ margin: 40 });

  const handleClose = () => {
    try {
      doc.end();
    } catch {}
  };
  res.on("close", handleClose);

  doc.pipe(res);

  try {
    doc.fontSize(20).text(`${user.name}`, { underline: true });
    doc.moveDown();

    doc.fontSize(12).text(`Email: ${user.email}`);
    doc.text(`Role: ${user.role}`);
    doc.text(`Phone: ${user.phone || "—"}`);
    doc.text(`Organization: ${user.organization || "—"}`);
    doc.text(`Bio: ${user.bio || "—"}`);

    if (user.avatar) {
      const avatarPath = path.join(process.cwd(), "public", user.avatar);
      if (fs.existsSync(avatarPath)) {
        doc.addPage();
        doc.text("Profile Picture", { align: "center" });
        doc.image(avatarPath, { fit: [250, 250], align: "center" });
      }
    }
    doc.end();
  } catch (err) {
    console.error("❌ PDF error:", err);
    if (!res.writableEnded) {
      res.status(500).json({ error: "Failed to generate PDF" });
    }
  } finally {
    res.off("close", handleClose);
  }
});

/* ============================================================
   EXPORT ROUTER
   ============================================================ */
export default router;
