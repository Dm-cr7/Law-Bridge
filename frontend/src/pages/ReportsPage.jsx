/**
 * ReportsPage.jsx
 * ------------------------------------------------------------
 * Real-time, user-scoped reports dashboard
 * ------------------------------------------------------------
 * ✅ Live WebSocket updates (/reports namespace)
 * ✅ PDF export buttons per report
 * ✅ Syncs with backend controllers & socketEmitter
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import io from "socket.io-client";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import api from "@/utils/api";

const PIE_COLORS = ["#4F46E5", "#06B6D4", "#10B981", "#F59E0B", "#EF4444"];

function KPI({ title, value, change }) {
  return (
    <div className="bg-white shadow-md rounded-2xl p-5 flex flex-col gap-2 border border-gray-200">
      <div className="text-sm text-gray-600">{title}</div>
      <div className="text-2xl font-semibold text-gray-900">{value ?? "—"}</div>
      {typeof change === "number" && (
        <div className={`text-sm ${change >= 0 ? "text-green-600" : "text-red-600"}`}>
          {change >= 0 ? "▲" : "▼"} {Math.abs(change)}%
        </div>
      )}
    </div>
  );
}

const SkeletonCard = () => <div className="bg-gray-200 rounded-xl animate-pulse h-24" />;
const SkeletonChart = () => <div className="bg-gray-200 rounded-xl animate-pulse h-72" />;

export default function ReportsPage() {
  const [casesSummary, setCasesSummary] = useState(null);
  const [staffProductivity, setStaffProductivity] = useState([]);
  const [adrSuccess, setAdrSuccess] = useState(null);
  const [recentActivities, setRecentActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [socketConnected, setSocketConnected] = useState(false);
  const [error, setError] = useState(null);

  const socketRef = useRef(null);
  const navigate = useNavigate();

  // --- Fetch Data ---
  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      try {
        const [casesRes, staffRes, adrRes] = await Promise.all([
          api.get("/reports/cases/summary?scope=self"),
          api.get("/reports/staff/productivity?scope=self"),
          api.get("/reports/adr/success?scope=self"),
        ]);
        setCasesSummary(casesRes.data?.data);
        setStaffProductivity(staffRes.data?.data);
        setAdrSuccess(adrRes.data?.data);
      } catch (err) {
        console.error("❌ Reports fetch error:", err);
        const status = err.response?.status;
        if (status === 401) {
          localStorage.removeItem("token");
          navigate("/login");
        } else if (status === 403) setError("🚫 Access denied.");
        else setError("Failed to load reports.");
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, [navigate]);

  // --- Sockets ---
  useEffect(() => {
    const base = api?.defaults?.baseURL || import.meta.env.VITE_API_URL || "http://localhost:5000";
    const token = localStorage.getItem("token");
    if (!token) return;
    const socket = io(`${base}/reports`, {
      transports: ["websocket"],
      auth: { token },
    });
    socketRef.current = socket;
    socket.on("connect", () => setSocketConnected(true));
    socket.on("disconnect", () => setSocketConnected(false));
    socket.on("reports:update", (payload) => {
      if (payload?.cases) setCasesSummary(payload.cases);
      if (payload?.staff) setStaffProductivity(payload.staff);
      if (payload?.adr) setAdrSuccess(payload.adr);
    });
    return () => socket.disconnect();
  }, []);

  // --- Chart Data ---
  const caseStatusData = useMemo(
    () => (casesSummary?.byStatus || []).map((s) => ({ name: s.status, value: s.count })),
    [casesSummary]
  );
  const productivityData = useMemo(
    () =>
      (staffProductivity || []).map((u) => ({
        name: u.name || "Unassigned",
        completed: u.closedCount || 0,
        total: u.totalAssigned || 0,
      })),
    [staffProductivity]
  );
  const adrPieData = useMemo(
    () =>
      (adrSuccess?.breakdown || []).map((s) => ({
        name: s._id,
        value: s.count,
      })),
    [adrSuccess]
  );

  const handleExport = async (type) => {
    try {
      const res = await api.get(`/reports/export?type=${type}&format=pdf`, {
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${type}-report.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Export failed:", err);
      alert("Failed to export PDF report.");
    }
  };

  if (error)
    return <div className="p-8 text-center text-red-600 font-semibold">⚠️ {error}</div>;

  return (
    <div className="p-6 bg-gray-50 min-h-screen text-gray-900">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Reports & Analytics</h1>
          <p className="text-sm text-gray-600">Real-time insights unique to your account</p>
        </div>
        <div className="text-sm text-right">
          {socketConnected ? "🟢 Live" : "🔴 Offline"} <br />
          {loading ? "Loading…" : "Up to date"}
        </div>
      </header>

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {loading ? (
          <>
            <SkeletonCard /> <SkeletonCard /> <SkeletonCard /> <SkeletonCard />
          </>
        ) : (
          <>
            <KPI title="Total Cases" value={casesSummary?.total} />
            <KPI title="Avg Resolution Days" value={casesSummary?.avgResolutionDays} />
            <KPI title="Active Staff" value={staffProductivity?.length} />
            <KPI title="ADR Success Rate" value={`${adrSuccess?.successRate ?? 0}%`} />
          </>
        )}
      </div>

      {/* CASE STATUS */}
      <div className="bg-white shadow-md rounded-2xl p-5 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Cases by Status</h2>
          <button
            onClick={() => handleExport("cases")}
            className="text-sm text-blue-600 hover:underline"
          >
            ⬇ Export PDF
          </button>
        </div>
        {loading ? (
          <SkeletonChart />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={caseStatusData} dataKey="value" outerRadius={100} label>
                {caseStatusData.map((e, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* STAFF PRODUCTIVITY */}
      <div className="bg-white shadow-md rounded-2xl p-5 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Staff Productivity</h2>
          <button
            onClick={() => handleExport("staff")}
            className="text-sm text-blue-600 hover:underline"
          >
            ⬇ Export PDF
          </button>
        </div>
        {loading ? (
          <SkeletonChart />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={productivityData}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line dataKey="completed" stroke="#10B981" />
              <Line dataKey="total" stroke="#4F46E5" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ADR SUCCESS */}
      <div className="bg-white shadow-md rounded-2xl p-5 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">ADR Success Breakdown</h2>
          <button
            onClick={() => handleExport("adr")}
            className="text-sm text-blue-600 hover:underline"
          >
            ⬇ Export PDF
          </button>
        </div>
        {loading ? (
          <SkeletonChart />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={adrPieData} dataKey="value" outerRadius={120} label>
                {adrPieData.map((entry, idx) => (
                  <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
