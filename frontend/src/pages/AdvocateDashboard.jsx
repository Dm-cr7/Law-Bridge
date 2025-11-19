/**
 * AdvocateDashboard.jsx — Advocate Command Center
 * ------------------------------------------------------------
 * 🎯 Minimal, fast, static + interactive dashboard for advocates
 * ✅ Clean action hub (no charts / no syncing banners)
 * ✅ Responsive and animated
 * ✅ Links to all key advocate actions
 */

import React from "react";
import { motion } from "framer-motion";
import {
  PlusCircle,
  FileText,
  Users,
  Briefcase,
  CheckCircle,
  CalendarDays,
  ArrowRightCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import NewCaseModal from "@/components/NewCaseModal";
import TaskFormModal from "@/components/TaskFormModal";

const ACTIONS = [
  {
    label: "Register Client",
    icon: <Users size={28} />,
    color: "bg-amber-500 hover:bg-amber-600",
    path: "/dashboard/clients",
  },
  {
    label: "Draft Document",
    icon: <FileText size={28} />,
    color: "bg-purple-500 hover:bg-purple-600",
    path: "/dashboard/documents/new",
  },
  {
    label: "New Case",
    icon: <Briefcase size={28} />,
    color: "bg-blue-500 hover:bg-blue-600",
    modal: "case",
  },
  {
    label: "New Task",
    icon: <CheckCircle size={28} />,
    color: "bg-emerald-500 hover:bg-emerald-600",
    modal: "task",
  },
  {
    label: "View Calendar",
    icon: <CalendarDays size={28} />,
    color: "bg-indigo-500 hover:bg-indigo-600",
    path: "/dashboard/hearings",
  },
  {
    label: "Generate Report",
    icon: <ArrowRightCircle size={28} />,
    color: "bg-gray-700 hover:bg-gray-800",
    path: "/dashboard/reports",
  },
];

export default function AdvocateDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isCaseModalOpen, setCaseModalOpen] = React.useState(false);
  const [isTaskModalOpen, setTaskModalOpen] = React.useState(false);

  const handleAction = (action) => {
    if (action.path) navigate(action.path);
    else if (action.modal === "case") setCaseModalOpen(true);
    else if (action.modal === "task") setTaskModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-white px-6 py-12 text-gray-800">
      <motion.div
        initial={{ opacity: 0, y: 25 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-6xl mx-auto text-center"
      >
        {/* Header */}
        <h1 className="text-3xl sm:text-4xl font-semibold mb-2 text-gray-800">
          Welcome, {user?.name || "Advocate"}
        </h1>
        <p className="text-gray-500 mb-12">
          Manage your practice efficiently — all your key tools, one place.
        </p>

        {/* Action Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {ACTIONS.map((action, i) => (
            <motion.button
              key={i}
              onClick={() => handleAction(action)}
              whileHover={{ scale: 1.05, y: -3 }}
              whileTap={{ scale: 0.97 }}
              className={`${action.color} text-white flex flex-col items-center justify-center py-10 rounded-2xl shadow-md transition transform focus:outline-none`}
            >
              <div className="mb-3">{action.icon}</div>
              <span className="text-lg font-medium">{action.label}</span>
            </motion.button>
          ))}
        </div>

        {/* Quote / Footer Message */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-16 text-center"
        >
          <p className="text-gray-600 italic">
            “Justice delayed is justice denied — manage smarter, act faster.”
          </p>
        </motion.div>
      </motion.div>

      {/* Modals */}
      <NewCaseModal
        isOpen={isCaseModalOpen}
        onClose={() => setCaseModalOpen(false)}
      />
      <TaskFormModal
        isOpen={isTaskModalOpen}
        onClose={() => setTaskModalOpen(false)}
      />
    </div>
  );
}
