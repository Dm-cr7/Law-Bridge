// frontend/src/layouts/DashboardLayout.jsx
import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Menu } from "lucide-react";
import { Button } from "@/components/ui/Button";
import Sidebar from "@/components/Sidebar"; // ✅ use the new Sidebar
import { useAuth } from "@/context/AuthContext";

/**
 * ⚙️ DashboardLayout.jsx
 * ------------------------------------------------------------
 * ✅ Integrates with new Sidebar.jsx
 * ✅ Responsive + animated sidebar toggle
 * ✅ AuthContext user info and avatar
 * ✅ Topbar with notifications and user details
 * ✅ Clean separation of layout vs navigation logic
 * ------------------------------------------------------------
 */

export default function DashboardLayout() {
  const { user } = useAuth();
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  const role = user?.role?.toLowerCase() || "guest";

  return (
    <div className="flex h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-white text-slate-800 overflow-hidden">
      {/* === Sidebar (Desktop) === */}
      <div className="hidden lg:block">
        <Sidebar isExpanded={sidebarExpanded} setExpanded={setSidebarExpanded} />
      </div>

      {/* === Sidebar (Mobile) === */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Slide-in Sidebar */}
            <motion.div
              key="mobile-sidebar"
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-y-0 left-0 z-50 lg:hidden"
            >
              <Sidebar isExpanded={true} setExpanded={() => setMobileOpen(false)} />
            </motion.div>

            {/* Dimmed overlay */}
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            />
          </>
        )}
      </AnimatePresence>

      {/* === Main Content === */}
      <div className="flex-1 flex flex-col">
        {/* === Top Bar === */}
        <header className="flex items-center justify-between h-16 border-b border-blue-100 bg-white/70 backdrop-blur-xl px-4 shadow-sm">
          <div className="flex items-center gap-3">
            {/* Mobile Menu Toggle */}
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden text-blue-600 hover:text-blue-800"
            >
              <Menu size={22} />
            </Button>

            <h2 className="text-lg font-semibold text-blue-700">
              {role.charAt(0).toUpperCase() + role.slice(1)} Dashboard
            </h2>
          </div>

          {/* === Right-side icons === */}
          <div className="flex items-center gap-4">
            {/* Notifications Bell */}
            <Button
              size="icon"
              variant="ghost"
              className="text-blue-600 hover:text-blue-800"
            >
              <Bell size={20} />
            </Button>

            {/* User Info */}
            <div className="flex items-center gap-2">
              <img
                src={user?.avatar || "/assets/default-avatar.png"}
                alt="User Avatar"
                className="w-8 h-8 rounded-full border border-blue-300 object-cover"
              />
              <div className="text-sm leading-tight">
                <p className="font-medium text-blue-700">{user?.name || "User"}</p>
                <p className="text-slate-500 text-xs">{role}</p>
              </div>
            </div>
          </div>
        </header>

        {/* === Main Outlet (Routed Pages) === */}
        <main className="flex-1 overflow-y-auto bg-gradient-to-b from-white via-sky-50 to-blue-50 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
