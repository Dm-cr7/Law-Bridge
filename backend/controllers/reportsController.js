// backend/controllers/reportsController.js
/**
 * Robust Reports Controller
 * - Defensive about response lifecycle (prevents write-after-end)
 * - Normalizes user ids from aggregations (handles scalar / array)
 * - Supports JSON / CSV / PDF exports per-report
 *
 * Usage:
 *  GET /api/reports/cases/summary?format={json|csv|pdf}
 *  GET /api/reports/staff/productivity?format={json|csv|pdf}
 *  GET /api/reports/adr/success?format={json|csv|pdf}
 *  GET /api/reports/export?type=cases|staff|adr&format=pdf
 */

import mongoose from "mongoose";
import PDFDocument from "pdfkit";
import asyncHandler from "../middleware/asyncHandler.js";
import User from "../models/User.js";
import Arbitration from "../models/Arbitration.js";

/* ---------------------------
   Small helpers
   --------------------------- */

function getModelIfExists(name) {
  try {
    return mongoose.modelNames().includes(name) ? mongoose.model(name) : null;
  } catch {
    return null;
  }
}

function parseRange(startDate, endDate) {
  let start = startDate ? new Date(startDate) : null;
  let end = endDate ? new Date(endDate) : null;
  if (start && isNaN(start)) start = null;
  if (end && isNaN(end)) end = null;
  if (end) end.setHours(23, 59, 59, 999);
  return { start, end };
}

