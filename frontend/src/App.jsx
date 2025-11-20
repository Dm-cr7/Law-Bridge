// frontend/src/App.jsx
import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

// 🌍 Layouts
import PublicLayout from "./layouts/PublicLayout.jsx";
import DashboardLayout from "./layouts/DashboardLayout.jsx";

// 🌀 Lazy-loaded Public Pages
const Home = lazy(() => import("./pages/public/Home.jsx"));
const About = lazy(() => import("./pages/public/About.jsx"));
const Services = lazy(() => import("./pages/public/Services.jsx"));
const Features = lazy(() => import("./pages/public/Features.jsx"));
const Contact = lazy(() => import("./pages/public/Contact.jsx"));
const FAQ = lazy(() => import("./pages/public/FAQ.jsx"));
const PrivacyTerms = lazy(() => import("./pages/public/PrivacyTerms.jsx"));
const Login = lazy(() => import("./pages/public/Login.jsx"));
const Register = lazy(() => import("./pages/public/Register.jsx"));
const ForgotPassword = lazy(() => import("./pages/public/ForgotPassword.jsx"));
const ResetPassword = lazy(() => import("./pages/public/ResetPassword.jsx"));
// Make sure file name casing matches the file in your repo:
const VerifyEmail = lazy(() => import("./pages/public/VerifyEmail.jsx"));

// ⚖️ Role Dashboards
const AdvocateDashboard = lazy(() => import("./pages/AdvocateDashboard.jsx"));
const ParalegalDashboard = lazy(() => import("./pages/ParalegalDashboard.jsx"));
const MediatorDashboard = lazy(() => import("./pages/MediatorDashboard.jsx"));
const ReconciliatorDashboard = lazy(() => import("./pages/ReconciliatorDashboard.jsx"));
const ArbitratorDashboard = lazy(() => import("./pages/ArbitratorDashboard.jsx"));
const RoleBasedDashboard = lazy(() => import("./pages/dashboard/RoleBasedDashboard.jsx"));

// 📁 Common Authenticated Pages
const Cases = lazy(() => import("./pages/Cases.jsx"));
const CaseDetails = lazy(() => import("./pages/CaseDetails.jsx"));
const Clients = lazy(() => import("./pages/Clients.jsx"));
const Tasks = lazy(() => import("./pages/Tasks.jsx"));
const ReportsPage = lazy(() => import("./pages/ReportsPage.jsx"));
const Analytics = lazy(() => import("./pages/Analytics.jsx"));
const Profile = lazy(() => import("./pages/Profile.jsx"));
const Settings = lazy(() => import("./pages/Settings.jsx"));
const NotificationsCenter = lazy(() => import("./pages/NotificationsCenter.jsx"));

// 📅 Hearings Module
const HearingsCalendar = lazy(() => import("./components/HearingsCalendar.jsx"));
const HearingsPage = lazy(() => import("./pages/HearingsPage.jsx"));
const HearingScheduler = lazy(() => import("./components/arbitrator/HearingScheduler.jsx"));

// 👩‍💼 Paralegal-specific
const ParalegalTasks = lazy(() => import("./pages/ParalegalTasks.jsx"));
const IntakePage = lazy(() => import("./pages/intake/IntakePage.jsx"));

// 👑 Admin routes
const AdminAnalytics = lazy(() => import("./pages/admin/AdminAnalytics.jsx"));
const Reports = lazy(() => import("./pages/admin/Reports.jsx"));
const ReportsDashboard = lazy(() => import("./pages/admin/ReportsDashboard.jsx"));
const UserManagement = lazy(() => import("./pages/admin/UserManagement.jsx"));

// ⚖️ Arbitration Routes
const ArbitrationList = lazy(() => import("./pages/arbitrations/ArbitrationList.jsx"));
const ArbitrationDetail = lazy(() => import("./pages/arbitrations/ArbitrationDetail.jsx"));
const ArbitrationHearingRoom = lazy(() => import("./pages/arbitrations/ArbitrationHearingRoom.jsx"));
const AwardPreview = lazy(() => import("./pages/arbitrations/AwardPreview.jsx"));

// 🧪 Misc & Fallback
const TestUI = lazy(() => import("./pages/TestUI.jsx"));
const NotFound = lazy(() => import("./pages/public/NotFound.jsx"));

export default function App() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen bg-black text-white">
          <span className="animate-pulse text-xl font-semibold text-indigo-400">
            Loading LawBridge...
          </span>
        </div>
      }
    >
      <Routes>
        {/* 🌍 PUBLIC ROUTES (PublicLayout) */}
        <Route element={<PublicLayout />}>
          {/* Keep root (/) canonical so old links work */}
          <Route path="/" element={<Home />} />
          {/* Keep /home as an alias that redirects to / (prevents 404 for /home links) */}
          <Route path="/home" element={<Navigate to="/" replace />} />

          <Route path="/about" element={<About />} />
          <Route path="/services" element={<Services />} />
          <Route path="/features" element={<Features />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/privacy" element={<PrivacyTerms />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
        </Route>

        {/* 🔒 PROTECTED ROUTES - wrapped by ProtectedRoute */}
        <Route
          element={
            <ProtectedRoute
              allowedRoles={[
                "advocate",
                "paralegal",
                "mediator",
                "reconciliator",
                "arbitrator",
                "admin",
              ]}
            />
          }
        >
          {/* DashboardLayout mounted at /dashboard with nested routes */}
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<RoleBasedDashboard />} />

            {/* explicit role pages */}
            <Route path="advocate" element={<AdvocateDashboard />} />
            <Route path="paralegal" element={<ParalegalDashboard />} />
            <Route path="mediator" element={<MediatorDashboard />} />
            <Route path="reconciliator" element={<ReconciliatorDashboard />} />
            <Route path="arbitrator" element={<ArbitratorDashboard />} />

            {/* paralegal intake */}
            <Route path="intake" element={<IntakePage />} />

            {/* hearings - keep canonical /dashboard/hearings */}
            <Route path="hearings" element={<HearingsCalendar />} />
            {/* extra hearings pages */}
            <Route path="hearings/page" element={<HearingsPage />} />
            <Route path="hearings/scheduler" element={<HearingScheduler />} />

            <Route path="paralegal/tasks" element={<ParalegalTasks />} />
            <Route path="cases" element={<Cases />} />
            <Route path="cases/:id" element={<CaseDetails />} />
            <Route path="clients" element={<Clients />} />
            <Route path="profile" element={<Profile />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="notifications" element={<NotificationsCenter />} />
            <Route path="settings" element={<Settings />} />
            <Route path="test-ui" element={<TestUI />} />

            {/* admin */}
            <Route path="admin/analytics" element={<AdminAnalytics />} />
            <Route path="admin/reports" element={<Reports />} />
            <Route path="admin/reports-dashboard" element={<ReportsDashboard />} />
            <Route path="admin/users" element={<UserManagement />} />

            {/* arbitrations */}
            <Route path="arbitrations" element={<ArbitrationList />} />
            <Route path="arbitrations/:id" element={<ArbitrationDetail />} />
            <Route path="arbitrations/:id/hearing" element={<ArbitrationHearingRoom />} />
            <Route path="arbitrations/:id/award" element={<AwardPreview />} />
          </Route>
        </Route>

        {/* 🚫 404 fallback */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
