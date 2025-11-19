import React from "react";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  Users,
  Zap,
  BarChart,
  Cloud,
  Scale,
  FileText,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";

/**
 * 🌤️ Features.jsx — Bright Gradient Edition
 * ------------------------------------------------------------
 * Light, elegant, and modern. Matches the unified LawBridge theme.
 * Soft gradients, white-glass cards, glowing icons, and friendly energy.
 */

const features = [
  {
    icon: <ShieldCheck className="w-10 h-10 text-blue-500" />,
    title: "Secure Case Management",
    description:
      "Your legal data stays encrypted and protected with enterprise-grade security that ensures total trust and compliance.",
  },
  {
    icon: <Users className="w-10 h-10 text-sky-500" />,
    title: "Collaborative Workspaces",
    description:
      "Advocates, paralegals, and clients work seamlessly together through structured workflows built for transparency and speed.",
  },
  {
    icon: <Zap className="w-10 h-10 text-amber-500" />,
    title: "Smart Automation",
    description:
      "Automate updates, reminders, and repetitive tasks — freeing your time for the work that really matters.",
  },
  {
    icon: <BarChart className="w-10 h-10 text-blue-600" />,
    title: "Data-Driven Insights",
    description:
      "Monitor performance, deadlines, and outcomes with clear analytics that help you make informed legal decisions.",
  },
  {
    icon: <Cloud className="w-10 h-10 text-sky-500" />,
    title: "Cloud Access Anywhere",
    description:
      "Work securely from any device, with real-time file sync and team-wide accessibility, wherever you go.",
  },
  {
    icon: <FileText className="w-10 h-10 text-amber-400" />,
    title: "Integrated Arbitration Tools",
    description:
      "Simplify mediation and arbitration with collaborative dashboards and seamless digital document sharing.",
  },
];

export default function Features() {
  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-sky-50 via-blue-50 to-white text-slate-800 overflow-x-hidden">
      {/* 🌅 HERO SECTION */}
      <section className="relative flex flex-col items-center justify-center text-center px-6 min-h-[75vh] overflow-hidden">
        {/* Soft glowing background */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-b from-sky-100 via-blue-50 to-white"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2 }}
        />

        <motion.div
          className="absolute top-[-10%] left-[15%] w-[400px] h-[400px] bg-sky-300/40 rounded-full blur-[140px]"
          animate={{ x: [0, 30, -30, 0], y: [0, 20, -20, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-[-15%] right-[10%] w-[500px] h-[500px] bg-amber-200/40 rounded-full blur-[160px]"
          animate={{ x: [0, -20, 20, 0], y: [0, -30, 30, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Hero Icon */}
        <motion.div
          className="relative z-10 mb-10"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
        >
          <Scale className="w-20 h-20 mx-auto text-blue-500 drop-shadow-md" />
        </motion.div>

        {/* Hero Text */}
        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <motion.h1
            className="text-4xl md:text-6xl font-extrabold bg-gradient-to-r from-blue-700 via-sky-600 to-amber-400 bg-clip-text text-transparent"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1 }}
          >
            Powerful Tools for Every Legal Professional
          </motion.h1>
          <motion.p
            className="mt-6 text-lg md:text-xl text-slate-600 leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            Simplify, collaborate, and innovate with tools designed to transform
            how the legal world works — all in one beautiful platform.
          </motion.p>
        </div>
      </section>

      {/* 💡 FEATURES GRID */}
      <section className="relative py-24 px-6 md:px-12">
        <div className="max-w-7xl mx-auto text-center">
          <motion.h2
            className="text-3xl md:text-4xl font-bold mb-10 text-blue-700"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            Designed to Empower, Built to Simplify
          </motion.h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10 mt-12">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.6,
                  delay: i * 0.1,
                  ease: "easeOut",
                }}
                whileHover={{
                  y: -8,
                  scale: 1.03,
                  boxShadow: "0 0 25px rgba(56,189,248,0.2)",
                }}
                className="bg-white border border-sky-100 p-8 rounded-2xl shadow-md hover:shadow-xl transition-all"
              >
                <div className="flex justify-center mb-4">{f.icon}</div>
                <h3 className="text-xl font-semibold mb-2 text-blue-700">
                  {f.title}
                </h3>
                <p className="text-slate-600 text-sm leading-relaxed">
                  {f.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 🌍 IMPACT SECTION */}
      <section className="relative py-24 px-6 md:px-12 bg-gradient-to-r from-sky-100 via-blue-50 to-amber-50 text-center">
        <div className="max-w-6xl mx-auto">
          <motion.h3
            className="text-3xl md:text-4xl font-bold text-blue-700 mb-6"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            Impact Beyond the Courtroom
          </motion.h3>
          <motion.p
            className="text-slate-700 max-w-3xl mx-auto leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
          >
            LawBridge transforms traditional legal work into a bright, connected,
            and client-centered experience. It’s not just software — it’s a
            movement toward modern justice.
          </motion.p>
        </div>
      </section>

      {/* 🚀 CTA SECTION */}
      <section className="relative py-24 bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500 text-center text-white overflow-hidden">
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent blur-[150px]"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />

        <div className="relative z-10">
          <motion.h2
            className="text-3xl md:text-4xl font-bold mb-4"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            Ready to Elevate Your Practice?
          </motion.h2>
          <motion.p
            className="text-blue-50 text-lg max-w-2xl mx-auto mb-10"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
          >
            Join the growing community of legal professionals simplifying their
            workflow and empowering their clients with LawBridge.
          </motion.p>

          <div className="flex justify-center gap-4 flex-wrap">
            <Button
              asChild
              className="bg-white text-blue-700 hover:bg-sky-50 font-semibold px-8 py-3 rounded-full shadow-lg shadow-blue-200/50"
            >
              <Link to="/register">Get Started</Link>
            </Button>
            <Button
              asChild
              variant="secondary"
              className="border border-white text-white hover:bg-white/10 font-semibold px-8 py-3 rounded-full transition-all"
            >
              <Link to="/contact">Contact Us</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
