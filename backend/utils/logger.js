// backend/utils/logger.js
import winston from "winston";
import "winston-daily-rotate-file";
import fs from "fs";
import path from "path";

// Ensure logs directory exists
const logDir = process.env.LOG_DIR || "logs";
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.printf(
    ({ timestamp, level, message, stack, ...meta }) =>
      `${timestamp} [${level.toUpperCase()}] ${message}${
        stack ? `\n${stack}` : ""
      } ${Object.keys(meta).length ? JSON.stringify(meta) : ""}`
  )
);

// Daily rotate transport
const rotateTransport = new winston.transports.DailyRotateFile({
  dirname: logDir,
  filename: "app-%DATE%.log",
  datePattern: "YYYY-MM-DD",
  maxFiles: "14d", // keep logs for 14 days
  zippedArchive: true,
  level: process.env.LOG_LEVEL_FILE || "info",
});

// Console transport with colorized output
const consoleTransport = new winston.transports.Console({
  level: process.env.LOG_LEVEL_CONSOLE || (process.env.NODE_ENV === "production" ? "info" : "debug"),
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.simple()
  ),
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: logFormat,
  transports: [consoleTransport, rotateTransport],
  exceptionHandlers: [
    new winston.transports.File({ filename: path.join(logDir, "exceptions.log") }),
  ],
  rejectionHandlers: [
    new winston.transports.File({ filename: path.join(logDir, "rejections.log") }),
  ],
  exitOnError: false, // do not exit on handled exceptions
});

export default logger;
