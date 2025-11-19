// frontend/src/components/common/NotificationsDrawer.jsx
import React, { useEffect, useState } from "react";
import { Bell, Trash2, Check, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import io from "socket.io-client";
import api from "@/utils/api";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";

const socket = io(import.meta.env.VITE_API_URL || "http://localhost:5000", {
  transports: ["websocket"],
  withCredentials: true,
});

export default function NotificationsDrawer() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  // === Fetch notifications ===
  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await api.get("/notifications");
      setNotifications(res.data || []);
    } catch (err) {
      console.error("Error fetching notifications", err);
      toast.error("Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };

  // === Socket setup for realtime updates ===
  useEffect(() => {
    if (!user?._id) return;

    socket.emit("register", user._id);
    fetchNotifications();

    socket.on("notification:new", (newNotif) => {
      if (newNotif.recipient === user._id) {
        setNotifications((prev) => [newNotif, ...prev]);
        toast(`🔔 ${newNotif.title}`);
      }
    });

    return () => {
      socket.off("notification:new");
    };
  }, [user]);

  // === Mark single notification as read ===
  const markAsRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
    } catch (err) {
      console.error("Failed to mark as read", err);
    }
  };

  // === Mark all as read ===
  const markAllAsRead = async () => {
    try {
      await api.patch("/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      toast.success("All notifications marked as read");
    } catch (err) {
      toast.error("Failed to update notifications");
    }
  };

  // === Delete notification ===
  const deleteNotification = async (id) => {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications((prev) => prev.filter((n) => n._id !== id));
      toast.success("Notification deleted");
    } catch (err) {
      console.error("Failed to delete notification", err);
    }
  };

  // === Unread count ===
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // === UI ===
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-full hover:bg-black-100 transition"
      >
        <Bell className="text-black-700 w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 bg-red-500 text-white text-xs font-semibold px-1.5 py-0.5 rounded-full">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 mt-2 w-96 bg-white shadow-lg rounded-xl border border-black-100 z-50"
          >
            <div className="flex items-center justify-between p-3 border-b border-black-100">
              <h3 className="text-black-700 font-semibold text-sm">
                Notifications
              </h3>
              <div className="flex items-center gap-2">
                {notifications.length > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    <CheckCircle size={14} /> Mark all as read
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto p-2">
              {loading ? (
                <div className="text-black-400 text-sm text-center py-6">
                  Loading...
                </div>
              ) : notifications.length === 0 ? (
                <div className="text-black-400 text-sm text-center py-6">
                  No notifications yet
                </div>
              ) : (
                notifications.map((notif) => (
                  <motion.div
                    key={notif._id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex justify-between items-start p-3 mb-1 rounded-lg cursor-pointer ${
                      notif.isRead
                        ? "bg-black-50 hover:bg-black-100"
                        : "bg-blue-50 hover:bg-blue-100"
                    }`}
                    onClick={() => {
                      markAsRead(notif._id);
                      if (notif.link) window.location.href = notif.link;
                    }}
                  >
                    <div className="flex-1 pr-2">
                      <div className="font-medium text-black-800 text-sm">
                        {notif.title}
                      </div>
                      <div className="text-xs text-black-600 mt-1">
                        {notif.message}
                      </div>
                      <div className="text-[10px] text-black-400 mt-1">
                        {new Date(notif.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(notif._id);
                      }}
                      className="text-black-400 hover:text-red-500 transition"
                    >
                      <Trash2 size={14} />
                    </button>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
