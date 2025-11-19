/**
 * middleware/hasCaseAccess.js
 * ------------------------------------------------------------------
 * Ensures the current user has permission to access a case.
 * A user can access a case if:
 *   ✅ They created it (filedBy)
 *   ✅ They are in the sharedWith list
 * Admins always have access.
 * ------------------------------------------------------------------
 */

import Case from "../models/Case.js";

export const hasCaseAccess = async (req, res, next) => {
  try {
    const user = req.user;
    const caseId = req.params.id;

    if (!caseId || !user) {
      return res.status(400).json({ message: "Invalid case or user context" });
    }

    // Fetch the case
    const caseDoc = await Case.findById(caseId).select("filedBy sharedWith isDeleted");
    if (!caseDoc || caseDoc.isDeleted) {
      return res.status(404).json({ message: "Case not found" });
    }

    const isOwner = caseDoc.filedBy.toString() === user._id.toString();
    const isShared = caseDoc.sharedWith.some(
      (u) => u.toString() === user._id.toString()
    );

    // Admins bypass restrictions
    if (user.role === "admin" || isOwner || isShared) {
      req.case = caseDoc; // Attach the case to req for downstream use
      return next();
    }

    return res
      .status(403)
      .json({ message: "Access denied. You do not have permission to this case." });
  } catch (err) {
    console.error("❌ hasCaseAccess error:", err);
    res.status(500).json({ message: "Error verifying case access", error: err.message });
  }
};
