/**
 * backend/controllers/taskController.js
 * ------------------------------------------------------------
 * TASK CONTROLLER — Realtime, Analytics & Case Integration
 * ------------------------------------------------------------
 * ✅ Uses socketEmitter for safe, scoped realtime updates
 * ✅ Role-aware access control
 * ✅ Consistent JSON responses
 * ✅ Full CRUD, completion, restoration, overdue detection
 * ✅ Analytics endpoint for dashboards
 * ------------------------------------------------------------
 */

import Task from "../models/Task.js";
import Case from "../models/Case.js";
import { emitSocketEvent } from "../utils/socketEmitter.js";

/* ------------------------------------------------------------
   Helper — Collect relevant socket rooms (user IDs)
------------------------------------------------------------ */
const getTaskRooms = (task) => {
  const ids = new Set();
  [task.createdBy, ...(task.assignedTo || []), ...(task.sharedWith || [])]
    .filter(Boolean)
    .forEach((u) => ids.add(u.toString()));
  return Array.from(ids);
};

/* =======================================================
   📋 GET ALL TASKS
======================================================= */
export const getTasks = async (req, res) => {
  try {
    const { status, caseId, priority, q } = req.query;
    const { _id: userId, role } = req.user;

    const filters = { isDeleted: false };
    if (role !== "admin") {
      filters.$or = [
        { createdBy: userId },
        { assignedTo: userId },
        { sharedWith: userId },
      ];
    }
    if (status) filters.status = status;
    if (priority) filters.priority = priority;
    if (caseId) filters.case = caseId;
    if (q) filters.$text = { $search: q };

    const tasks = await Task.find(filters)
      .populate("case", "title status priority")
      .populate("assignedTo", "name email role")
      .populate("createdBy", "name email role")
      .populate("sharedWith", "name email role")
      .sort({ dueDate: 1 });

    res.json({ success: true, data: tasks });
  } catch (err) {
    console.error("❌ getTasks error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch tasks", error: err.message });
  }
};

/* =======================================================
   🔍 GET TASK BY ID
======================================================= */
export const getTaskById = async (req, res) => {
  try {
    const { id } = req.params;
    const { _id: userId, role } = req.user;

    const task = await Task.findById(id)
      .populate("case", "title status filedBy")
      .populate("assignedTo", "name email role")
      .populate("createdBy", "name email role")
      .populate("sharedWith", "name email role");

    if (!task || task.isDeleted)
      return res.status(404).json({ success: false, message: "Task not found" });

    const allowed =
      role === "admin" ||
      task.createdBy.equals(userId) ||
      task.assignedTo.some((u) => u.equals(userId)) ||
      task.sharedWith.some((u) => u.equals(userId));

    if (!allowed) return res.status(403).json({ success: false, message: "Access denied" });

    res.json({ success: true, data: task });
  } catch (err) {
    console.error("❌ getTaskById error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch task", error: err.message });
  }
};

/* =======================================================
   ➕ CREATE TASK
======================================================= */
export const createTask = async (req, res) => {
  try {
    const { title, description, caseId, assignedTo, sharedWith, dueDate, priority } = req.body;
    if (!title || !dueDate)
      return res.status(400).json({ success: false, message: "Title and due date are required" });

    if (caseId && !(await Case.exists({ _id: caseId }))) {
      return res.status(404).json({ success: false, message: "Linked case not found" });
    }

    const task = await Task.create({
      title: title.trim(),
      description: description?.trim() || "",
      case: caseId || null,
      assignedTo: Array.isArray(assignedTo) ? assignedTo : assignedTo ? [assignedTo] : [],
      sharedWith: Array.isArray(sharedWith) ? sharedWith : [],
      createdBy: req.user._id,
      dueDate,
      priority: priority || "medium",
      status: "pending",
    });

    task.addAudit("created", req.user._id, { title });
    await task.save();

    const populated = await Task.findById(task._id)
      .populate("case", "title status priority")
      .populate("assignedTo", "name email role")
      .populate("createdBy", "name email role")
      .populate("sharedWith", "name email role");

    emitSocketEvent("task:new", getTaskRooms(populated), populated);
    res.status(201).json({ success: true, message: "Task created successfully", data: populated });
  } catch (err) {
    console.error("❌ createTask error:", err);
    res.status(500).json({ success: false, message: "Failed to create task", error: err.message });
  }
};

