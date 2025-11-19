/**
 * backend/server.js
 * ------------------------------------------------------------
 * Relaxed CSP edition
 *
 * - CSP relaxed to allow data: fonts, Google Maps frames, and common https: sources
 * - Keeps Helmet defaults + other security middleware intact
 * - All other app features (routes, sockets, logging, graceful shutdown) preserved
 */

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import mongoose from "mongoose";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import cors from "cors";
import rateLimit from "express-rate-limit";
import mongoSanitize from "express-mongo-sanitize";
import xss from "xss-clean";
import cookieParser from "cookie-parser";
import winston from "winston";
import "winston-daily-rotate-file";
import http from "http";
import fs from "fs";
import { Server as SocketServer } from "socket.io";

// Auth middleware (keep your actual implementation)
import { protect } from "./middleware/authMiddleware.js";

// Load env
dotenv.config();

/* -------------------------------------------------------------------------- */
/* 📍 PATHS */
/* -------------------------------------------------------------------------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* -------------------------------------------------------------------------- */
/* ⚙️ CONFIG */
/* -------------------------------------------------------------------------- */
const NODE_ENV = process.env.NODE_ENV || "development";
const PORT = Number(process.env.PORT || 5000);
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/legal";

const TRUST_PROXY = process.env.TRUST_PROXY === "true" || NODE_ENV === "production";
const SERVE_FRONTEND = process.env.SERVE_FRONTEND === "true" || NODE_ENV === "production";

// Parse allowed origins reliably (avoid empty string entry)
const rawOrigins = process.env.CORS_ALLOWED_ORIGINS ?? "";
const ALLOWED_ORIGINS =
  rawOrigins.trim() !== ""
    ? rawOrigins.split(",").map((s) => s.trim())
    : ["http://localhost:5173"];

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, "uploads");
const CLIENT_BUILD_DIR = process.env.CLIENT_BUILD_DIR || path.join(__dirname, "..", "frontend", "dist");

/* -------------------------------------------------------------------------- */
/* 📦 ROUTES (import your route modules as before) */
/* -------------------------------------------------------------------------- */
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/userRoutes.js";
import clientRoutes from "./routes/clientRoutes.js";
import caseRoutes from "./routes/caseRoutes.js";
import taskRoutes from "./routes/taskRoutes.js";
import hearingRoutes from "./routes/hearingRoutes.js";
import reportRoutes from "./routes/reports.js";
import arbitrationRoutes from "./routes/arbitrationRoutes.js";
import evidenceRoutes from "./routes/evidenceRoutes.js";
import awardRoutes from "./routes/awardRoutes.js";
import reconciliationRoutes from "./routes/reconciliationRoutes.js";
import sessionRoutes from "./routes/sessionRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import advocateDashboardRoutes from "./routes/advocateDashboardRoutes.js";

/* -------------------------------------------------------------------------- */
/* 📝 LOGGING SETUP */
/* -------------------------------------------------------------------------- */
const logDir = path.join(__dirname, "logs");
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

const logger = winston.createLogger({
  level: NODE_ENV === "production" ? "info" : "debug",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.DailyRotateFile({
      dirname: logDir,
      filename: "app-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      zippedArchive: true,
      maxSize: "20m",
      maxFiles: "30d",
    }),
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
  ],
});

const morganStream = {
  write: (msg) => logger.info(msg.trim()),
};

/* -------------------------------------------------------------------------- */
/* 🚀 EXPRESS + SOCKET.IO INIT */
/* -------------------------------------------------------------------------- */
const app = express();
if (TRUST_PROXY) app.set("trust proxy", 1);

const server = http.createServer(app);

const io = new SocketServer(server, {
  cors: { origin: ALLOWED_ORIGINS, credentials: true },
  transports: ["websocket", "polling"],
});

// Make io available in controllers (NO CIRCULAR IMPORTS)
app.set("io", io);

/* -------------------------------------------------------------------------- */
/* ⚡ SOCKET.IO EVENTS */
/* -------------------------------------------------------------------------- */
io.on("connection", (socket) => {
  logger.info(`🟢 Socket connected → ${socket.id}`);

  // Auto join personal room if userId is passed
  const userId = socket.handshake.query?.userId;
  if (userId) socket.join(`user_${userId}`);

  socket.on("joinRoom", (room) => {
    if (room) {
      socket.join(room);
      logger.info(`📡 ${socket.id} joined room ${room}`);
    }
  });

  socket.on("disconnect", (reason) => {
    logger.info(`🔴 Socket ${socket.id} disconnected (${reason})`);
  });
});

io.on("error", (err) => logger.error("Socket.IO error:", err));

/* -------------------------------------------------------------------------- */
/* 🧰 SECURITY & MIDDLEWARE */
/* -------------------------------------------------------------------------- */
/**
 * Relaxed CSP rationale:
 * - During local/dev and many deployments you want Google Maps embeds, data: fonts,
 *   and remote fonts/styles to load. We allow https: and data: where necessary.
 * - This is less strict than a minimal 'self' policy but still restricts sources
 *   to HTTPS origins and the configured ALLOWED_ORIGINS.
 *
 * If you need to tighten later, remove `data:` and restrict the https: entries to specific domains.
 */

const googleFrameOrigins = [
  "https://www.google.com",
  "https://maps.google.com",
  "https://maps.gstatic.com",
  "https://www.google.co.uk",
  "https://www.google.co.ke",
];

// frame-src should include frontend hosts + Google Maps so <iframe src="https://www.google.com/maps..."> works
const frameSrcOrigins = Array.from(
  new Set(["'self'", "https://www.google.com", "https://maps.google.com", "https://maps.gstatic.com", ...ALLOWED_ORIGINS])
);

