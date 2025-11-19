// backend/utils/storageProvider.js
// Production-ready storage provider with Cloudflare R2 (S3-compatible) primary
// and local disk fallback.

import fs from "fs";
import path from "path";
import stream from "stream";
import { promisify } from "util";
import dotenv from "dotenv";
import multer from "multer";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NodeHttpHandler } from "@aws-sdk/node-http-handler";
import https from "https";

// Load .env if not already loaded (harmless if already loaded)
dotenv.config();

const pipeline = promisify(stream.pipeline);

/* ----------------------
   Runtime-config helpers
   ---------------------- */
function getProvider() {
  return (process.env.STORAGE_PROVIDER || "r2").toLowerCase();
}

function getUploadsDir() {
  return process.env.UPLOADS_DIR || path.resolve(process.cwd(), "uploads");
}

function getR2Config() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const bucket = process.env.CLOUDFLARE_BUCKET_NAME;
  const key = process.env.CLOUDFLARE_ACCESS_KEY_ID;
  const secret = process.env.CLOUDFLARE_SECRET_ACCESS_KEY;
  const endpoint = process.env.CLOUDFLARE_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined);
  const region = process.env.CLOUDFLARE_REGION || "auto";
  return { accountId, bucket, key, secret, endpoint, region };
}

/* ----------------------
   Ensure uploads dir
   ---------------------- */
const UPLOADS_DIR = getUploadsDir();
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

/* ----------------------
   HTTP Keep-alive agent
   ---------------------- */
const keepAliveAgent = new https.Agent({
  keepAlive: true,
  maxSockets: Number(process.env.HTTP_MAX_SOCKETS || 1000),
  maxFreeSockets: Number(process.env.HTTP_MAX_FREE_SOCKETS || 100),
  timeout: Number(process.env.HTTP_AGENT_TIMEOUT_MS || 30_000),
});

/* ----------------------
   Lazy S3/R2 client init
   ---------------------- */
let _s3Client = null;
function buildS3ClientIfNeeded() {
  if (_s3Client) return _s3Client;
  const provider = getProvider();
  if (!["r2", "s3"].includes(provider)) return null;

  const { bucket, key, secret, endpoint, region } = getR2Config();
  if (!key || !secret || !bucket || !endpoint) {
    console.warn("[storageProvider] Missing R2/S3 config. Falling back to local disk. Set STORAGE_PROVIDER env to 'local' to avoid this warning.");
    return null;
  }

  _s3Client = new S3Client({
    endpoint,
    forcePathStyle: false,
    credentials: { accessKeyId: key, secretAccessKey: secret },
    region: region,
    requestHandler: new NodeHttpHandler({ httpsAgent: keepAliveAgent }),
    maxAttempts: 3,
  });
  return _s3Client;
}

/* ----------------------
   Helpers
   ---------------------- */
function normalizeKey(key) {
  if (!key) throw new Error("Key required");
  return key.replace(/^\//, "").replace(/\s+/g, "_");
}

function generateSafeKey(originalName, prefix = "uploads") {
  const safeBase = path.basename(originalName).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60);
  return normalizeKey(`${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}-${safeBase}`);
}

/* ----------------------
   Core upload functions
   ---------------------- */
export async function uploadBuffer({ buffer, filename, contentType = "application/octet-stream", prefix = "uploads", metadata = {} }) {
  const provider = getProvider();
  const key = generateSafeKey(filename || "file", prefix);

  const client = buildS3ClientIfNeeded();
  if (client && (provider === "r2" || provider === "s3")) {
    const { bucket, endpoint } = getR2Config();
    const cmd = new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: contentType, Metadata: metadata });
    await client.send(cmd);
    const publicUrl = `${endpoint.replace(/\/$/, "")}/${bucket}/${encodeURIComponent(key)}`;
    return { provider: "r2", key, url: publicUrl };
  }

  // local fallback
  const destPath = path.join(UPLOADS_DIR, path.basename(key));
  await fs.promises.writeFile(destPath, buffer);
  return { provider: "local", key: path.basename(destPath), path: destPath, url: `/uploads/${encodeURIComponent(path.basename(destPath))}` };
}

export async function uploadStream({ streamIn, filename, contentType = "application/octet-stream", prefix = "uploads", metadata = {} }) {
  const provider = getProvider();
  const key = generateSafeKey(filename || "file", prefix);
  const client = buildS3ClientIfNeeded();

  if (client && (provider === "r2" || provider === "s3")) {
    const { bucket, endpoint } = getR2Config();
    const cmd = new PutObjectCommand({ Bucket: bucket, Key: key, Body: streamIn, ContentType: contentType, Metadata: metadata });
    await client.send(cmd);
    const publicUrl = `${endpoint.replace(/\/$/, "")}/${bucket}/${encodeURIComponent(key)}`;
    return { provider: "r2", key, url: publicUrl };
  }

  // local fallback
  const destPath = path.join(UPLOADS_DIR, path.basename(key));
  const writeStream = fs.createWriteStream(destPath);
  await pipeline(streamIn, writeStream);
  return { provider: "local", key: path.basename(destPath), path: destPath, url: `/uploads/${encodeURIComponent(path.basename(destPath))}` };
}

/* Convenience: upload a local file path (useful for generated PDFs)
   uploadToStorage(filePath, destKeyPrefix)
*/
export async function uploadToStorage(localPath, destKey) {
  if (!fs.existsSync(localPath)) throw new Error("Local file not found: " + localPath);
  const buffer = await fs.promises.readFile(localPath);
  const filename = destKey || path.basename(localPath);
  return uploadBuffer({ buffer, filename, prefix: path.dirname(filename) });
}

