/**
 * backend/middleware/upload.js
 * ---------------------------------------------------------------------
 * Centralized upload middleware for handling user evidence, documents,
 * profile images, and attachments.
 *
 * ✅ Supports both Local & S3 storage
 * ✅ Enforces MIME type & file size limits
 * ✅ Automatically creates upload folder (local)
 * ✅ Configurable ACL & metadata
 * ✅ Returns structured file info for DB storage
 */

import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { S3Client } from "@aws-sdk/client-s3";
import multerS3 from "multer-s3";
import dotenv from "dotenv";

dotenv.config();

/* =======================================================
   1️⃣ ENVIRONMENT CONFIG
   ======================================================= */
const {
  UPLOAD_PROVIDER = "local", // "local" | "s3"
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  AWS_REGION,
  S3_BUCKET_NAME,
  S3_ACL = "private", // set "public-read" for public access
} = process.env;

// Allowed MIME types (expand as needed)
export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/zip",
  "application/x-zip-compressed",
];

// Max 50 MB
export const MAX_FILE_SIZE = 50 * 1024 * 1024;

/* =======================================================
   2️⃣ Helper — Unique File Name Generator
   ======================================================= */
function generateFileName(originalName) {
  const uniqueId = crypto.randomBytes(8).toString("hex");
  const ext = path.extname(originalName);
  const base = path
    .basename(originalName, ext)
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 50);
  return `${Date.now()}-${uniqueId}-${base}${ext}`;
}

/* =======================================================
   3️⃣ File Filter — Enforce MIME Whitelist
   ======================================================= */
function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(
      new Error(
        `Unsupported file type: ${file.mimetype}. Allowed: ${ALLOWED_MIME_TYPES.join(
          ", "
        )}`
      ),
      false
    );
  }
  cb(null, true);
}

/* =======================================================
   4️⃣ Storage Engine: Local (Default)
   ======================================================= */
const localDir = path.join(process.cwd(), "uploads");

// Ensure directory exists
if (!fs.existsSync(localDir)) {
  fs.mkdirSync(localDir, { recursive: true });
}

const localStorage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, localDir);
  },
  filename(req, file, cb) {
    cb(null, generateFileName(file.originalname));
  },
});

/* =======================================================
   5️⃣ Storage Engine: S3 (Optional)
   ======================================================= */
let s3Storage = null;

if (UPLOAD_PROVIDER === "s3") {
  const s3 = new S3Client({
    region: AWS_REGION,
    credentials: {
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
    },
  });

  s3Storage = multerS3({
    s3,
    bucket: S3_BUCKET_NAME,
    acl: S3_ACL, // configurable
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key(req, file, cb) {
      cb(null, generateFileName(file.originalname));
    },
    metadata(req, file, cb) {
      cb(null, {
        originalName: file.originalname,
        uploadBy: req.user?._id?.toString() || "anonymous",
      });
    },
  });
}

/* =======================================================
   6️⃣ Choose Active Storage
   ======================================================= */
const activeStorage =
  UPLOAD_PROVIDER === "s3" && s3Storage ? s3Storage : localStorage;

/* =======================================================
   7️⃣ Multer Instance with Limits & Filter
   ======================================================= */
const upload = multer({
  storage: activeStorage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
});

/* =======================================================
   8️⃣ Exported Middleware Functions
   ======================================================= */

// ✅ Single File Upload
export const uploadSingle = (fieldName = "file") => (req, res, next) => {
  const single = upload.single(fieldName);
  single(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        message: "File upload failed",
        error: err.message,
      });
    }
    next();
  });
};

// ✅ Multiple File Upload
export const uploadArray = (fieldName = "files", maxCount = 10) => (req, res, next) => {
  const multiple = upload.array(fieldName, maxCount);
  multiple(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        message: "File upload failed",
        error: err.message,
      });
    }
    next();
  });
};

// ✅ Named Fields Upload
export const uploadFields = (fields) => (req, res, next) => {
  const handler = upload.fields(fields);
  handler(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        message: "File upload failed",
        error: err.message,
      });
    }
    next();
  });
};

/* =======================================================
   9️⃣ Helper — Get File Metadata
   ======================================================= */
export function getUploadedFileInfo(file) {
  if (!file) return null;

  if (UPLOAD_PROVIDER === "s3") {
    return {
      name: file.originalname,
      fileUrl: file.location, // public S3 URL or presigned path
      bucket: file.bucket,
      key: file.key,
      size: file.size,
      mimeType: file.mimetype,
      uploadedAt: new Date(),
    };
  }

  // Local file info
  return {
    name: file.originalname,
    fileUrl: `/uploads/${file.filename}`,
    size: file.size,
    mimeType: file.mimetype,
    uploadedAt: new Date(),
  };
}

export default upload;
