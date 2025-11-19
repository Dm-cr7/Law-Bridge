/**
 * Tasks.jsx
 * -----------------------------------------------------------
 * Central Task Management Page
 * Integrates:
 *  - TaskList (per case or general)
 *  - TaskFormModal (create/edit)
 *  - ClientTaskList (tasks filtered by client)
 *  - ClientTaskBoard (kanban-style grouped tasks)
 *
 * Notes:
 *  - API base is pre-configured, no /api prefix.
 *  - Prevents redundant fetches (avoids 429 Too Many Requests).
 *  - Connects socket once safely.
 * -----------------------------------------------------------
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { ClipboardList, Users, LayoutGrid, PlusCircle } from "lucide-react";
import { toast } from "sonner";
import api from "@/utils/api";
import { socket, connectSocketWithToken } from "@/utils/socket";

// Components
import TaskList from "@/components/TaskList";
import TaskFormModal from "@/components/TaskFormModal";
import ClientTaskList from "@/components/ClientTaskList";
import ClientTaskBoard from "@/components/ClientTaskBoard";

export default function Tasks() {
  const [activeTab, setActiveTab] = useState("myTasks");
  const [modalOpen, setModalOpen] = useState(false);
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const hasFetched = useRef(false); // ✅ prevents repeated API calls

  /* ==========================================================
     🧠 Fetch Logged-in User + Clients
  ========================================================== */
  const fetchUserAndClients = useCallback(async () => {
    if (hasFetched.current) return; // ✅ avoid duplicate requests
    hasFetched.current = true;

    try {
      setLoading(true);
      const [userRes, clientRes] = await Promise.all([
        api.get("/auth/me"),
        api.get("/clients"),
      ]);

      const userData =
        userRes?.data?.user ?? userRes?.data ?? userRes?.data?.data ?? null;
      const clientData = clientRes?.data?.data ?? clientRes?.data ?? [];

      setUser(userData);
      setClients(clientData);
    } catch (err) {
      console.error("❌ Error fetching user/clients:", err);
      toast.error("Failed to load user or client data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUserAndClients();
  }, [fetchUserAndClients]);

  /* ==========================================================
     🔌 Initialize Socket.IO (connect once)
  ========================================================== */
  useEffect(() => {
    const token =
      localStorage.getItem("authToken") ||
      sessionStorage.getItem("authToken");
    if (!token) return;

    connectSocketWithToken(token);

    const onNew = (task) => toast.success(`🆕 New Task: ${task.title}`);
    const onUpdate = (task) => toast(`✏️ Task Updated: ${task.title}`);
    const onDeleted = (payload) =>
      toast.warning(
        `🗑️ Task Removed: ${payload?.title ?? "a deleted task"}`
      );

    socket.on("task:new", onNew);
    socket.on("task:update", onUpdate);
    socket.on("task:deleted", onDeleted);

    return () => {
      socket.off("task:new", onNew);
      socket.off("task:update", onUpdate);
      socket.off("task:deleted", onDeleted);
    };
  }, []); // ✅ only once, not tied to `user`

  /* ==========================================================
     🧭 Tabs Configuration
  ========================================================== */
  const tabs = [
    { id: "myTasks", label: "My Tasks", icon: <ClipboardList size={16} /> },
    { id: "clientTasks", label: "Client Tasks", icon: <Users size={16} /> },
    { id: "board", label: "Task Board", icon: <LayoutGrid size={16} /> },
  ];

  /* ==========================================================
     🖼️ Render
  ========================================================== */
  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Task Management
          </h1>
          <p className="text-gray-600 text-sm">
            Track, assign, and complete legal tasks efficiently.
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition"
        >
          <PlusCircle size={16} />
          New Task
        </button>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 mb-6 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-md transition-all ${
              activeTab === tab.id
                ? "bg-blue-100 text-blue-700 border-b-2 border-blue-600"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="bg-white rounded-xl p-4 shadow-sm border"
      >
        {/* MY TASKS */}
        {activeTab === "myTasks" && (
          <div>
            <TaskList />
          </div>
        )}

        {/* CLIENT TASKS */}
        {activeTab === "clientTasks" && (
          <div>
            <div className="mb-4 flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">
                Select Client:
              </label>
              <select
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Choose...</option>
                {clients.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedClient ? (
              <>
                <ClientTaskList clientId={selectedClient} />
                <div className="mt-6">
                  <ClientTaskBoard clientId={selectedClient} />
                </div>
              </>
            ) : (
              <p className="text-gray-500 text-sm italic mt-4">
                Select a client to view their tasks.
              </p>
            )}
          </div>
        )}

        {/* TASK BOARD */}
        {activeTab === "board" && (
          <div>
            {!user && !loading ? (
              <p className="text-gray-500">
                Cannot show board until user is loaded.
              </p>
            ) : (
              <ClientTaskBoard clientId={user?._id || ""} />
            )}
          </div>
        )}
      </motion.div>

      {/* Task Modal */}
      <TaskFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => {
          toast.success("✅ Task saved successfully");
        }}
      />
    </div>
  );
}
