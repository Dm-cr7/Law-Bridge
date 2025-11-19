/**
 * backend/routes/uploadRoutes.js
 * --------------------------------------------------------------
 * Handles file uploads (single, multiple), deletion and serving.
 * - Keeps middleware/controllers in ../controllers/uploadController.js
 * - Normalizes upload errors (multer/busboy) into 4xx responses
 * - Safely serves local files from process.cwd()/uploads
 * --------------------------------------------------------------
 */

import express from "express";
import path from "path";
import fs from "fs";
import stream from "stream";

import {
  uploadSingle,
  uploadMultiple,
  uploadSingleHandler,
  uploadMultipleHandler,
  deleteUpload,
} from "../controllers/uploadController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * Helper: async wrapper to bubble errors to router error handler
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/* =========================================================================
   POST /api/upload
   - Upload a single file: field name = "file"
   - Protected route (use `protect` if uploads require auth)
   ========================================================================= */
router.post(
  "/",
  protect,
  // uploadSingle is assumed to be a factory that returns multer/busboy middleware
  uploadSingle("file"),
  asyncHandler(uploadSingleHandler)
);

/* =========================================================================
   POST /api/upload/multiple
   - Upload multiple files: field name = "files"
   - second argument (maxCount) can default in uploadMultiple factory
   ========================================================================= */
router.post(
  "/multiple",
  protect,
  uploadMultiple("files", 10),
  asyncHandler(uploadMultipleHandler)
);

/* =========================================================================
   DELETE /api/upload
   - Body: { fileKey: string } or { filename: string }
   - Protected: requires auth
   - Delegates deletion logic to controller.deleteUpload
   ========================================================================= */
router.delete(
  "/",
  protect,
  asyncHandler(async (req, res, next) => {
    // controller is responsible for validating fileKey/filename and removing storage
    await deleteUpload(req, res, next);
  })
);

/* =========================================================================
   GET /api/upload/:filename
   - Serves local uploaded files from the uploads directory.
   - Validates requested filename to prevent path traversal.
   - If file is large, streams it.
   ========================================================================= */
router.get(
  "/:filename",
  asyncHandler(async (req, res) => {
    const rawName = req.params.filename;

    // Basic sanitization: remove any path separators to avoid traversal
    const filename = path.basename(rawName);

    const uploadsDir = process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");
    const filePath = path.join(uploadsDir, filename);

    // Defensive check
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      return res.status(404).json({ success: false, message: "File not found" });
    }

    // Set caching headers (short cache by default)
    res.setHeader("Cache-Control", "private, max-age=60"); // 60 seconds
    // Optionally set content-disposition so browser suggests filename
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);

    // Stream file to avoid loading whole file into memory for large uploads
    const readStream = fs.createReadStream(filePath);
    // For safety, pipe with error handler
    readStream.on("error", (err) => {
      console.error("File read error:", err);
      if (!res.headersSent) {
        return res.status(500).json({ success: false, message: "Error reading file" });
      }
      // if headers already sent, just destroy
      res.destroy(err);
    });

    readStream.pipe(res);
  })
);

/* =========================================================================
   Router-level error handler
   - Normalizes multer/busboy and validation errors to 400 where appropriate
   - Leaves other errors as 500 but still returns JSON
   ========================================================================= */
router.use((err, req, res, next) => {
  // Multer-specific error codes: LIMIT_FILE_SIZE, LIMIT_UNEXPECTED_FILE, etc.
  const multerCodes = new Set(["LIMIT_FILE_SIZE", "LIMIT_UNEXPECTED_FILE", "LIMIT_PART_COUNT", "LIMIT_FILE_COUNT", "LIMIT_FIELD_KEY", "LIMIT_FIELD_VALUE", "LIMIT_FIELD_COUNT", "LIMIT_UNEXPECTED_FILE"]);

  console.error("Upload route error:", err && (err.stack || err));

  // If controller/middleware set a status property (e.g., err.status = 400), respect it.
  if (err && (err.status === 400 || err.status === 422)) {
    return res.status(err.status).json({ success: false, message: err.message });
  }

  // Multer errors: respond 400 with friendly message
  if (err && err.code && multerCodes.has(err.code)) {
    return res.status(400).json({ success: false, message: err.message || `Upload error (${err.code})` });
  }

  // busboy and other errors sometimes include 'code' or come as plain Error with message identifying invalid file type
  if (err && typeof err.message === "string" && /invalid file type/i.test(err.message)) {
    return res.status(400).json({ success: false, message: err.message });
  }

  // Default: internal server error
  const status = err && err.status ? err.status : 500;
  const payload = { success: false, message: err && err.message ? err.message : "Internal Server Error" };
  if (process.env.NODE_ENV !== "production") payload.error = err && err.stack ? err.stack : undefined;

  return res.status(status).json(payload);
});

export default router;
