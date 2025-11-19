/**
 * AdminAnalytics.jsx
 * ------------------------------------------------------------
 * 🎯 Purpose:
 * Central analytics dashboard for system administrators.
 * Visualizes platform performance: active cases, user growth,
 * case outcomes, and evidence stats, using real-time API data.
 *
 * ✅ Features:
 *  - KPI metric cards (totals, trends)
 *  - Charts (bar, pie, line)
 *  - Export data (CSV / PDF)
 *  - Real-time refresh option
 *  - Responsive and secure (admin-only)
 */

import React, { useEffect, useState } from "react";
import axios from "@/utils/axiosInstance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Download, RefreshCcw, BarChart2, Users, FileText, Scale } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";import { LineChart, Line, PieChart, Pie, Cell, Tooltip, ResponsiveContainer, XAxis, YAxis, Bar, BarChart, Legend } from "recharts";

export default function AdminAnalytics() {
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState(null);
  const [caseTrends, setCaseTrends] = useState([]);
  const [userStats, setUserStats] = useState([]);
  const [outcomes, setOutcomes] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#6b7280"];

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get("/api/reports/analytics");
      setMetrics(data.metrics);
      setCaseTrends(data.caseTrends);
      setUserStats(data.userStats);
      setOutcomes(data.outcomes);
    } catch (err) {
      console.error(err);
      toast({
        title: "Failed to load analytics",
        description: err.response?.data?.message || "Server unavailable",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAnalytics();
    setTimeout(() => setRefreshing(false), 800);
  };

  const handleExport = async (type) => {
    try {
      const res = await axios.get(`/api/reports/export/${type}`, { responseType: "blob" });
      const blob = new Blob([res.data]);
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `analytics_report.${type}`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      toast({ title: "Export failed", variant: "destructive" });
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-black-800 flex items-center gap-2">
          <BarChart2 className="w-6 h-6 text-blue-600" />
          System Analytics Dashboard
        </h1>
        <div className="flex gap-2">
          <Button onClick={handleRefresh} disabled={refreshing}>
            <RefreshCcw className={`w-4 h-4 mr-1 ${refreshing && "animate-spin"}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={() => handleExport("csv")}>
            <Download className="w-4 h-4 mr-1" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={() => handleExport("pdf")}>
            <Download className="w-4 h-4 mr-1" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* KPI Metrics */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="shadow">
            <CardHeader className="flex justify-between items-center">
              <CardTitle className="text-black-600 text-sm">Total Users</CardTitle>
              <Users className="text-blue-600 w-5 h-5" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{metrics.totalUsers}</p>
              <p className="text-sm text-black-500">+{metrics.newUsers} this month</p>
            </CardContent>
          </Card>

          <Card className="shadow">
            <CardHeader className="flex justify-between items-center">
              <CardTitle className="text-black-600 text-sm">Active Cases</CardTitle>
              <Scale className="text-green-600 w-5 h-5" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{metrics.activeCases}</p>
              <p className="text-sm text-black-500">{metrics.closedCases} closed</p>
            </CardContent>
          </Card>

          <Card className="shadow">
            <CardHeader className="flex justify-between items-center">
              <CardTitle className="text-black-600 text-sm">Evidence Files</CardTitle>
              <FileText className="text-amber-600 w-5 h-5" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{metrics.totalEvidence}</p>
              <p className="text-sm text-black-500">{metrics.pendingEvidence} pending</p>
            </CardContent>
          </Card>

          <Card className="shadow">
            <CardHeader className="flex justify-between items-center">
              <CardTitle className="text-black-600 text-sm">Awards Issued</CardTitle>
              <BarChart2 className="text-purple-600 w-5 h-5" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{metrics.totalAwards}</p>
              <p className="text-sm text-black-500">{metrics.newAwards} this quarter</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Case Trends */}
        <Card className="shadow">
          <CardHeader>
            <CardTitle>Case Trends (Past 12 Months)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={caseTrends}>
                <XAxis dataKey="month" stroke="#888" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="cases" stroke="#2563eb" strokeWidth={2} />
                <Line type="monotone" dataKey="closed" stroke="#10b981" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* User Distribution */}
        <Card className="shadow">
          <CardHeader>
            <CardTitle>User Distribution by Role</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={userStats}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="count"
                  label
                >
                  {userStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Case Outcomes */}
        <Card className="shadow lg:col-span-2">
          <CardHeader>
            <CardTitle>Case Outcomes Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={outcomes}>
                <XAxis dataKey="type" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#2563eb" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
