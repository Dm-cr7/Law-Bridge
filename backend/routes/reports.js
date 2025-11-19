/**
 * backend/routes/reportsRoutes.js
 * --------------------------------------------------------------------
 * 📊 Reporting & Analytics Routes — Fully Production Ready
 * --------------------------------------------------------------------
 * Features:
 * ✅ Authenticated (all routes use `protect`)
 * ✅ Role-based access control via `authorize`
 * ✅ Supports query ?scope=self|firm for user- or firm-wide reporting
 * ✅ Handles JSON, CSV, and PDF exports
 * ✅ Works seamlessly with controllers that either return data or write directly
 */

import express from "express";
import {
  casesSummary,
  staffProductivity,
  adrSuccessRates,
  exportReport,
} from "../controllers/reportsController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

/* --------------------------------------------------------------------
   🧠 Helper — call controller that may return or send response
-------------------------------------------------------------------- */
async function callControllerSafely(controllerFn, req, res) {
  // Some controllers send their own response via res.json()
  // Others return { success, data } directly
  const result = await controllerFn(req, res);
  if (res.headersSent) return null;
  return result;
}

/* --------------------------------------------------------------------
   📈 GET /api/reports/summary?scope=self|firm
   Combines cases, staff, and ADR analytics into one response.
-------------------------------------------------------------------- */
router.get("/summary", protect, async (req, res, next) => {
  try {
    const scope = req.query.scope || "self";

    const [casesData, staffData, adrData] = await Promise.all([
      callControllerSafely(casesSummary, req, res),
      callControllerSafely(staffProductivity, req, res),
      callControllerSafely(adrSuccessRates, req, res),
    ]);

    if (res.headersSent) return; // controller already handled it

    res.json({
      success: true,
      summary: {
        cases: casesData?.data || casesData || {},
        staff: staffData?.data || staffData || [],
        adr: adrData?.data || adrData || {},
        scope,
      },
    });
  } catch (err) {
    console.error("💥 Error in /reports/summary:", err);
    next(err);
  }
});

/* --------------------------------------------------------------------
   ⚖️ GET /api/reports/cases/summary?scope=self|firm
   Returns case analytics per status and resolution time.
-------------------------------------------------------------------- */
router.get(
  "/cases/summary",
  protect,
  authorize("advocate", "paralegal", "mediator", "arbitrator", "admin"),
  async (req, res, next) => {
    try {
      const result = await callControllerSafely(casesSummary, req, res);
      if (!res.headersSent && result !== undefined) {
        return res.json(result);
      }
    } catch (err) {
      console.error("💥 Error in /reports/cases/summary:", err);
      next(err);
    }
  }
);

/* --------------------------------------------------------------------
   👥 GET /api/reports/staff/productivity?scope=self|firm
   Returns task/case handling performance per staff member.
-------------------------------------------------------------------- */
router.get(
  "/staff/productivity",
  protect,
  authorize("advocate", "paralegal", "admin"),
  async (req, res, next) => {
    try {
      const result = await callControllerSafely(staffProductivity, req, res);
      if (!res.headersSent && result !== undefined) {
        return res.json(result);
      }
    } catch (err) {
      console.error("💥 Error in /reports/staff/productivity:", err);
      next(err);
    }
  }
);

/* --------------------------------------------------------------------
   ⚖️ GET /api/reports/adr/success?scope=self|firm
   Returns ADR success breakdown and percentages.
-------------------------------------------------------------------- */
router.get(
  "/adr/success",
  protect,
  authorize("advocate", "mediator", "arbitrator", "admin"),
  async (req, res, next) => {
    try {
      const result = await callControllerSafely(adrSuccessRates, req, res);
      if (!res.headersSent && result !== undefined) {
        return res.json(result);
      }
    } catch (err) {
      console.error("💥 Error in /reports/adr/success:", err);
      next(err);
    }
  }
);

/* --------------------------------------------------------------------
   🧾 GET /api/reports/export
   ?type={cases|staff|adr}&format={json|csv|pdf}&scope=self|firm
   Delegates to exportReport — may stream or return a buffer.
-------------------------------------------------------------------- */
router.get("/export", protect, async (req, res, next) => {
  try {
    const { type = "cases", format = "json" } = req.query;

    // Controller may send directly or return object/buffer
    const result = await callControllerSafely(exportReport, req, res);
    if (res.headersSent) return;

    // Binary file export (e.g., PDF)
    if (result?.buffer && result?.mimeType && result?.filename) {
      res.setHeader("Content-Type", result.mimeType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${result.filename}"`
      );
      return res.send(result.buffer);
    }

    // JSON export
    if (result?.data && (format === "json" || !format)) {
      return res.json(result);
    }

    // CSV export
    if (typeof result === "string" && format === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="report_${type}.csv"`
      );
      return res.send(result);
    }

    // Default fallback
    return res.json(
      result || { success: false, message: "No export data available" }
    );
  } catch (err) {
    console.error("💥 Error in /reports/export:", err);
    next(err);
  }
});

export default router;
