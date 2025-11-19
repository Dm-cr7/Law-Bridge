// backend/utils/socketEmitter.js
/**
 * socketEmitter.js
 * ------------------------------------------------------------
 * Centralized helper for emitting Socket.IO events without
 * creating circular imports. Use `setIO(io)` once in server.js.
 *
 * Usage:
 *  - server.js: import { setIO } from "./utils/socketEmitter.js"; setIO(io);
 *  - controllers: import { emitSocketEvent } from "../utils/socketEmitter.js";
 *
 * Notes:
 *  - Safe no-op if io not set (useful during startup & tests)
 *  - Optional per-room or global emit helpers
 *  - Logs emissions in non-production for visibility
 * ------------------------------------------------------------
 */

let _io = null;

/**
 * Register the Socket.IO instance (call once in server.js after io created)
 * @param {import("socket.io").Server} io
 */
export function setIO(io) {
  _io = io;
  if (process.env.NODE_ENV !== "production") {
    console.info("📡 socketEmitter: Socket.IO instance registered");
  }
}

/**
 * Return currently registered io (may be null)
 */
export function getIO() {
  return _io;
}

/**
 * Emit a Socket.IO event safely.
 * @param {string} event - event name
 * @param {string|string[]|null} room - room string, array of rooms, or null for global
 * @param {object} payload - event payload
 * @returns {boolean} emitted
 */
export function emitSocketEvent(event, room = null, payload = {}) {
  try {
    if (!_io) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[socketEmitter] io not set — skipping emit ${event}`);
      }
      return false;
    }

    // Global broadcast
    if (!room) {
      _io.emit(event, payload);
      _logEvent("GLOBAL", event, payload);
      return true;
    }

    // One or more rooms
    const rooms = Array.isArray(room) ? room : [room];
    for (const r of rooms) {
      if (!r) continue;
      // ensure string
      const roomId = typeof r === "string" ? r : String(r);
      _io.to(roomId).emit(event, payload);
      _logEvent(roomId, event, payload);
    }

    return true;
  } catch (err) {
    console.error(`[socketEmitter] emit error for ${event}:`, err && err.message ? err.message : err);
    return false;
  }
}

/**
 * Emit to everyone except socket id(s) (experimental; uses broadcasting to rooms)
 * @param {string} event
 * @param {string|string[]|null} excludeSocketId - socket id or array of ids to exclude
 * @param {object} payload
 */
export function emitSocketExcept(event, excludeSocketId, payload = {}) {
  try {
    if (!_io) return false;

    // socket.io v4 supports except(); fallback if not available
    if (typeof _io.except === "function" && excludeSocketId) {
      _io.except(Array.isArray(excludeSocketId) ? excludeSocketId : String(excludeSocketId)).emit(event, payload);
      _logEvent(`EXCEPT:${excludeSocketId}`, event, payload);
      return true;
    }

    // Fallback: broadcast globally (can't exclude). Log the limitation.
    _io.emit(event, payload);
    _logEvent("GLOBAL_FALLBACK", event, payload);
    if (process.env.NODE_ENV !== "production") {
      console.warn("[socketEmitter] except() not available on this io instance — emitted globally as fallback.");
    }
    return true;
  } catch (err) {
    console.error(`[socketEmitter] emitExcept error for ${event}:`, err.message || err);
    return false;
  }
}

/**
 * Broadcast a system notice to everyone
 */
export function broadcastSystemNotice(message, level = "info") {
  try {
    if (!_io) return false;
    const payload = { type: "system", message, level, timestamp: new Date().toISOString() };
    _io.emit("system:notice", payload);
    _logEvent("GLOBAL", "system:notice", payload);
    return true;
  } catch (err) {
    console.error("[socketEmitter] Failed to broadcast system notice:", err.message || err);
    return false;
  }
}

/* Internal logger */
function _logEvent(room, event, payload) {
  if (process.env.NODE_ENV === "production") return;
  let preview;
  try {
    const s = JSON.stringify(payload);
    preview = s.length > 120 ? s.slice(0, 120) + "..." : s;
  } catch (e) {
    preview = String(payload).slice(0, 120);
  }
  console.log(`📡 [socketEmitter] → Room: ${room} | Event: ${event} | Payload: ${preview}`);
}
