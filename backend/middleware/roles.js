// backend/middleware/roles.js

/**
 * Role-based Access Control (RBAC) Middleware
 * ------------------------------------------------
 * Used after authentication (protect middleware).
 * Ensures only users with authorized roles can access specific routes.
 *
 * Example:
 *   router.get("/cases", protect, authorize("Advocate", "Paralegal"), getCases);
 */

export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      // Ensure user info is attached by protect middleware
      if (!req.user || !req.user.role) {
        return res.status(403).json({
          message: "Access denied. No user role found.",
        });
      }

      // Normalize roles to lowercase for comparison
      const userRole = req.user.role.toLowerCase();
      const isAllowed = allowedRoles.map(r => r.toLowerCase()).includes(userRole);

      if (!isAllowed) {
        return res.status(403).json({
          message: `Access denied. ${req.user.role} is not authorized to perform this action.`,
        });
      }

      // Passed all checks
      next();
    } catch (err) {
      console.error("🔒 Role Authorization Error:", err);
      return res.status(500).json({
        message: "Server error while checking permissions.",
      });
    }
  };
};