// Compose directives with relaxed but reasonable allowances
const imgSrc = ["'self'", "data:", "blob:", "https:" , ...ALLOWED_ORIGINS];
const scriptSrc = ["'self'", "'unsafe-inline'", "https:", ...ALLOWED_ORIGINS];
const styleSrc = ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https:", ...ALLOWED_ORIGINS];
const fontSrc = ["'self'", "https://fonts.gstatic.com", "data:", "https:", ...ALLOWED_ORIGINS];
const connectSrc = ["'self'", "https:", ...ALLOWED_ORIGINS]; // allows websocket/connect to same origin and configured origins

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "frame-src": frameSrcOrigins,
        "img-src": imgSrc,
        "script-src": scriptSrc,
        "style-src": styleSrc,
        "font-src": fontSrc,
        "connect-src": connectSrc,
      },
    },
  })
);

// Response compression, cookie parsing, request logging
app.use(compression());
app.use(cookieParser());
app.use(morgan(NODE_ENV === "production" ? "combined" : "dev", { stream: morganStream }));

// Body parsing
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

// Data sanitization
app.use(mongoSanitize());
app.use(xss());

// CORS: allow configured origins (and no origin -> allow for server-side tools)
// If you want to relax CORS further in dev, set CORS_ALLOWED_ORIGINS="*" in env (careful in prod)
app.use(
  cors({
    origin: (origin, cb) => {
      // allow non-browser requests (curl, server-to-server) when origin is undefined
      if (!origin) return cb(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      logger.warn(`CORS blocked: ${origin}`);
      return cb(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
  })
);

/* -------------------------------------------------------------------------- */
/* 🚦 RATE LIMITERS */
/* -------------------------------------------------------------------------- */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1500,
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
});

/* -------------------------------------------------------------------------- */
/* 📂 STATIC FILES */
/* -------------------------------------------------------------------------- */
if (!fs.existsSync(UPLOADS_DIR)) {
  try {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    logger.info(`Created uploads dir: ${UPLOADS_DIR}`);
  } catch (err) {
    logger.error("Failed to create uploads dir:", err);
  }
}
app.use("/uploads", express.static(UPLOADS_DIR));

/* -------------------------------------------------------------------------- */
/* 🧭 API ROUTES */
/* -------------------------------------------------------------------------- */
app.use("/api", globalLimiter);

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/users", protect, userRoutes);
app.use("/api/clients", protect, clientRoutes);
app.use("/api/cases", protect, caseRoutes);
app.use("/api/tasks", protect, taskRoutes);
app.use("/api/hearings", protect, hearingRoutes);
app.use("/api/reports", protect, reportRoutes);
app.use("/api/arbitrations", protect, arbitrationRoutes);
app.use("/api/evidence", protect, evidenceRoutes);
app.use("/api/awards", protect, awardRoutes);
app.use("/api/reconciliations", protect, reconciliationRoutes);
app.use("/api/sessions", protect, sessionRoutes);
app.use("/api/notifications", protect, notificationRoutes);
app.use("/api/dashboard/advocate", protect, advocateDashboardRoutes);
app.use("/api/upload", uploadRoutes);

/* -------------------------------------------------------------------------- */
/* 🩺 HEALTH CHECKS */
/* -------------------------------------------------------------------------- */
app.get("/healthz", (req, res) => res.json({ status: "ok", success: true }));
app.get("/ready", (req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({ ready, success: ready });
});

/* -------------------------------------------------------------------------- */
/* 🎨 FRONTEND (React) SERVING */
/* -------------------------------------------------------------------------- */
if (SERVE_FRONTEND) {
  if (fs.existsSync(CLIENT_BUILD_DIR)) {
    app.use(express.static(CLIENT_BUILD_DIR));

    app.get("*", (req, res, next) => {
      if (req.url.startsWith("/api/")) return next();
      res.sendFile(path.join(CLIENT_BUILD_DIR, "index.html"));
    });
  } else {
    logger.warn(`⚠️ Frontend build not found: ${CLIENT_BUILD_DIR}`);
  }
}

/* -------------------------------------------------------------------------- */
/* ❌ GLOBAL ERROR HANDLER */
/* -------------------------------------------------------------------------- */
app.use((err, req, res, next) => {
  logger.error("Unhandled Error:", err);

  const status = err.status || 500;
  const payload = {
    success: false,
    message: err.message || "Internal server error",
  };

  if (NODE_ENV !== "production") payload.stack = err.stack;
  res.status(status).json(payload);
});

/* -------------------------------------------------------------------------- */
/* 🚀 START SERVER */
/* -------------------------------------------------------------------------- */
async function start() {
  try {
    await mongoose.connect(MONGO_URI);
    logger.info("📦 MongoDB connected");

    server.listen(PORT, () =>
      logger.info(`🚀 Server running at http://localhost:${PORT} in ${NODE_ENV}`)
    );
  } catch (err) {
    logger.error("❌ Fatal startup failure:", err);
    process.exit(1);
  }
}
start();

/* -------------------------------------------------------------------------- */
/* 🔌 GRACEFUL SHUTDOWN */
/* -------------------------------------------------------------------------- */
const shutdown = async (signal) => {
  logger.warn(`⚠️ Received ${signal}. Shutting down...`);

  try {
    server.close(() => logger.info("HTTP server closed"));
    io.close();
    await mongoose.connection.close(false);

    logger.info("🛑 Graceful shutdown complete");
    process.exit(0);
  } catch (err) {
    logger.error("Shutdown error:", err);
    process.exit(1);
  }
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

export default app;