function escapeCsv(value) {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function streamCsvFromObjects(res, rows, filename = "report.csv") {
  if (!Array.isArray(rows)) rows = [];
  // Guard: don't write if response is already ended
  if (res.writableEnded) return;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  if (rows.length === 0) {
    if (!res.writableEnded) res.write("\uFEFFNo data\n");
    if (!res.writableEnded) res.end();
    return;
  }

  const headers = Object.keys(rows[0]);
  if (!res.writableEnded) res.write("\uFEFF" + headers.map(escapeCsv).join(",") + "\n");
  for (const row of rows) {
    if (res.writableEnded) break;
    const line = headers.map((h) => escapeCsv(row[h])).join(",");
    res.write(line + "\n");
  }
  if (!res.writableEnded) res.end();
}

/**
 * Safely generate a PDF and stream to response.
 * - If client disconnects (res 'close'), end the PDF generation to avoid writes.
 * - If response already finished (304 or other), bail out.
 */
async function generatePdf(title, dataRows, res, filename = "report.pdf") {
  // If response already ended (304 or other middleware), do nothing
  if (res.writableEnded || res.headersSent && res.statusCode !== 200) {
    // nothing to do
    return;
  }

  const doc = new PDFDocument({ margin: 40, size: "A4" });

  try {
    // Set headers only if they have not been sent yet
    if (!res.headersSent) {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    }

    // If the client disconnects, stop the PDF doc to avoid further writes
    const onClose = () => {
      try {
        if (!doc.destroyed) doc.destroy(); // stops PDFKit
      } catch (e) {
        // ignore
      }
    };

    res.once("close", onClose);
    res.once("finish", () => {
      // cleanup listener
      res.removeListener("close", onClose);
    });

    // Pipe safely: write chunks only while response is writable
    doc.on("data", (chunk) => {
      if (!res.writableEnded) {
        try {
          res.write(chunk);
        } catch (err) {
          // swallow write errors (client disconnect) and destroy doc
          try {
            doc.destroy();
          } catch (e) {}
        }
      }
    });

    doc.on("end", () => {
      if (!res.writableEnded) {
        try {
          res.end();
        } catch (e) {}
      }
    });

    // Build PDF content
    doc.fontSize(18).text(title, { align: "center", underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor("gray").text(`Generated on ${new Date().toLocaleString()}`, {
      align: "center",
    });
    doc.moveDown(1.2);
    doc.fillColor("black");

    if (!Array.isArray(dataRows) || dataRows.length === 0) {
      doc.fontSize(12).text("No data available.", { align: "center" });
      doc.end();
      return;
    }

    const headers = Object.keys(dataRows[0]);
    const maxCols = Math.min(headers.length, 6);
    const colWidth = Math.max(80, Math.floor(520 / maxCols));

    doc.font("Helvetica-Bold").fontSize(11);
    headers.forEach((header, i) => {
      // PDFKit text flow: use continued to print same line across columns
      doc.text(header.toUpperCase(), 40 + i * colWidth, doc.y, {
        width: colWidth,
        continued: i !== headers.length - 1,
      });
      if (i === headers.length - 1) doc.text("");
    });

    doc.moveDown(0.3);
    doc.moveTo(40, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);

    doc.font("Helvetica").fontSize(10);
    for (const row of dataRows) {
      if (res.writableEnded) break;
      headers.forEach((header, i) => {
        const text = String(row[header] ?? "");
        doc.text(text, 40 + i * colWidth, doc.y, {
          width: colWidth,
          continued: i !== headers.length - 1,
        });
        if (i === headers.length - 1) doc.text("");
      });
      doc.moveDown(0.5);
    }

    doc.end();
  } catch (err) {
    // Ensure doc is ended and response not left open
    try {
      if (!doc.destroyed) doc.destroy();
    } catch (e) {}
    if (!res.writableEnded) {
      res.status(500).json({ success: false, message: "Failed to generate PDF" });
    }
  }
}

/* ============================================================
   REPORT: CASES SUMMARY (user-scoped)
   ============================================================ */
export const casesSummary = asyncHandler(async (req, res = null) => {
  const CaseModel = getModelIfExists("Case") || Arbitration;
  const { startDate, endDate, format = "json" } = req.query;
  const { start, end } = parseRange(startDate, endDate);
  const userId = req.user?._id;
  const role = req.user?.role || "user";

  const match = { deleted: { $ne: true } };

  if (role !== "admin" && userId) {
    // match any of these relationships (cast to ObjectId safely)
    const uid = (() => {
      try {
        return mongoose.Types.ObjectId(userId);
      } catch {
        return userId;
      }
    })();
    match.$or = [
      { createdBy: uid },
      { assignedTo: uid },
      { sharedWith: uid },
      { participants: uid },
    ];
  }

  if (start || end) {
    match.createdAt = {};
    if (start) match.createdAt.$gte = start;
    if (end) match.createdAt.$lte = end;
  }

  const statusAgg = await CaseModel.aggregate([
    { $match: match },
    { $group: { _id: "$status", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  const total = statusAgg.reduce((sum, r) => sum + (r.count || 0), 0);

  const resolutionAgg = await CaseModel.aggregate([
    {
      $match: {
        ...match,
        status: { $in: ["closed", "resolved", "decided", "done", "completed"] },
      },
    },
    { $project: { diffMs: { $subtract: ["$updatedAt", "$createdAt"] } } },
    { $group: { _id: null, avgMs: { $avg: "$diffMs" } } },
  ]);

  const avgResolutionDays = resolutionAgg[0]
    ? Math.round(resolutionAgg[0].avgMs / (1000 * 60 * 60 * 24))
    : 0;

  const data = {
    total,
    avgResolutionDays,
    byStatus: statusAgg.map((s) => ({ status: s._id || "unknown", count: s.count })),
  };

  if (!res) return { success: true, data };
  if (String(format).toLowerCase() === "csv")
    return streamCsvFromObjects(res, data.byStatus, "cases-summary.csv");
  if (String(format).toLowerCase() === "pdf")
    return generatePdf("Cases Summary Report", data.byStatus, res, "cases-summary.pdf");
  return res.json({ success: true, data });
});

/* ============================================================
   REPORT: STAFF PRODUCTIVITY (user-scoped)
   - defensive: assignedTo may be array or scalar; we unwind
   - normalizes ids before User.find
   ============================================================ */
export const staffProductivity = asyncHandler(async (req, res = null) => {
  const TaskModel = getModelIfExists("Task");
  const CaseModel = getModelIfExists("Case") || Arbitration;
  const { startDate, endDate, format = "json", limit = 20 } = req.query;
  const { start, end } = parseRange(startDate, endDate);
  const userId = req.user?._id;
  const role = req.user?.role || "user";

  const match = { deleted: { $ne: true } };
  if (role !== "admin" && userId) {
    const uid = (() => {
      try {
        return mongoose.Types.ObjectId(userId);
      } catch {
        return userId;
      }
    })();
    match.$or = [{ createdBy: uid }, { assignedTo: uid }];
  }

  if (start || end) {
    match.createdAt = {};
    if (start) match.createdAt.$gte = start;
    if (end) match.createdAt.$lte = end;
  }

  const Model = TaskModel || CaseModel;

  const pipeline = [
    { $match: match },
    // only documents with assignedTo
    { $match: { assignedTo: { $exists: true, $ne: null } } },
    // if assignedTo is array, unwind so each id counts separately
    { $unwind: { path: "$assignedTo", preserveNullAndEmptyArrays: false } },
    {
      $group: {
        _id: "$assignedTo",
        totalAssigned: { $sum: 1 },
        closedCount: {
          $sum: {
            $cond: [
              {
                $in: [
                  { $toLower: { $ifNull: ["$status", ""] } },
                  ["done", "completed", "resolved", "closed"],
                ],
              },
              1,
              0,
            ],
          },
        },
        avgCompletionMs: {
          $avg: {
            $cond: [
              {
                $in: [
                  { $toLower: { $ifNull: ["$status", ""] } },
                  ["done", "completed", "resolved", "closed"],
                ],
              },
              { $subtract: ["$updatedAt", "$createdAt"] },
              null,
            ],
          },
        },
      },
    },
    { $sort: { closedCount: -1 } },
    { $limit: parseInt(limit, 10) || 20 },
  ];

  const agg = await Model.aggregate(pipeline);

  // Normalize ids to strings, attempt ObjectId conversion for lookup
  const rawUserIds = agg
    .map((r) => r._id)
    .filter(Boolean)
    .map((id) => {
      try {
        return String(mongoose.Types.ObjectId(id));
      } catch {
        return String(id);
      }
    });

  const uniqueUserIds = Array.from(new Set(rawUserIds)).filter(Boolean);

  let users = [];
  if (uniqueUserIds.length > 0) {
    let objectIds = [];
    try {
      objectIds = uniqueUserIds.map((id) => mongoose.Types.ObjectId(id));
    } catch {
      objectIds = uniqueUserIds;
    }
    users = await User.find({ _id: { $in: objectIds } }).select("name email role").lean();
  }

  const userMap = new Map(users.map((u) => [String(u._id), u]));

  const rows = agg.map((r) => {
    const idStr = r._id ? String(r._id) : "unassigned";
    const u = userMap.get(idStr) || {};
    return {
      userId: idStr,
      name: u.name || (idStr === "unassigned" ? "Unassigned" : "Unknown"),
      email: u.email || "",
      totalAssigned: r.totalAssigned || 0,
      closedCount: r.closedCount || 0,
      avgCompletionDays: r.avgCompletionMs
        ? Math.round(r.avgCompletionMs / (1000 * 60 * 60 * 24))
        : 0,
    };
  });

  if (!res) return { success: true, data: rows };
  if (String(format).toLowerCase() === "csv") return streamCsvFromObjects(res, rows, "staff-productivity.csv");
  if (String(format).toLowerCase() === "pdf")
    return generatePdf("Staff Productivity Report", rows, res, "staff-productivity.pdf");
  return res.json({ success: true, data: rows });
});

/* ============================================================
   REPORT: ADR SUCCESS RATES (user-scoped)
   ============================================================ */
export const adrSuccessRates = asyncHandler(async (req, res = null) => {
  const { startDate, endDate, format = "json" } = req.query;
  const { start, end } = parseRange(startDate, endDate);
  const userId = req.user?._id;
  const role = req.user?.role || "user";

  const match = { deleted: { $ne: true } };

  if (role !== "admin" && userId) {
    const uid = (() => {
      try {
        return mongoose.Types.ObjectId(userId);
      } catch {
        return userId;
      }
    })();
    match.$or = [
      { createdBy: uid },
      { assignedTo: uid },
      { mediator: uid },
      { arbitrator: uid },
      { sharedWith: uid },
      { participants: uid },
    ];
  }

  if (start || end) {
    match.createdAt = {};
    if (start) match.createdAt.$gte = start;
    if (end) match.createdAt.$lte = end;
  }

  const pipeline = [
    { $match: match },
    { $addFields: { lcStatus: { $toLower: { $ifNull: ["$status", ""] } } } },
    { $group: { _id: "$lcStatus", count: { $sum: 1 } } },
  ];

  const byStatus = await Arbitration.aggregate(pipeline);
  const total = byStatus.reduce((s, r) => s + (r.count || 0), 0);
  const successStatuses = ["resolved", "settled", "decided", "closed"];
  const successCount = byStatus.filter((r) => successStatuses.includes(r._id)).reduce((s, r) => s + r.count, 0);
  const successRate = total > 0 ? ((successCount / total) * 100).toFixed(2) : 0;

  const data = { total, successCount, successRate, breakdown: byStatus };

  if (!res) return { success: true, data };
  if (String(format).toLowerCase() === "csv") return streamCsvFromObjects(res, byStatus, "adr-success.csv");
  if (String(format).toLowerCase() === "pdf") return generatePdf("ADR Success Rates Report", byStatus, res, "adr-success.pdf");
  return res.json({ success: true, data });
});

/* ============================================================
   Generic export endpoint (delegates)
   ============================================================ */
export const exportReport = asyncHandler(async (req, res = null) => {
  const { type = "cases" } = req.query;
  if (type === "cases") return casesSummary(req, res);
  if (type === "staff") return staffProductivity(req, res);
  if (type === "adr") return adrSuccessRates(req, res);

  if (res) return res.status(400).json({ success: false, message: "Unknown export type" });
  return { success: false, message: "Unknown export type" };
});

export default {
  casesSummary,
  staffProductivity,
  adrSuccessRates,
  exportReport,
};
