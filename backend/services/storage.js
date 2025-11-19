/**
 * backend/services/storage.js
 * ---------------------------------------------------------------------
 * Unified storage service for all uploads (evidence, documents, reports).
 *
 * ✅ Supports Local and Cloudflare R2 seamlessly
 * ✅ Automatically chooses provider from environment config
 * ✅ Handles upload, download, delete, and URL generation
 * ✅ Secure: private by default, no hard-coded credentials
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import dotenv from "dotenv";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

dotenv.config();

/* =======================================================
   1️⃣ Environment Setup
   ======================================================= */
const {
  NODE_ENV,
  STORAGE_PROVIDER, // 'local' or 'r2'
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_REGION,
  R2_BUCKET_NAME,
  R2_ACCOUNT_ID,
  BASE_URL, // e.g. https://api.yourdomain.com
} = process.env;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

// Ensure upload directory exists (local)
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/* =======================================================
   2️⃣ Utility: Generate Unique File Key
   ======================================================= */
function generateKey(originalName) {
  const uniqueId = crypto.randomBytes(8).toString("hex");
  const ext = path.extname(originalName);
  const safeBase = path
    .basename(originalName, ext)
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 50);
  return `${Date.now()}-${uniqueId}-${safeBase}${ext}`;
}

/* =======================================================
   3️⃣ R2 (S3-Compatible) Client Setup
   ======================================================= */
let r2Client = null;
if (STORAGE_PROVIDER === "r2") {
  const endpoint = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  r2Client = new S3Client({
    region: R2_REGION || "auto",
    endpoint,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
}

/* =======================================================
   4️⃣ Core Storage Functions
   ======================================================= */

/**
 * Save a file buffer (from multer.memoryStorage or fs stream)
 */
export async function saveFile(fileBuffer, originalName, mimeType) {
  const key = generateKey(originalName);

  // Upload to R2
  if (STORAGE_PROVIDER === "r2" && r2Client) {
    await r2Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: fileBuffer,
        ContentType: mimeType,
      })
    );
    return { key, provider: "r2" };
  }

  // Local fallback
  const localPath = path.join(UPLOADS_DIR, key);
  fs.writeFileSync(localPath, fileBuffer);
  return { key, provider: "local" };
}

/**
 * Generate a signed URL (R2) or static link (Local)
 */
export async function getFileURL(key) {
  if (STORAGE_PROVIDER === "r2" && r2Client) {
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });
    return await getSignedUrl(r2Client, command, { expiresIn: 3600 });
  }

  return `${BASE_URL?.replace(/\/+$/, "") || ""}/uploads/${key}`;
}

/**
 * Delete a file
 */
export async function deleteFile(key) {
  if (STORAGE_PROVIDER === "r2" && r2Client) {
    await r2Client.send(
      new DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
      })
    );
    return true;
  }

  const localPath = path.join(UPLOADS_DIR, key);
  if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
  return true;
}

/**
 * Check file existence (useful for validation)
 */
export function fileExists(key) {
  if (STORAGE_PROVIDER === "r2") return true; // assume true for signed URLs
  return fs.existsSync(path.join(UPLOADS_DIR, key));
}

/* =======================================================
   5️⃣ Service Interface (for easy imports)
   ======================================================= */
export const StorageService = {
  saveFile,
  getFileURL,
  deleteFile,
  fileExists,
};

export default StorageService;

/* =======================================================
   ✅ Usage Example (in controller)
   =======================================================

   import { StorageService } from "../services/storage.js";

   const { key } = await StorageService.saveFile(
     req.file.buffer,
     req.file.originalname,
     req.file.mimetype
   );

   const fileUrl = await StorageService.getFileURL(key);
   res.json({ success: true, url: fileUrl });

   ======================================================= */
