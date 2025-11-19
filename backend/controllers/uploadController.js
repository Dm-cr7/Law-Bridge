/**
 * backend/controllers/uploadController.js
 * ------------------------------------------------------------
 * File upload middleware + controller
 * - Supports local disk and AWS S3 storage providers
 * - Uses multer (disk or memory) and @aws-sdk/client-s3 for S3 PUTs
 * - Returns consistent response: { files: [{ name, fileUrl, fileKey, fileType, size }] }
 * - Configurable via environment variables
 * ------------------------------------------------------------
 */

import path from "path";
import fs from "fs-extra";
import multer from "multer";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import multerMulter from "multer"; // alias to access multer.MulterError if needed

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ------------------------------------------------------------------
// ENV / CONFIG
// ------------------------------------------------------------------
const STORAGE_PROVIDER = process.env.STORAGE_PROVIDER || "local"; // 'local' | 'aws_s3'
const MAX_FILE_SIZE = parseInt(process.env.MAX_UPLOAD_SIZE || "10485760", 10); // default 10MB
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads"); // local storage dir

// AWS S3 config (if using aws_s3)
const S3_BUCKET = process.env.S3_BUCKET || "";
const S3_REGION = process.env.S3_REGION || "";
const S3_BASE_URL = process.env.S3_BASE_URL || ""; // Optional override base URL for fileUrl

let s3Client = null;
if (STORAGE_PROVIDER === "aws_s3") {
  s3Client = new S3Client({
    region: S3_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
}

// ------------------------------------------------------------------
// Allowed MIME types (adjustable)
const DEFAULT_WHITELIST = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "application/zip",
  // Add "text/csv" here if you want CSV support:
  // "text/csv",
];

// also map common extensions to mime-like tokens for fallback
const EXTENSION_WHITELIST = new Set([
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".doc",
  ".docx",
  ".txt",
  ".zip",
  // ".csv" // add if you want csv
]);

// Helper to build whitelist from ENV or default
const getWhitelist = () =>
  process.env.FILE_TYPE_WHITELIST
    ? process.env.FILE_TYPE_WHITELIST.split(",").map((s) => s.trim())
    : DEFAULT_WHITELIST;

// Create upload dir if local
if (STORAGE_PROVIDER === "local") {
  fs.ensureDirSync(UPLOAD_DIR);
}

// ------------------------------------------------------------------
// Multer storage configuration
// ------------------------------------------------------------------
const diskStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const key = `${Date.now()}-${uuidv4()}${ext}`;
    cb(null, key);
  },
});

const memoryStorage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const whitelist = getWhitelist();

  // helpful logging to debug mismatched types
  console.log(`upload fileFilter: name=${file.originalname} mimetype=${file.mimetype}`);

  const mimetype = file.mimetype || "";
  if (whitelist.includes(mimetype)) {
    return cb(null, true);
  }

  // fallback: try extension
  const ext = path.extname(file.originalname || "").toLowerCase();
  if (ext && EXTENSION_WHITELIST.has(ext)) {
    return cb(null, true);
  }

  // not allowed: produce a client error (400)
  const err = new Error(
    `Invalid file type: ${mimetype || "unknown"}. Allowed types: ${whitelist.join(", ")}`
  );
  // mark as client error so global handler returns 400
  err.status = 400;
  // also tag for multer detection if desired
  err.code = "INVALID_FILE_TYPE";
  return cb(err, false);
};

const upload = multer({
  storage: STORAGE_PROVIDER === "aws_s3" ? memoryStorage : diskStorage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
});

// ------------------------------------------------------------------
// Helpers: upload buffer to S3 and delete from S3/local
// ------------------------------------------------------------------
async function uploadBufferToS3(buffer, key, mimeType) {
  if (!s3Client) throw new Error("S3 client not configured");
  const params = {
    Bucket: S3_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
  };
  await s3Client.send(new PutObjectCommand(params));

  if (S3_BASE_URL) return `${S3_BASE_URL.replace(/\/$/, "")}/${key}`;
  if (S3_REGION && S3_BUCKET) {
    return `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`;
  }
  return `s3://${S3_BUCKET}/${key}`;
}

async function deleteS3Object(key) {
  if (!s3Client) throw new Error("S3 client not configured");
  const params = { Bucket: S3_BUCKET, Key: key };
  await s3Client.send(new DeleteObjectCommand(params));
}

