// frontend/src/pages/Settings.jsx
import React, { useEffect, useState } from "react";
import { motion as Motion } from "framer-motion";
import { Bell, Lock, Moon, Sun, Save, Loader2, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import API from "../utils/api";

/**
 * Settings.jsx
 * ======================================================
 * - Manages account-level settings for all user roles.
 * - Allows password change, theme toggle, and notifications preferences.
 * - Persists settings to backend (/api/users/me/settings).
 * - Syncs theme to localStorage + <html> class for Tailwind dark mode.
 */

export default function Settings() {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [settings, setSettings] = useState({
    notifications: true,
    emailUpdates: true,
    theme: "light",
  });

  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  // === Fetch existing settings ===
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data } = await API.get("/users/me/settings");
        setSettings({
          notifications: data.notifications ?? true,
          emailUpdates: data.emailUpdates ?? true,
          theme: data.theme || "light",
        });
        applyTheme(data.theme || "light");
      } catch (err) {
        console.warn("No existing settings, using defaults");
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  // === Apply theme globally ===
  const applyTheme = (theme) => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  // === Toggle theme ===
  const toggleTheme = () => {
    const next = settings.theme === "dark" ? "light" : "dark";
    setSettings((s) => ({ ...s, theme: next }));
    applyTheme(next);
  };

  // === Save settings ===
  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      await API.put("/users/me/settings", settings);
      toast.success("Settings updated successfully!");
    } catch (err) {
      console.error("Save settings failed:", err);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  // === Change password ===
  const handleChangePassword = async () => {
    if (!passwords.currentPassword || !passwords.newPassword) {
      return toast.warning("Please fill out all password fields");
    }
    if (passwords.newPassword !== passwords.confirmPassword) {
      return toast.error("New passwords do not match");
    }

    try {
      setSaving(true);
      await API.put("/users/me/password", passwords);
      setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" });
      toast.success("Password updated successfully!");
    } catch (err) {
      console.error("Password change failed:", err);
      toast.error(err?.response?.data?.message || "Failed to change password");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[70vh] text-slate-600">
        <Loader2 className="animate-spin mr-2" /> Loading settings...
      </div>
    );
  }

  return (
    <div className="settings-page min-h-screen bg-black-50 dark:bg-black-900 text-slate-900 dark:text-slate-100 py-10 px-6">
      <div className="max-w-3xl mx-auto bg-white dark:bg-black-800 shadow-md rounded-xl p-8">
        <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-700 pb-4 mb-6">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
            <Settings2 size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Settings</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              Manage account preferences and appearance
            </p>
          </div>
        </div>

        {/* Notifications */}
        <Motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Bell size={18} /> Notifications
          </h2>
          <div className="space-y-3">
            <label className="flex items-center justify-between">
              <span>Email Updates</span>
              <input
                type="checkbox"
                checked={settings.emailUpdates}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    emailUpdates: e.target.checked,
                  }))
                }
                className="h-4 w-4 accent-blue-600"
              />
            </label>

            <label className="flex items-center justify-between">
              <span>In-app Notifications</span>
              <input
                type="checkbox"
                checked={settings.notifications}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    notifications: e.target.checked,
                  }))
                }
                className="h-4 w-4 accent-blue-600"
              />
            </label>
          </div>
        </Motion.div>

        {/* Theme */}
        <Motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Moon size={18} /> Appearance
          </h2>
          <div className="flex items-center justify-between bg-slate-50 dark:bg-black-700 rounded-lg p-3">
            <span>
              {settings.theme === "dark"
                ? "Dark mode is enabled"
                : "Light mode is enabled"}
            </span>
            <button
              onClick={toggleTheme}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              {settings.theme === "dark" ? (
                <>
                  <Sun size={16} /> Light Mode
                </>
              ) : (
                <>
                  <Moon size={16} /> Dark Mode
                </>
              )}
            </button>
          </div>
        </Motion.div>

        {/* Password change */}
        <Motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Lock size={18} /> Security
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <input
              type="password"
              placeholder="Current password"
              value={passwords.currentPassword}
              onChange={(e) =>
                setPasswords({ ...passwords, currentPassword: e.target.value })
              }
              className="border border-slate-300 dark:border-slate-600 rounded-md px-3 py-2 bg-white dark:bg-black-800"
            />
            <input
              type="password"
              placeholder="New password"
              value={passwords.newPassword}
              onChange={(e) =>
                setPasswords({ ...passwords, newPassword: e.target.value })
              }
              className="border border-slate-300 dark:border-slate-600 rounded-md px-3 py-2 bg-white dark:bg-black-800"
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={passwords.confirmPassword}
              onChange={(e) =>
                setPasswords({ ...passwords, confirmPassword: e.target.value })
              }
              className="border border-slate-300 dark:border-slate-600 rounded-md px-3 py-2 bg-white dark:bg-black-800"
            />
          </div>

          <div className="flex justify-between items-center mt-6">
            <button
              onClick={handleChangePassword}
              disabled={saving}
              className={`inline-flex items-center gap-2 px-5 py-2 rounded-md ${
                saving
                  ? "bg-slate-400 cursor-not-allowed"
                  : "bg-amber-600 hover:bg-amber-700"
              } text-white`}
            >
              {saving ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <Lock size={16} />
              )}
              Change Password
            </button>

            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className={`inline-flex items-center gap-2 px-5 py-2 rounded-md ${
                saving
                  ? "bg-slate-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              } text-white`}
            >
              {saving ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <Save size={16} />
              )}
              Save Preferences
            </button>
          </div>
        </Motion.div>
      </div>
    </div>
  );
}
