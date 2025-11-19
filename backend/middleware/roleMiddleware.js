// backend/middleware/roleMiddleware.js

/**
 * Role-based access control middleware
 * Ensures that only users with specified roles can access certain routes.
 *
 * Usage:
 *   router.post("/admin-only", protect, authorizeRoles("admin"), handler);
 */

export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      if (!req.user || !req.user.role) {
        return res
          .status(401)
          .json({ success: false, message: "User not authenticated." });
      }

      // Check if user's role matches one of the allowed roles
      if (!allowedRoles.includes(req.user.role.toLowerCase())) {
        return res.status(403).json({
          success: false,
          message: "Access denied: insufficient permissions.",
        });
      }

      // ✅ Access granted
      next();
    } catch (err) {
      console.error("⚠️ Role Middleware Error:", err);
      res
        .status(500)
        .json({ success: false, message: "Server error in role middleware." });
    }
  };
};
