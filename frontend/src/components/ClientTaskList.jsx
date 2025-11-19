/**
 * ClientTaskList.jsx
 * -------------------------------------------------------
 * Displays all tasks linked to a specific client.
 * Features:
 *  • Fetches tasks via /api/tasks?clientId=
 *  • Live sync via Socket.IO (task:new / task:update / task:deleted)
 *  • Status Badges, overdue highlighting
 *  • Assigned advocate & priority display
 *  • Responsive & accessible
 * -------------------------------------------------------
 */

import React, { useEffect, useState, useCallback } from "react";
import {
  CheckCircle,
  Clock,
  Loader2,
  AlertTriangle,
  ClipboardList,
} from "lucide-react";
import { toast } from "sonner";
import { socket } from "@/utils/socket";
import api from "@/utils/api"; // ✅ lowercase import (matches your utils/api.js)

export default function ClientTaskList({ clientId }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  /* =======================================================
     🧠 Fetch Tasks
  ======================================================= */
  const fetchClientTasks = useCallback(async () => {
    if (!clientId) return;

    try {
      setLoading(true);

      // ✅ Correct endpoint: /api/tasks?clientId=...
      const { data } = await api.get(`/tasks?clientId=${clientId}`);
      setTasks(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("❌ Error fetching client tasks:", err);
      toast.error("Failed to load client tasks");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  /* =======================================================
     🔁 Realtime Socket Events
  ======================================================= */
  useEffect(() => {
    fetchClientTasks();

    const handleTaskNew = (task) => {
      if (task?.client?._id === clientId || task?.client === clientId) {
        setTasks((prev) => [task, ...prev]);
        toast.success(`📋 New task assigned: ${task.title}`);
      }
    };

    const handleTaskUpdate = (task) => {
      if (task?.client?._id === clientId || task?.client === clientId) {
        setTasks((prev) =>
          prev.map((t) => (t._id === task._id ? task : t))
        );
        toast.info(`✏️ Task updated: ${task.title}`);
      }
    };

    const handleTaskDeleted = ({ _id }) => {
      setTasks((prev) => prev.filter((t) => t._id !== _id));
      toast.warning("🗑️ A task was removed");
    };

    socket.on("task:new", handleTaskNew);
    socket.on("task:update", handleTaskUpdate);
    socket.on("task:deleted", handleTaskDeleted);

    return () => {
      socket.off("task:new", handleTaskNew);
      socket.off("task:update", handleTaskUpdate);
      socket.off("task:deleted", handleTaskDeleted);
    };
  }, [clientId, fetchClientTasks]);

  /* =======================================================
     🏷️ Helpers
  ======================================================= */
  const getStatusBadge = (status) => {
    const base =
      "px-2 py-1 rounded-full text-xs font-medium capitalize inline-flex items-center gap-1";
    switch (status) {
      case "completed":
        return `${base} bg-green-100 text-green-700`;
      case "in-progress":
        return `${base} bg-blue-100 text-blue-700`;
      case "pending":
        return `${base} bg-yellow-100 text-yellow-700`;
      case "overdue":
        return `${base} bg-red-100 text-red-700`;
      default:
        return `${base} bg-gray-100 text-gray-600`;
    }
  };

  const formatDate = (date) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  /* =======================================================
     ⏳ Loading State
  ======================================================= */
  if (loading) {
    return (
      <div className="flex justify-center items-center py-10 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading client tasks...
      </div>
    );
  }

  /* =======================================================
     📭 Empty State
  ======================================================= */
  if (!tasks.length) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-gray-500">
        <ClipboardList className="w-8 h-8 mb-2 opacity-70" />
        <p>No tasks yet for this client.</p>
      </div>
    );
  }

  /* =======================================================
     ✅ Render List
  ======================================================= */
  return (
    <div className="space-y-3">
      {tasks.map((task) => {
        const isOverdue =
          task.status !== "completed" &&
          task.dueDate &&
          new Date(task.dueDate) < new Date();

        return (
          <div
            key={task._id}
            className="p-4 rounded-lg border border-gray-200 bg-white shadow-sm hover:shadow-md hover:border-blue-300 transition-all duration-200"
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-gray-900 text-sm sm:text-base">
                  {task.title}
                </h3>
                {task.description && (
                  <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                    {task.description}
                  </p>
                )}
              </div>
              <span className={getStatusBadge(task.status)}>
                {task.status}
                {task.status === "completed" && (
                  <CheckCircle className="w-3 h-3" />
                )}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap justify-between text-xs text-gray-500">
              <span>
                <Clock className="inline w-3 h-3 mr-1" />
                Due: {formatDate(task.dueDate)}
              </span>
              <span>Priority: {task.priority || "medium"}</span>
              <span>
                Assigned To:{" "}
                {Array.isArray(task.assignedTo)
                  ? task.assignedTo.map((u) => u.name || "User").join(", ")
                  : task.assignedTo?.name || "Unassigned"}
              </span>
            </div>

            {isOverdue && (
              <div className="mt-2 text-xs flex items-center text-red-600">
                <AlertTriangle className="w-4 h-4 mr-1" />
                Overdue
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
