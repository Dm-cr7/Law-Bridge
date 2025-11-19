/**
 * authMiddleware.js
 * ------------------------------------------------------------
 * Centralized authentication & authorization middleware.
 * - Verifies JWT tokens
 * - Attaches user to req.user
 * - Handles expired / invalid tokens gracefully
 * - Supports role-based access control (RBAC)
 * ------------------------------------------------------------
 */

import jwt from "jsonwebtoken";
import User from "../models/User.js";

/* =======================================================
   🔒 PROTECT ROUTES — Require valid JWT
   ======================================================= */
export const protect = async (req, res, next) => {
  try {
    let token;

    // Extract token from Authorization header
    if (req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        message: "Not authorized: token missing or malformed.",
      });
    }

    // ✅ Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ Attach user to request
    const user = await User.findById(decoded.id).select("-password -otp -otpExpires");
    if (!user) {
      return res.status(401).json({ message: "User not found or removed." });
    }

    // 🚫 Check if user is inactive or suspended
    if (user.status !== "active") {
      return res.status(403).json({ message: "User account is not active." });
    }

    // 🚫 Check if password changed after token was issued
    if (user.changedPasswordAfter(decoded.iat)) {
      return res.status(401).json({
        message: "Session invalidated. Please log in again.",
      });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error("🔒 Auth Error:", err.message);

    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Session expired. Please log in again." });
    }
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({ message: "Invalid token. Please authenticate again." });
    }

    return res.status(401).json({ message: "Authorization failed." });
  }
};

/* =======================================================
   🧩 OPTIONAL AUTH — Allow guests or logged-in users
   ======================================================= */
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return next(); // No user, continue
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select("-password -otp -otpExpires");
    if (user && user.status === "active") req.user = user;

    next();
  } catch {
    next(); // Ignore token errors silently for public routes
  }
};

/* =======================================================
   🧠 AUTHORIZE — Role-Based Access Control
   ======================================================= */
export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated." });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Access denied: requires one of [${allowedRoles.join(", ")}]`,
      });
    }

    next();
  };
};

/* =======================================================
   🧰 UTIL: GENERATE TOKEN (For Login/Register Controllers)
   ======================================================= */
export const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d", // Default 7 days
  });
};

/* =======================================================
   ✅ EXPORTS
   ======================================================= */
export default {
  protect,
  optionalAuth,
  authorize,
  generateToken,
};
