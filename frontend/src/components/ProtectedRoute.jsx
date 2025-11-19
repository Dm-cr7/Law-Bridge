/**
 * ProtectedRoute.jsx
 * Integrated with AuthContext
 * - Uses isAuthenticated + user from context
 * - Waits for loading before redirect
 * - Supports role-based access
 */

import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ProtectedRoute = ({ allowedRoles = [] }) => {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  // Still checking authentication
  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-black-50 text-black-600">
        <div className="animate-pulse text-lg font-semibold">
          Checking authentication...
        </div>
      </div>
    );
  }

  // Not logged in — redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Role-based restriction
  if (allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
    return (
      <div className="flex flex-col justify-center items-center h-screen text-center">
        <h2 className="text-2xl font-semibold text-red-600 mb-4">
          Access Denied
        </h2>
        <p className="text-black-600 mb-6">
          You don’t have permission to access this section.
        </p>
        <a
          href="/"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
        >
          Go Back Home
        </a>
      </div>
    );
  }

  // Authenticated + authorized
  return <Outlet />;
};

export default ProtectedRoute;
