/**
 * backend/routes/taskRoutes.js
 * -------------------------------------------------------------
 * TASK MANAGEMENT ROUTES — Case-linked & Standalone
 * -------------------------------------------------------------
 * Features:
 *  ✅ User-specific and multi-assignee tasks
 *  ✅ Shared visibility via `sharedWith`
 *  ✅ Full CRUD (create, update, complete, delete, restore)
 *  ✅ Overdue detection and analytics
 * -------------------------------------------------------------
 * Base URL: /api/tasks
 */

import express from "express";
import {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  completeTask,
  deleteTask,
  restoreTask,
  getOverdueTasks,
  getTaskAnalytics,
} from "../controllers/taskController.js";

import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

// 🔒 Role shortcuts
const manageRoles = ["admin", "advocate", "lawyer"];
const viewRoles = ["admin", "advocate", "lawyer", "arbitrator", "paralegal"];

/* =======================================================
   📊 ANALYTICS & MONITORING
   ======================================================= */

/**
 * @route   GET /api/tasks/analytics
 * @desc    Get task completion and workload analytics
 * @access  Private (Admin, Advocate, Lawyer, Arbitrator, Paralegal)
 */
router.get("/analytics", protect, authorize(...viewRoles), getTaskAnalytics);

/**
 * @route   GET /api/tasks/overdue
 * @desc    Get overdue (non-completed) tasks
 * @access  Private (Admin, Advocate, Lawyer)
 */
router.get("/overdue", protect, authorize(...manageRoles), getOverdueTasks);

/* =======================================================
   🧾 TASK CRUD ROUTES
   ======================================================= */

/**
 * @route   GET /api/tasks
 * @desc    Get all tasks (user or case scoped)
 * @query   ?status= / ?caseId= / ?priority= / ?q=
 * @access  Private (Advocate, Arbitrator, Admin)
 */
router.get("/", protect, authorize(...viewRoles), getTasks);

/**
 * @route   GET /api/tasks/:id
 * @desc    Get a specific task by ID
 * @access  Private (Assigned user, shared, creator, admin)
 */
router.get("/:id", protect, authorize(...viewRoles), getTaskById);

/**
 * @route   POST /api/tasks
 * @desc    Create a new task (case-linked or standalone)
 * @access  Private (Advocate, Lawyer, Admin)
 */
router.post("/", protect, authorize(...manageRoles), createTask);

/**
 * @route   PUT /api/tasks/:id
 * @desc    Update task fields (status, priority, etc.)
 * @access  Private (Creator, Assignee, Admin)
 */
router.put("/:id", protect, authorize(...manageRoles), updateTask);

/**
 * @route   PATCH /api/tasks/:id/complete
 * @desc    Mark a task as completed
 * @access  Private (Assignee, Admin)
 */
router.patch("/:id/complete", protect, authorize(...manageRoles), completeTask);

/**
 * @route   PATCH /api/tasks/:id/restore
 * @desc    Restore a previously deleted (soft) task
 * @access  Private (Admin, Creator)
 */
router.patch("/:id/restore", protect, authorize(...manageRoles), restoreTask);

/**
 * @route   DELETE /api/tasks/:id
 * @desc    Soft delete a task
 * @access  Private (Admin, Creator, Assignee)
 */
router.delete("/:id", protect, authorize(...manageRoles), deleteTask);

export default router;
