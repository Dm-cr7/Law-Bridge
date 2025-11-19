// frontend/src/pages/dashboard/RoleBasedDashboard.jsx
import React from "react";
import { useAuth } from "@/context/AuthContext";
import ParalegalDashboard from "../ParalegalDashboard.jsx";
import AdvocateDashboard from "../AdvocateDashboard.jsx";
import MediatorDashboard from "../MediatorDashboard.jsx";
import ReconciliatorDashboard from "../ReconciliatorDashboard.jsx";
import ArbitratorDashboard from "../ArbitratorDashboard.jsx";

/**
 * RoleBasedDashboard
 * Renders the correct dashboard view for the logged-in user's role,
 * but keeps the URL at /dashboard (no navigate/redirect).
 */
export default function RoleBasedDashboard() {
  const { user } = useAuth();

  if (!user) return <div className="p-6">Loading dashboard...</div>;

  const role = (user.role || "").toLowerCase();

  switch (role) {
    case "paralegal":
      return <ParalegalDashboard />;
    case "advocate":
      return <AdvocateDashboard />;
    case "mediator":
      return <MediatorDashboard />;
    case "reconciliator":
      return <ReconciliatorDashboard />;
    case "arbitrator":
      return <ArbitratorDashboard />;
    default:
      // fallback to paralegal to be conservative
      return <ParalegalDashboard />;
  }
}
