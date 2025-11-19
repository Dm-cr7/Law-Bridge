/**
 * ClientTaskBoard.jsx
 * -----------------------------------------------------
 * Displays all client-related tasks grouped by status.
 * Features:
 *  - Fetches via /api/tasks?clientId=
 *  - Realtime updates via Socket.IO
 *  - Grouped columns (Pending, In Progress, Completed, Overdue)
 *  - Shows due date, priority, and assigned advocate
 * -----------------------------------------------------
 */

import React, { useEffect, useState, useCallback } from "react";
import {
  CheckCircle2,
  Clock,
  Loader2,
  AlertCircle,
  AlertTriangle,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { socket } from "@/utils/socket";
import api from "@/utils/api"; // ✅ consistent lowercase import

export default function ClientTaskBoard({ clientId }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  /* =======================================================
     🧠 Fetch Tasks
  ======================================================= */
  const fetchTasks = useCallback(async () => {
    if (!clientId) return;

    try {
      setLoading(true);
      // ✅ Fixed: use /tasks?clientId=
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
     ⚡ Realtime Socket Sync
  ======================================================= */
  useEffect(() => {
    fetchTasks();

    const handleNew = (task) => {
      if (task?.client === clientId || task?.client?._id === clientId) {
        setTasks((prev) => [task, ...prev]);
        toast.success(`📋 New task assigned: ${task.title}`);
      }
    };

    const handleUpdate = (task) => {
      if (task?.client === clientId || task?.client?._id === clientId) {
        setTasks((prev) => prev.map((t) => (t._id === task._id ? task : t)));
        toast.info(`✏️ Task updated: ${task.title}`);
      }
    };

    const handleDelete = ({ _id }) => {
      setTasks((prev) => prev.filter((t) => t._id !== _id));
      toast.warning("🗑️ A task was removed");
    };

    socket.on("task:new", handleNew);
    socket.on("task:update", handleUpdate);
    socket.on("task:deleted", handleDelete);

    return () => {
      socket.off("task:new", handleNew);
      socket.off("task:update", handleUpdate);
      socket.off("task:deleted", handleDelete);
    };
  }, [clientId, fetchTasks]);

  /* =======================================================
     📊 Grouping
  ======================================================= */
  const grouped = {
    pending: tasks.filter((t) => t.status === "pending"),
    "in-progress": tasks.filter((t) => t.status === "in-progress"),
    completed: tasks.filter((t) => t.status === "completed"),
    overdue: tasks.filter(
      (t) =>
        t.status !== "completed" &&
        t.dueDate &&
        new Date(t.dueDate) < new Date()
    ),
  };

  const columns = [
    { id: "pending", title: "🕒 Pending", color: "border-amber-300" },
    { id: "in-progress", title: "⚙️ In Progress", color: "border-blue-300" },
    { id: "overdue", title: "⏰ Overdue", color: "border-red-300" },
    { id: "completed", title: "✅ Completed", color: "border-green-300" },
  ];

  /* =======================================================
     🪶 Task Card
  ======================================================= */
  const TaskCard = ({ task }) => {
    const dueDate = task.dueDate
      ? new Date(task.dueDate).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "—";

    const isOverdue =
      task.status !== "completed" &&
      task.dueDate &&
      new Date(task.dueDate) < new Date();

    return (
      <div className="bg-white p-3 rounded-lg shadow-sm border hover:shadow-md hover:border-blue-300 transition">
        <h4 className="font-semibold text-gray-900 mb-1">{task.title}</h4>
        {task.description && (
          <p className="text-xs text-gray-600 line-clamp-2">
            {task.description}
          </p>
        )}

        <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
          <span>
            <Clock className="inline w-3 h-3 mr-1" />
            {dueDate}
          </span>
          {task.status === "completed" ? (
            <CheckCircle2 className="w-4 h-4 text-green-600" />
          ) : isOverdue ? (
            <AlertTriangle className="w-4 h-4 text-red-500" />
          ) : (
            <Clock className="w-4 h-4 text-gray-400" />
          )}
        </div>

        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {task.priority && (
            <span
              className={`px-2 py-0.5 rounded-full font-medium ${
                task.priority === "urgent"
                  ? "bg-red-100 text-red-700"
                  : task.priority === "high"
                  ? "bg-orange-100 text-orange-700"
                  : task.priority === "medium"
                  ? "bg-yellow-100 text-yellow-700"
                  : "bg-green-100 text-green-700"
              }`}
            >
              {task.priority.toUpperCase()} Priority
            </span>
          )}
          {Array.isArray(task.assignedTo) && task.assignedTo.length > 0 && (
            <span className="flex items-center gap-1 text-gray-600">
              <User size={12} />{" "}
              {task.assignedTo.map((u) => u.name || "User").join(", ")}
            </span>
          )}
        </div>
      </div>
    );
  };

  /* =======================================================
     🕓 Loading State
  ======================================================= */
  if (loading) {
    return (
      <div className="flex justify-center items-center py-10 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading tasks...
      </div>
    );
  }

  /* =======================================================
     📭 Empty State
  ======================================================= */
  if (!tasks.length) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-gray-500">
        <AlertCircle className="w-8 h-8 mb-2 opacity-70" />
        <p>No tasks available for this client yet.</p>
      </div>
    );
  }

  /* =======================================================
     ✅ Render Columns
  ======================================================= */
  return (
    <div className="grid md:grid-cols-4 gap-4">
      {columns.map((col) => (
        <div
          key={col.id}
          className={`p-4 border rounded-lg bg-gray-50 ${col.color}`}
        >
          <h3 className="font-semibold text-gray-800 mb-3">{col.title}</h3>
          <div className="space-y-3">
            {grouped[col.id].length ? (
              grouped[col.id].map((task) => (
                <TaskCard key={task._id} task={task} />
              ))
            ) : (
              <p className="text-sm text-gray-400 italic">No tasks</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
