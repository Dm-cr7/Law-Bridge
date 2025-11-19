// frontend/src/components/TaskList.jsx
import React, { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Edit3,
  Trash2,
  Loader2,
  PlusCircle,
  Clock,
  AlertCircle,
  Users,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/utils/api";
import { socket, connectSocketWithToken } from "@/utils/socket";
import TaskFormModal from "./TaskFormModal";

/**
 * TaskList.jsx
 * ------------------------------------------------------------
 * Realtime collaborative task list.
 * Syncs with centralized socket and REST API.
 * ------------------------------------------------------------
 */

export default function TaskList({ caseId }) {
  const [tasks, setTasks] = useState([]); // ✅ ensure array
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  /* =======================================================
     ⚡ Socket.IO Realtime Sync
  ======================================================= */
  useEffect(() => {
    const token = localStorage.getItem("authToken") || sessionStorage.getItem("authToken");
    if (token) connectSocketWithToken(token);

    const handleNewTask = (task) => {
      if (!caseId || task.case === caseId) {
        setTasks((prev) => [task, ...(Array.isArray(prev) ? prev : [])]);
        toast.success(`🆕 New task: ${task.title}`);
      }
    };

    const handleUpdate = (updated) => {
      if (!caseId || updated.case === caseId) {
        setTasks((prev) =>
          Array.isArray(prev)
            ? prev.map((t) => (t._id === updated._id ? updated : t))
            : [updated]
        );
        toast.info(`✏️ Task updated: ${updated.title}`);
      }
    };

    const handleComplete = (updated) => {
      if (!caseId || updated.case === caseId) {
        setTasks((prev) =>
          Array.isArray(prev)
            ? prev.map((t) =>
                t._id === updated._id ? { ...t, status: "completed" } : t
              )
            : []
        );
        toast.success(`✅ Task completed: ${updated.title}`);
      }
    };

    const handleDelete = ({ _id }) => {
      setTasks((prev) =>
        Array.isArray(prev) ? prev.filter((t) => t._id !== _id) : []
      );
      toast.warning("🗑️ Task removed");
    };

    socket.on("task:new", handleNewTask);
    socket.on("task:updated", handleUpdate);
    socket.on("task:completed", handleComplete);
    socket.on("task:deleted", handleDelete);

    return () => {
      socket.off("task:new", handleNewTask);
      socket.off("task:updated", handleUpdate);
      socket.off("task:completed", handleComplete);
      socket.off("task:deleted", handleDelete);
    };
  }, [caseId]);

  /* =======================================================
     📦 Fetch Tasks
  ======================================================= */
  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(caseId ? `/tasks?caseId=${caseId}` : "/tasks");

      // ✅ Handle any API response shape safely
      const data =
        Array.isArray(res.data)
          ? res.data
          : Array.isArray(res.data?.data)
          ? res.data.data
          : [];

      setTasks(data);
    } catch (err) {
      console.error("❌ Error fetching tasks:", err);
      toast.error("Failed to load tasks");
      setTasks([]); // fallback
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  /* =======================================================
     🗑️ Delete Task
  ======================================================= */
  const handleDelete = async (taskId) => {
    if (!confirm("Are you sure you want to delete this task?")) return;
    try {
      await api.delete(`/tasks/${taskId}`);
      toast.success("Task deleted");
      setTasks((prev) => prev.filter((t) => t._id !== taskId));
    } catch (err) {
      console.error("❌ Error deleting task:", err);
      toast.error("Failed to delete task");
    }
  };

  /* =======================================================
     ✅ Mark Complete
  ======================================================= */
  const toggleCompletion = async (task) => {
    if (task.status === "completed") {
      toast("Task already completed");
      return;
    }
    try {
      await api.patch(`/tasks/${task._id}/complete`);
      toast.success("Task marked completed");
    } catch (err) {
      console.error("❌ Failed to complete task:", err);
      toast.error("Failed to update status");
    }
  };

  /* =======================================================
     ✏️ Modal Controls
  ======================================================= */
  const openEdit = (task) => {
    setSelectedTask(task);
    setModalOpen(true);
  };

  const openNew = () => {
    setSelectedTask(null);
    setModalOpen(true);
  };

  /* =======================================================
     🖼️ Render
  ======================================================= */
  return (
    <div className="bg-white rounded-xl shadow-sm border p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-semibold text-lg text-gray-800">
          {caseId ? "Case Tasks" : "My Tasks"}
        </h2>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition"
        >
          <PlusCircle size={16} /> New Task
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6 text-gray-500">
          <Loader2 size={20} className="animate-spin mr-2" />
          Loading tasks...
        </div>
      ) : !Array.isArray(tasks) || tasks.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-6">
          No tasks added yet.
        </p>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {tasks.map((task) => {
              const isOverdue =
                task.status !== "completed" &&
                task.dueDate &&
                new Date(task.dueDate) < new Date();

              return (
                <motion.div
                  key={task._id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={`border rounded-lg p-4 flex justify-between items-start transition-all ${
                    task.status === "completed"
                      ? "bg-green-50 border-green-300"
                      : isOverdue
                      ? "bg-red-50 border-red-300"
                      : "bg-gray-50"
                  }`}
                >
                  <div className="flex-1 pr-4">
                    <h3
                      className={`font-medium ${
                        task.status === "completed"
                          ? "line-through text-gray-500"
                          : "text-gray-800"
                      }`}
                    >
                      {task.title}
                    </h3>

                    {task.description && (
                      <p className="text-sm text-gray-600 mt-1">
                        {task.description}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
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
                        {task.priority?.toUpperCase()}
                      </span>

                      {task.dueDate && (
                        <span className="flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded-full text-blue-700">
                          <Clock size={12} />{" "}
                          {new Date(task.dueDate).toLocaleDateString()}
                        </span>
                      )}

                      {isOverdue && (
                        <span className="flex items-center gap-1 bg-red-100 px-2 py-0.5 rounded-full text-red-700">
                          <AlertCircle size={12} /> Overdue
                        </span>
                      )}
                    </div>

                    {Array.isArray(task.assignedTo) && task.assignedTo.length > 0 && (
                      <p className="text-xs text-gray-600 mt-2 flex items-center gap-1">
                        <Users size={12} />
                        {task.assignedTo
                          .map((u) => (u.name ? u.name : "User"))
                          .join(", ")}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    {task.status !== "completed" && (
                      <button
                        onClick={() => toggleCompletion(task)}
                        className="text-sm flex items-center gap-1 text-green-700 hover:text-green-800"
                      >
                        <CheckCircle2 size={16} />
                        Mark Done
                      </button>
                    )}

                    <div className="flex gap-2 mt-1">
                      <button
                        onClick={() => openEdit(task)}
                        className="text-blue-600 hover:text-blue-800"
                        title="Edit task"
                      >
                        <Edit3 size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(task._id)}
                        className="text-red-600 hover:text-red-800"
                        title="Delete task"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* 🧩 Task Modal */}
      <TaskFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        existingTask={selectedTask}
        caseId={caseId}
        onSuccess={fetchTasks}
      />
    </div>
  );
}