/* =======================================================
   ✏️ UPDATE TASK
======================================================= */
export const updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { _id: userId, role } = req.user;

    const task = await Task.findById(id);
    if (!task || task.isDeleted)
      return res.status(404).json({ success: false, message: "Task not found" });

    const allowed =
      role === "admin" ||
      task.createdBy.equals(userId) ||
      task.assignedTo.some((u) => u.equals(userId));
    if (!allowed) return res.status(403).json({ success: false, message: "Access denied" });

    const updatable = [
      "title",
      "description",
      "status",
      "priority",
      "dueDate",
      "assignedTo",
      "sharedWith",
      "progress",
    ];

    for (const key of updatable) {
      if (key in req.body) task[key] = req.body[key];
    }

    task.updatedBy = userId;
    task.addAudit("updated", userId, { fields: Object.keys(req.body) });
    await task.save();

    const populated = await Task.findById(id)
      .populate("case", "title status priority")
      .populate("assignedTo", "name email role")
      .populate("createdBy", "name email role")
      .populate("sharedWith", "name email role");

    emitSocketEvent("task:updated", getTaskRooms(populated), populated);
    res.json({ success: true, message: "Task updated successfully", data: populated });
  } catch (err) {
    console.error("❌ updateTask error:", err);
    res.status(500).json({ success: false, message: "Failed to update task", error: err.message });
  }
};

/* =======================================================
   ✅ MARK COMPLETE
======================================================= */
export const completeTask = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const task = await Task.findById(id);
    if (!task || task.isDeleted)
      return res.status(404).json({ success: false, message: "Task not found" });

    if (task.status === "completed")
      return res.status(400).json({ success: false, message: "Task already completed" });

    await task.markCompleted(userId);

    emitSocketEvent("task:completed", getTaskRooms(task), { taskId: task._id, updatedBy: userId });
    res.json({ success: true, message: "Task marked as completed", data: task });
  } catch (err) {
    console.error("❌ completeTask error:", err);
    res.status(500).json({ success: false, message: "Failed to complete task", error: err.message });
  }
};

/* =======================================================
   🗑️ SOFT DELETE
======================================================= */
export const deleteTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { _id: userId, role } = req.user;

    const task = await Task.findById(id);
    if (!task || task.isDeleted)
      return res.status(404).json({ success: false, message: "Task not found" });

    const allowed =
      role === "admin" ||
      task.createdBy.equals(userId) ||
      task.assignedTo.some((u) => u.equals(userId));
    if (!allowed) return res.status(403).json({ success: false, message: "Access denied" });

    await task.softDelete(userId);

    emitSocketEvent("task:deleted", getTaskRooms(task), { taskId: task._id });
    res.json({ success: true, message: "Task deleted successfully" });
  } catch (err) {
    console.error("❌ deleteTask error:", err);
    res.status(500).json({ success: false, message: "Failed to delete task", error: err.message });
  }
};

/* =======================================================
   ♻️ RESTORE
======================================================= */
export const restoreTask = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const task = await Task.findById(id);
    if (!task)
      return res.status(404).json({ success: false, message: "Task not found" });

    await task.restore(userId);
    const populated = await Task.findById(id)
      .populate("case", "title status priority")
      .populate("assignedTo", "name email role")
      .populate("createdBy", "name email role")
      .populate("sharedWith", "name email role");

    emitSocketEvent("task:restored", getTaskRooms(populated), populated);
    res.json({ success: true, message: "Task restored successfully", data: populated });
  } catch (err) {
    console.error("❌ restoreTask error:", err);
    res.status(500).json({ success: false, message: "Failed to restore task", error: err.message });
  }
};

/* =======================================================
   ⏰ GET OVERDUE TASKS
======================================================= */
export const getOverdueTasks = async (req, res) => {
  try {
    const { _id: userId, role } = req.user;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const query =
      role === "admin"
        ? { isDeleted: false, dueDate: { $lt: today }, status: { $ne: "completed" } }
        : {
            isDeleted: false,
            dueDate: { $lt: today },
            status: { $ne: "completed" },
            $or: [{ createdBy: userId }, { assignedTo: userId }, { sharedWith: userId }],
          };

    const overdue = await Task.find(query)
      .populate("createdBy assignedTo case")
      .sort({ dueDate: 1 })
      .lean();

    emitSocketEvent("task:overdue", [userId.toString()], overdue);
    res.json({ success: true, count: overdue.length, data: overdue });
  } catch (err) {
    console.error("❌ getOverdueTasks error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch overdue tasks", error: err.message });
  }
};

/* =======================================================
   📊 ANALYTICS
======================================================= */
export const getTaskAnalytics = async (req, res) => {
  try {
    const { _id: userId, role } = req.user;
    const match = { isDeleted: false };
    if (role !== "admin") {
      match.$or = [{ createdBy: userId }, { assignedTo: userId }, { sharedWith: userId }];
    }

    const grouped = await Task.aggregate([
      { $match: match },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const total = await Task.countDocuments(match);
    const completed = await Task.countDocuments({ ...match, status: "completed" });
    const overdue = await Task.countDocuments({
      ...match,
      dueDate: { $lt: new Date() },
      status: { $nin: ["completed", "archived"] },
    });

    res.json({
      success: true,
      data: {
        total,
        completed,
        overdue,
        distribution: grouped,
        completionRate: total ? Math.round((completed / total) * 100) : 0,
      },
    });
  } catch (err) {
    console.error("❌ getTaskAnalytics error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch analytics", error: err.message });
  }
};
