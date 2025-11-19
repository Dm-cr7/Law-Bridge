/**
 * Analytics.jsx
 * ------------------------------------------------------------
 * Secure, user-specific analytics overview
 * ------------------------------------------------------------
 * ✅ Fetches only current user’s data
 * ✅ Case, task, and client summaries
 * ✅ Monthly case trends + case status distribution
 * ✅ Removed ADR section entirely
 */

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/utils/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Briefcase, Users, ClipboardCheck, AlertTriangle } from "lucide-react";

const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"];

const Card = ({ children, className = "" }) => (
  <div className={`bg-white shadow-md rounded-xl p-5 border ${className}`}>
    {children}
  </div>
);

const StatCard = ({ title, value, icon }) => (
  <Card className="flex items-center gap-4">
    <div className="flex items-center justify-center h-12 w-12 bg-blue-100 text-blue-600 rounded-lg">
      {icon}
    </div>
    <div>
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-2xl font-semibold text-gray-900">{value ?? "—"}</p>
    </div>
  </Card>
);

const StatSkeleton = () => (
  <div className="bg-gray-200 animate-pulse rounded-lg h-20" />
);
const ChartSkeleton = () => (
  <div className="bg-gray-200 animate-pulse rounded-lg h-72" />
);

export default function Analytics() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    totalCases: 0,
    totalClients: 0,
    openTasks: 0,
    overdueTasks: 0,
  });

  const [chartData, setChartData] = useState({
    monthlyCaseData: [],
    caseStatusData: [],
  });

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        setError(null);

        const [summaryRes, casesRes] = await Promise.all([
          api.get("/reports/summary?scope=self"),
          api.get("/reports/cases/summary?scope=self"),
        ]);

        const summary = summaryRes.data?.summary || {};
        const caseData = casesRes.data?.data || {};

        setStats({
          totalCases: caseData.total || 0,
          totalClients: summary.totalClients || 0,
          openTasks: summary.openTasks || 0,
          overdueTasks: summary.overdueTasks || 0,
        });

        setChartData({
          monthlyCaseData: caseData.byMonth || [],
          caseStatusData:
            caseData.byStatus?.map((s) => ({
              name: s.status,
              value: s.count,
            })) || [],
        });
      } catch (err) {
        console.error("❌ Analytics fetch error:", err);
        const status = err.response?.status;
        if (status === 401) {
          localStorage.removeItem("token");
          navigate("/login");
          return;
        }
        if (status === 403) {
          setError("🚫 Access denied: insufficient permissions.");
          return;
        }
        setError(err.response?.data?.message || "Failed to load analytics data.");
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [navigate]);

  if (error) {
    return (
      <div className="p-8 text-center text-red-600 font-medium">
        ⚠️ {error}
      </div>
    );
  }

  return (
    <div className="p-8 bg-gray-50 min-h-screen text-gray-900">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-2xl font-bold">Analytics Overview</h1>
        <p className="text-gray-500">
          User-specific performance summary and case insights.
        </p>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {loading ? (
          <>
            <StatSkeleton /> <StatSkeleton /> <StatSkeleton /> <StatSkeleton />
          </>
        ) : (
          <>
            <StatCard
              title="Total Cases"
              value={stats.totalCases}
              icon={<Briefcase size={24} />}
            />
            <StatCard
              title="Total Clients"
              value={stats.totalClients}
              icon={<Users size={24} />}
            />
            <StatCard
              title="Open Tasks"
              value={stats.openTasks}
              icon={<ClipboardCheck size={24} />}
            />
            <StatCard
              title="Overdue Tasks"
              value={stats.overdueTasks}
              icon={<AlertTriangle size={24} />}
            />
          </>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trend */}
        <Card>
          <h2 className="text-lg font-semibold mb-3">New vs Closed Cases (Monthly)</h2>
          {loading ? (
            <ChartSkeleton />
          ) : chartData.monthlyCaseData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData.monthlyCaseData}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="newCases" fill="#3B82F6" name="New Cases" />
                <Bar dataKey="closedCases" fill="#10B981" name="Closed Cases" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-gray-500 text-sm text-center py-10">
              No monthly case data available.
            </div>
          )}
        </Card>

        {/* Status Pie */}
        <Card>
          <h2 className="text-lg font-semibold mb-3">Case Status Distribution</h2>
          {loading ? (
            <ChartSkeleton />
          ) : chartData.caseStatusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={chartData.caseStatusData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                >
                  {chartData.caseStatusData.map((entry, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-gray-500 text-sm text-center py-10">
              No case status data available.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
