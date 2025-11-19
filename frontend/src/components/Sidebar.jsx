// frontend/src/components/Sidebar.jsx
import React, { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Home,
  User,
  Settings,
  LogOut,
  BarChart2,
  FileText,
  Users,
  Briefcase,
  Bell,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FilePlus2,
  FolderOpen,
  Activity,
  CalendarDays,
} from "lucide-react";
import { io } from "socket.io-client";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext"; // ✅ useAuth instead of manual API
import API from "@/utils/api";

/**
 * Sidebar.jsx
 * ------------------------------------------------
 * 🔹 Role-based navigation for all user types
 * 🔹 Real-time notifications via Socket.IO
 * 🔹 Expand / collapse toggle
 * 🔹 Uses AuthContext for global user session
 * ------------------------------------------------
 */

export default function Sidebar({ isExpanded, setExpanded }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [unread, setUnread] = useState(0);

  /* ==========================================================
     ⚡ Real-time Socket Connection (Notifications)
  ========================================================== */
  useEffect(() => {
    if (!user?._id) return;

    const socket = io(import.meta.env.VITE_BACKEND_URL, {
      transports: ["websocket"],
      withCredentials: true,
      query: { userId: user._id },
    });

    socket.on("connect", () => console.log("✅ Socket connected"));
    socket.on("disconnect", () => console.warn("⚠️ Socket disconnected"));
    socket.on("notifications:update", (count) => setUnread(count));
    socket.on("notifications:new", (notif) => {
      toast.info(notif.message);
      setUnread((prev) => prev + 1);
    });

    return () => socket.disconnect();
  }, [user]);

  /* ==========================================================
     🚪 Logout Handler
  ========================================================== */
  const handleLogout = async () => {
    try {
      await API.post("/auth/logout");
      logout(); // from AuthContext
      toast.success("Logged out successfully");
      navigate("/login");
    } catch {
      toast.error("Logout failed");
    }
  };

  /* ==========================================================
     📋 Role-Based Navigation
     NOTE: Dashboard link is now neutral (/dashboard) — RoleBasedDashboard
     or explicit role routes will decide what the user sees.
  ========================================================== */
  const navItems = useMemo(() => {
    if (!user?.role) return [];

    // Neutral dashboard + shared items
    // <-- Hearings added to common so visible for all roles
    const common = [
      { to: "/dashboard", label: "Dashboard", icon: <Home /> },
      { to: "/dashboard/profile", label: "Profile", icon: <User /> },
      { to: "/dashboard/hearings", label: "Hearings", icon: <CalendarDays /> },
    ];

    switch ((user.role || "").toLowerCase()) {
      case "advocate":
        return [
          ...common,
          { to: "/dashboard/cases", label: "Cases", icon: <Briefcase /> },
          { to: "/dashboard/clients", label: "Clients", icon: <Users /> },
          { to: "/dashboard/tasks", label: "Tasks", icon: <ClipboardList /> },
          { to: "/dashboard/reports", label: "Reports", icon: <BarChart2 /> },
          { to: "/dashboard/analytics", label: "Analytics", icon: <Activity /> },
          { to: "/dashboard/settings", label: "Settings", icon: <Settings /> },
        ];

      case "paralegal":
        return [
          ...common,
          { to: "/dashboard/intake", label: "Intake", icon: <ClipboardList /> },
          { to: "/dashboard/tasks", label: "Tasks", icon: <ClipboardList /> },
          { to: "/dashboard/documents", label: "Documents", icon: <FileText /> },
          { to: "/dashboard/support", label: "Support", icon: <Users /> },
        ];

      case "admin":
        return [
          ...common,
          { to: "/dashboard/tasks", label: "Tasks", icon: <ClipboardList /> },
          { to: "/dashboard/users", label: "User Management", icon: <Users /> },
          { to: "/dashboard/analytics", label: "Analytics", icon: <BarChart2 /> },
          { to: "/dashboard/settings", label: "Settings", icon: <Settings /> },
        ];

      case "mediator":
        return [
          ...common,
          { to: "/dashboard/sessions", label: "Sessions", icon: <FolderOpen /> },
          { to: "/dashboard/parties", label: "Parties", icon: <Users /> },
          { to: "/dashboard/reports", label: "Reports", icon: <BarChart2 /> },
        ];

      case "arbitrator":
        return [
          ...common,
          { to: "/dashboard/arbitrations", label: "Arbitrations", icon: <FilePlus2 /> },
          { to: "/dashboard/evidence", label: "Evidence", icon: <FolderOpen /> },
          { to: "/dashboard/awards", label: "Awards", icon: <BarChart2 /> },
        ];

      default:
        return common;
    }
  }, [user]);

  /* ==========================================================
     🖼️ Render Sidebar
  ========================================================== */
  return (
    <aside
      className={`flex flex-col h-screen bg-gradient-to-b from-blue-50 to-blue-100 border-r border-blue-200 shadow-sm transition-all duration-300 ${
        isExpanded ? "w-64" : "w-20"
      }`}
      aria-expanded={isExpanded}
    >
      {/* === Header === */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-blue-200">
        <div className="flex flex-col">
          <h1
            className={`font-bold text-blue-900 text-lg leading-tight transition-all duration-300 ${
              isExpanded ? "opacity-100" : "opacity-0 w-0"
            }`}
          >
            LawBridge
          </h1>
          {isExpanded && (
            <p className="text-xs text-blue-700 tracking-wide">
              {user?.role?.toUpperCase() || "USER"} PANEL
            </p>
          )}
        </div>
        <button
          onClick={() => setExpanded(!isExpanded)}
          className="p-2 text-blue-700 rounded-md hover:bg-blue-200 transition"
          aria-label="Toggle sidebar"
        >
          {isExpanded ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
        </button>
      </div>

      {/* === Navigation === */}
      <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-2">
        {navItems.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? "bg-blue-100 text-blue-700 shadow-sm"
                  : "text-blue-900 hover:bg-blue-50 hover:text-blue-700"
              }`
            }
          >
            {icon}
            <span
              className={`transition-all duration-300 ${
                isExpanded ? "opacity-100" : "opacity-0 w-0"
              }`}
            >
              {label}
            </span>
          </NavLink>
        ))}

        {/* === Notifications === */}
        <div
          onClick={() => navigate("/dashboard/notifications")}
          className="relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-blue-900 hover:bg-blue-50 transition-all cursor-pointer"
        >
          <Bell />
          {isExpanded && <span>Notifications</span>}
          {unread > 0 && (
            <span className="absolute right-4 top-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {unread}
            </span>
          )}
        </div>
      </nav>

      {/* === Footer === */}
      <div className="border-t border-blue-200 p-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-yellow-400 flex items-center justify-center font-bold text-black">
            {user?.name?.charAt(0)?.toUpperCase() || "?"}
          </div>
          {isExpanded && (
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-semibold text-blue-900 truncate">{user?.name}</p>
              <p className="text-xs text-blue-700 truncate">{user?.email}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="p-2 text-blue-600 hover:text-red-600 transition"
            aria-label="Logout"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
}
