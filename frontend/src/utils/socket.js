/**
 * socket.js
 * frontend\src\socket.js
 * ----------------------------------------------------------------
 * Centralized Socket.IO client setup for the Legal Dashboard frontend
 *
 * Features:
 *  ✅ Auto-configures backend URL from .env (VITE_API_URL)
 *  ✅ Automatically injects JWT for authentication
 *  ✅ Graceful connect/disconnect controlled from AuthContext
 *  ✅ Reconnects intelligently on network issues
 */

import { io } from "socket.io-client";

// ✅ Automatically derive the base server URL from your API URL
// Example: if VITE_API_URL = http://localhost:5000/api → SOCKET_URL = http://localhost:5000
const SOCKET_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace("/api", "")
  : "http://localhost:5000";

// === Create socket instance (but don’t connect immediately) ===
export const socket = io(SOCKET_URL, {
  autoConnect: false, // connect manually after login
  withCredentials: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

// === Helper: Attach JWT token dynamically before connecting ===
export const connectSocketWithToken = (token) => {
  if (!token) {
    console.warn("⚠️ Cannot connect socket — missing JWT token");
    return;
  }
  socket.auth = { token }; // optional: backend can validate it
  if (!socket.connected) {
    socket.connect();
    console.log("🔌 Socket.IO connected to:", SOCKET_URL);
  }
};

// === Gracefully disconnect the socket ===
export const disconnectSocket = () => {
  if (socket.connected) {
    socket.disconnect();
    console.log("🧹 Socket.IO disconnected");
  }
};

// === (Optional) Utility: Listen once to confirm connection ===
socket.on("connect", () => {
  console.log("✅ Socket connected:", socket.id);
});

socket.on("disconnect", (reason) => {
  console.log("❌ Socket disconnected:", reason);
});

socket.on("connect_error", (err) => {
  console.error("⚠️ Socket connection error:", err.message);
});

export default socket;
