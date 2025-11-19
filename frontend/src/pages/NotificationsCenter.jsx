// frontend/src/pages/NotificationsCenter.jsx
import React, { useEffect, useState, useRef } from "react";
import { motion as Motion } from "framer-motion";
import { Bell, Trash2, Loader2, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import API from "../utils/api";
import io from "socket.io-client";

/**
 * NotificationsCenter.jsx
 * ==========================================================
 * ✅ Real-time notifications for all user roles
 * ✅ Syncs with backend and Socket.IO
 * ✅ Supports read/unread, delete, and batch actions
 * ✅ Auto-refresh + sound alert on new notifications
 */

export default function NotificationsCenter() {
  const { user, token } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const socketRef = useRef(null);

  // === Connect to Socket.IO server ===
  useEffect(() => {
    if (!token || !user) return;

    const backendURL = import.meta.env.VITE_API_URL || "http://localhost:5000";
    const socket = io(backendURL, {
      auth: { token },
      transports: ["websocket"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("🔌 Connected to Socket.IO for notifications");
    });

    socket.on("notification:new", (notif) => {
      toast.message("🔔 New Notification", {
        description: notif.title || notif.message,
      });
      setNotifications((prev) => [notif, ...prev]);
      playNotificationSound();
    });

    socket.on("disconnect", () => {
      console.warn("⚠️ Disconnected from notification server");
    });

    return () => {
      socket.disconnect();
    };
  }, [token, user]);

  // === Fetch notification history ===
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const { data } = await API.get("/notifications");
        setNotifications(data || []);
      } catch (err) {
        console.error("Error loading notifications", err);
      } finally {
        setLoading(false);
      }
    };
    fetchNotifications();
  }, []);

  // === Play sound for new notifications ===
  const playNotificationSound = () => {
    try {
      const audio = new Audio("/sounds/notification.mp3");
      audio.volume = 0.5;
      audio.play().catch(() => {});
    } catch {
      /* Ignore autoplay errors */
    }
  };

  // === Mark notification as read ===
  const markAsRead = async (id) => {
    try {
      await API.put(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, read: true } : n))
      );
    } catch (err) {
      toast.error("Failed to mark as read");
    }
  };

  // === Delete notification ===
  const deleteNotification = async (id) => {
    try {
      await API.delete(`/notifications/${id}`);
      setNotifications((prev) => prev.filter((n) => n._id !== id));
    } catch {
      toast.error("Failed to delete notification");
    }
  };

  // === Mark all as read ===
  const markAllRead = async () => {
    try {
      setMarkingAll(true);
      await API.put("/notifications/mark-all-read");
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      toast.success("All notifications marked as read");
    } catch {
      toast.error("Failed to mark all as read");
    } finally {
      setMarkingAll(false);
    }
  };

  // === Delete all notifications ===
  const deleteAll = async () => {
    if (!window.confirm("Delete all notifications permanently?")) return;
    try {
      await API.delete("/notifications");
      setNotifications([]);
      toast.success("All notifications deleted");
    } catch {
      toast.error("Failed to delete notifications");
    }
  };

  // === UI Render ===
  if (loading) {
    return (
      <div className="flex justify-center items-center h-[70vh] text-slate-600">
        <Loader2 className="animate-spin mr-2" /> Loading notifications...
      </div>
    );
  }

  return (
    <div className="notifications-page bg-black-50 dark:bg-black-900 min-h-screen py-10 px-6">
      <div className="max-w-3xl mx-auto bg-white dark:bg-black-800 shadow rounded-xl p-6">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
              <Bell size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                Notifications Center
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                Stay updated with real-time system alerts
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={markAllRead}
              disabled={markingAll}
              className={`flex items-center gap-1 px-4 py-2 rounded-md text-white ${
                markingAll
                  ? "bg-slate-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {markingAll ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <CheckCircle size={16} />
              )}
              Mark All Read
            </button>

            <button
              onClick={deleteAll}
              className="flex items-center gap-1 px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white"
            >
              <Trash2 size={16} /> Clear All
            </button>
          </div>
        </div>

        {notifications.length === 0 ? (
          <div className="text-center text-slate-500 dark:text-slate-400 py-10">
            <Bell className="mx-auto mb-3 opacity-40" size={40} />
            No notifications yet.
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notif, idx) => (
              <Motion.div
                key={notif._id || idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex items-start justify-between p-4 rounded-lg border ${
                  notif.read
                    ? "bg-black-100 dark:bg-black-800/60 border-transparent"
                    : "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                }`}
              >
                <div className="flex-1 pr-4">
                  <h3 className="font-medium text-slate-900 dark:text-slate-100">
                    {notif.title || "System Notification"}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    {notif.message}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {new Date(notif.createdAt).toLocaleString()}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-2">
                  {!notif.read && (
                    <button
                      onClick={() => markAsRead(notif._id)}
                      className="text-green-600 hover:text-green-700"
                      title="Mark as read"
                    >
                      <CheckCircle size={18} />
                    </button>
                  )}
                  <button
                    onClick={() => deleteNotification(notif._id)}
                    className="text-red-500 hover:text-red-600"
                    title="Delete notification"
                  >
                    <XCircle size={18} />
                  </button>
                </div>
              </Motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