/* Accept a multer file object (req.file)
   - multer memory: file.buffer
   - multer disk: file.path
*/
export async function uploadFile(file, prefix = "uploads") {
  if (!file) throw new Error("No file provided");
  if (file.buffer) {
    return uploadBuffer({ buffer: file.buffer, filename: file.originalname || file.name, prefix, contentType: file.mimetype });
  }
  if (file.path) {
    const rs = fs.createReadStream(file.path);
    return uploadStream({ streamIn: rs, filename: file.originalname || path.basename(file.path), prefix, contentType: file.mimetype });
  }
  throw new Error("Unsupported file object");
}

/* ----------------------
   Signed URL / Get
   ---------------------- */
export async function getSignedUrlForGet(key, expiresIn = 60 * 60) {
  const provider = getProvider();
  const client = buildS3ClientIfNeeded();

  if (client && (provider === "r2" || provider === "s3")) {
    const { bucket } = getR2Config();
    const cmd = new GetObjectCommand({ Bucket: bucket, Key: normalizeKey(key) });
    return getSignedUrl(client, cmd, { expiresIn });
  }

  // local fallback
  const localPath = path.join(UPLOADS_DIR, key);
  if (fs.existsSync(localPath)) return `${process.env.PUBLIC_URL || ""}/uploads/${encodeURIComponent(key)}`;
  throw new Error("Object not found");
}

/* ----------------------
   Delete
   ---------------------- */
export async function deleteObject(key) {
  const provider = getProvider();
  const client = buildS3ClientIfNeeded();

  if (client && (provider === "r2" || provider === "s3")) {
    const { bucket } = getR2Config();
    const cmd = new DeleteObjectCommand({ Bucket: bucket, Key: normalizeKey(key) });
    await client.send(cmd);
    return { provider: "r2", key };
  }

  const p = path.join(UPLOADS_DIR, key);
  if (fs.existsSync(p)) {
    await fs.promises.unlink(p);
    return { provider: "local", key };
  }
  return { provider: "local", key, missing: true };
}

/* ----------------------
   Multer middleware factory
   ---------------------- */
export function multerMiddleware(options = {}) {
  const fieldName = options.fieldName || "file";
  const storageStrategy = options.storage || (getProvider() === "local" ? "disk" : "memory");

  if (storageStrategy === "disk") {
    const dest = options.dest || UPLOADS_DIR;
    const diskStorage = multer.diskStorage({
      destination: (req, file, cb) => cb(null, dest),
      filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, "_")}`),
    });
    return multer({ storage: diskStorage, limits: { fileSize: options.fileSize || Number(process.env.MAX_UPLOAD_FILE_SIZE || 50 * 1024 * 1024) } }).single(fieldName);
  }

  const memoryStorage = multer.memoryStorage();
  const upload = multer({ storage: memoryStorage, limits: { fileSize: options.fileSize || Number(process.env.MAX_UPLOAD_FILE_SIZE || 50 * 1024 * 1024) }, fileFilter: options.fileFilter || ((req, file, cb) => cb(null, true)) });

  return (req, res, next) => {
    const single = upload.single(fieldName);
    single(req, res, async (err) => {
      if (err) return next(err);
      if (!req.file) return next();

      try {
        // Upload immediately if using r2/s3
        if (["r2", "s3"].includes(getProvider()) && buildS3ClientIfNeeded()) {
          const contentType = req.file.mimetype || "application/octet-stream";
          const result = await uploadBuffer({ buffer: req.file.buffer, filename: req.file.originalname, contentType, prefix: options.uploadPrefix || "uploads", metadata: { originalname: req.file.originalname, fieldname: req.file.fieldname, uploadedBy: req.user ? String(req.user._id) : "anonymous" } });
          req.file.storageResult = result;
          delete req.file.buffer; // free memory
        } else {
          // local: multer disk storage would have handled writing, but in memory case we write now
          const dest = path.join(UPLOADS_DIR, `${Date.now()}-${req.file.originalname.replace(/\s+/g, "_")}`);
          await fs.promises.writeFile(dest, req.file.buffer);
          req.file.storageResult = { provider: "local", path: dest, key: path.basename(dest), url: `/uploads/${encodeURIComponent(path.basename(dest))}` };
          delete req.file.buffer;
        }
        return next();
      } catch (uploadErr) {
        console.error("storageProvider upload error:", uploadErr);
        return next(uploadErr);
      }
    });
  };
}

/* ----------------------
   Convenience: direct upload from req.files or req.file
   ---------------------- */
export async function directUploadFromReq(req, field = "files") {
  const files = req.files || (req.file ? [req.file] : []);
  if (!files.length) return [];
  const results = [];
  for (const f of files) {
    if (f.buffer) {
      results.push(await uploadBuffer({ buffer: f.buffer, filename: f.originalname, contentType: f.mimetype }));
    } else if (f.path) {
      const rs = fs.createReadStream(f.path);
      results.push(await uploadStream({ streamIn: rs, filename: f.originalname || path.basename(f.path), contentType: f.mimetype }));
      try { await fs.promises.unlink(f.path); } catch (e) { /* ignore */ }
    }
  }
  return results;
}

/* ----------------------
   Export default compatibility object
   ---------------------- */
export default {
  provider: getProvider(),
  uploadBuffer,
  uploadStream,
  uploadFile,
  uploadToStorage,
  getSignedUrlForGet,
  deleteObject,
  multerMiddleware,
  directUploadFromReq,
  UPLOADS_DIR,
};
