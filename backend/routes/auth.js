// backend/routes/auth.js

import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// =============================
// 🔐 Helper: Sign a JWT
// =============================
const signToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

// =============================
// 🧾 REGISTER
// =============================
router.post("/register", async (req, res) => {
  try {
    let { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and password are required.",
      });
    }

    email = email.toLowerCase().trim();

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email is already registered.",
      });
    }

    // 🔒 Restrict self-assigned roles to safe options
    const allowedSelfRoles = ["client", "paralegal"];
    if (!allowedSelfRoles.includes(role?.toLowerCase())) {
      role = "client";
    }

    const user = new User({ name, email, password, role });
    await user.save();

    const token = signToken(user._id);

    return res.status(201).json({
      success: true,
      message: "Registration successful.",
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (err) {
    console.error("🛑 Registration error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error during registration.",
    });
  }
});

// =============================
// 🔑 LOGIN
// =============================
router.post("/login", async (req, res) => {
  try {
    let { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    email = email.toLowerCase().trim();

    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials.",
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials.",
      });
    }

    const token = signToken(user._id);

    return res.json({
      success: true,
      message: "Login successful.",
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (err) {
    console.error("🛑 Login error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error during login.",
    });
  }
});

// =============================
// 👤 GET CURRENT USER
// =============================
router.get("/me", protect, (req, res) => {
  const { _id: id, name, email, role, status } = req.user;
  return res.json({
    success: true,
    data: { id, name, email, role, status },
  });
});

// =============================
// 🚪 LOGOUT (Client-side JWT deletion)
// =============================
router.post("/logout", (req, res) => {
  return res.json({
    success: true,
    message: "Logged out successfully.",
  });
});

export default router;