// ------------------------------------------------------------------
// Controllers
// ------------------------------------------------------------------

// Upload multiple files
export const uploadMultipleHandler = async (req, res) => {
  try {
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ success: false, message: "No files uploaded" });

    const results = [];

    for (const f of files) {
      // normalize file properties (multer memory or disk)
      const originalName = f.originalname || f.name || "file";
      const mimetype = f.mimetype || "";
      const size = f.size || 0;

      if (STORAGE_PROVIDER === "aws_s3") {
        const ext = path.extname(originalName) || "";
        const key = `${Date.now()}-${uuidv4()}${ext}`;
        const fileUrl = await uploadBufferToS3(f.buffer, key, mimetype);

        results.push({
          name: originalName,
          fileUrl,
          fileKey: key,
          fileType: mimetype,
          size,
        });
      } else {
        // Local disk: multer already saved file
        const key = path.basename(f.path);
        const fileUrl = process.env.LOCAL_UPLOAD_BASE_URL
          ? `${process.env.LOCAL_UPLOAD_BASE_URL.replace(/\/$/, "")}/${key}`
          : `${req.protocol}://${req.get("host")}/uploads/${key}`;

        results.push({
          name: originalName,
          fileUrl,
          fileKey: key,
          fileType: mimetype,
          size,
        });
      }
    }

    // Created resource -> 201
    return res.status(201).json({ success: true, files: results });
  } catch (err) {
    console.error("❌ Upload multiple error:", err);
    const status = err?.status || 500;
    return res.status(status).json({ success: false, message: err.message || "Upload failed", error: err?.stack });
  }
};

// Upload single file
export const uploadSingleHandler = async (req, res) => {
  try {
    const f = req.file;
    if (!f) return res.status(400).json({ success: false, message: "No file uploaded" });

    const originalName = f.originalname || f.name || "file";
    const mimetype = f.mimetype || "";
    const size = f.size || 0;

    let result;
    if (STORAGE_PROVIDER === "aws_s3") {
      const ext = path.extname(originalName) || "";
      const key = `${Date.now()}-${uuidv4()}${ext}`;
      const fileUrl = await uploadBufferToS3(f.buffer, key, mimetype);

      result = {
        name: originalName,
        fileUrl,
        fileKey: key,
        fileType: mimetype,
        size,
      };
    } else {
      const key = path.basename(f.path);
      const fileUrl = process.env.LOCAL_UPLOAD_BASE_URL
        ? `${process.env.LOCAL_UPLOAD_BASE_URL.replace(/\/$/, "")}/${key}`
        : `${req.protocol}://${req.get("host")}/uploads/${key}`;

      result = {
        name: originalName,
        fileUrl,
        fileKey: key,
        fileType: mimetype,
        size,
      };
    }

    return res.status(201).json({ success: true, files: [result] });
  } catch (err) {
    console.error("❌ Upload single error:", err);
    const status = err?.status || 500;
    return res.status(status).json({ success: false, message: err.message || "Upload failed", error: err?.stack });
  }
};

// Delete uploaded file (by fileKey)
export const deleteUpload = async (req, res) => {
  try {
    const { fileKey } = req.body;
    if (!fileKey) return res.status(400).json({ success: false, message: "fileKey required" });

    if (STORAGE_PROVIDER === "aws_s3") {
      await deleteS3Object(fileKey);
      return res.json({ success: true, message: "Deleted from S3", fileKey });
    } else {
      const filePath = path.join(UPLOAD_DIR, fileKey);
      const exists = await fs.pathExists(filePath);
      if (exists) {
        await fs.remove(filePath);
        return res.json({ success: true, message: "Deleted local file", fileKey });
      } else {
        return res.status(404).json({ success: false, message: "File not found" });
      }
    }
  } catch (err) {
    console.error("❌ Delete upload error:", err);
    const status = err?.status || 500;
    return res.status(status).json({ success: false, message: err.message || "Delete failed", error: err?.stack });
  }
};

// ------------------------------------------------------------------
// Multer middleware wrappers for routes (exported)
// ------------------------------------------------------------------
export const uploadSingle = (fieldName = "file") => {
  return upload.single(fieldName);
};

export const uploadMultiple = (fieldName = "files", maxCount = 10) => {
  return upload.array(fieldName, maxCount);
};

export default {
  upload,
  uploadSingle,
  uploadMultiple,
  uploadSingleHandler,
  uploadMultipleHandler,
  deleteUpload,
};
