// src/pages/About.jsx
import React from "react";
import { motion } from "framer-motion";
import { Users, Target, Globe, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/Button.jsx";
import ResponsiveImage from "@/components/ResponsiveImage";

/**
 * 🌤️ About.jsx — Bright Gradient Edition (images from /public/images)
 * - Uses local images for hero, story, and team
 * - Uses ResponsiveImage for better loading and layout stability
 */

export default function About() {
  // local images (public folder)
  const heroBg = "/images/legal-bg.jpg";
  const storyImg = "/images/4.jpg"; // choose a good content image from your set
  const team = [
    { name: "David Kamau", title: "Founder & CEO", img: "/images/1.jpg" },
    { name: "Jane Wanjiku", title: "Head of Legal Innovation", img: "/images/2.jpg" },
    { name: "Edward Njoroge", title: "Chief Technology Officer", img: "/images/3.jpg" },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-sky-50 via-blue-50 to-white text-slate-800 overflow-x-hidden">
      {/* 🌅 HERO SECTION */}
      <section
        className="relative flex flex-col items-center justify-center text-center min-h-[65vh] overflow-hidden px-6"
        aria-label="About hero"
      >
        {/* local hero background image (subtle) */}
        <motion.div
          className="absolute inset-0 -z-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2 }}
          aria-hidden
        >
          <ResponsiveImage
            src={heroBg}
            alt="Courtroom background"
            className="w-full h-full object-cover"
            priority={true}
            style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.9) contrast(0.95)" }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-white/40 to-transparent" aria-hidden />
        </motion.div>

        {/* floating accents */}
        <motion.div
          className="absolute -top-32 left-[10%] w-[400px] h-[400px] bg-sky-300/20 rounded-full blur-[120px] pointer-events-none"
          animate={{ x: [0, 25, -25, 0], y: [0, 15, -15, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          aria-hidden
        />
        <motion.div
          className="absolute bottom-[-10%] right-[5%] w-[450px] h-[450px] bg-amber-200/16 rounded-full blur-[160px] pointer-events-none"
          animate={{ x: [0, -30, 30, 0], y: [0, 20, -20, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          aria-hidden
        />

        {/* content */}
        <div className="relative z-10 max-w-3xl px-4">
          <motion.h1
            className="text-4xl md:text-6xl font-extrabold bg-gradient-to-r from-blue-700 via-sky-600 to-amber-500 bg-clip-text text-transparent mb-4"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1 }}
          >
            About <span className="text-blue-700">LawBridge</span>
          </motion.h1>

          <motion.p
            className="text-slate-600 text-lg md:text-xl leading-relaxed font-medium"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            Bridging justice through technology, innovation, and human empathy.
          </motion.p>
        </div>
      </section>

      {/* 🧩 OUR STORY */}
      <section className="relative py-24 px-6 bg-gradient-to-r from-sky-50 via-blue-50 to-sky-100">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <motion.div
            className="rounded-2xl shadow-xl border border-blue-100 overflow-hidden"
            initial={{ opacity: 0, x: -60 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
          >
            <ResponsiveImage
              src={storyImg}
              alt="LawBridge team in discussion"
              className="w-full h-full object-cover"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 60 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-3xl font-bold mb-4 text-blue-700">Who We Are</h2>
            <p className="text-slate-700 mb-4 leading-relaxed">
              LawBridge is a next-generation legal-tech ecosystem connecting
              advocates, clients, mediators, and arbitrators under one
              transparent digital bridge. Our mission is to democratize access
              to justice, simplify legal operations, and foster collaboration
              across jurisdictions.
            </p>
            <p className="text-slate-700 leading-relaxed">
              From secure case management to real-time communication tools,
              we’re empowering the legal community to work smarter, faster,
              and more collaboratively — all in one platform.
            </p>
          </motion.div>
        </div>
      </section>

      {/* 🎯 VISION & MISSION */}
      <section className="relative py-24 px-6 bg-gradient-to-r from-sky-100 via-blue-100 to-amber-50">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12">
          <motion.div
            className="bg-gradient-to-br from-sky-400 to-blue-500 text-white rounded-2xl p-10 shadow-lg shadow-blue-200/50"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <Target className="w-10 h-10 mb-4 text-white" />
            <h3 className="text-2xl font-semibold mb-3">Our Vision</h3>
            <p className="text-blue-50 leading-relaxed">
              To redefine justice delivery across Africa and beyond through
              innovation, digital trust, and collaboration — making the legal
              system transparent, efficient, and inclusive.
            </p>
          </motion.div>

          <motion.div
            className="bg-gradient-to-br from-amber-300 to-yellow-400 text-slate-800 rounded-2xl p-10 shadow-lg shadow-amber-100/50"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.7 }}
          >
            <Briefcase className="w-10 h-10 mb-4 text-slate-800" />
            <h3 className="text-2xl font-semibold mb-3">Our Mission</h3>
            <p className="text-slate-700 leading-relaxed">
              To empower legal professionals and clients with smart, secure,
              and integrated digital tools — creating fairness, speed, and trust
              in every interaction.
            </p>
          </motion.div>
        </div>
      </section>

      {/* 👥 TEAM SECTION */}
      <section className="py-24 px-6 bg-gradient-to-b from-white to-sky-50">
        <div className="max-w-6xl mx-auto text-center mb-16">
          <h2 className="text-3xl font-bold text-blue-700">Meet the Team</h2>
          <p className="text-slate-600 mt-3">The minds and hearts driving LawBridge forward.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-10 max-w-6xl mx-auto px-4">
          {team.map((member, i) => (
            <motion.div
              key={member.name}
              className="bg-white rounded-2xl shadow-md hover:shadow-xl overflow-hidden transition-all duration-300 border border-sky-100"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.15 }}
            >
              <ResponsiveImage
                src={member.img}
                alt={member.name}
                className="w-full h-64 object-cover"
                style={{ width: "100%", height: "16rem", objectFit: "cover" }}
              />
              <div className="p-6 text-center">
                <h3 className="text-xl font-semibold text-blue-700">{member.name}</h3>
                <p className="text-sky-500 font-medium">{member.title}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* 🌍 IMPACT SECTION */}
      <section className="py-20 bg-gradient-to-r from-sky-200 via-blue-100 to-amber-100 text-center">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-10 text-slate-800 px-4">
          {[
            { icon: <Users className="w-10 h-10 mx-auto mb-3 text-blue-600" />, number: "5,000+", label: "Active Users" },
            { icon: <Globe className="w-10 h-10 mx-auto mb-3 text-blue-600" />, number: "12+", label: "Countries Reached" },
            { icon: <Target className="w-10 h-10 mx-auto mb-3 text-blue-600" />, number: "98%", label: "User Satisfaction" },
          ].map((stat, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.15 }}>
              {stat.icon}
              <h3 className="text-3xl font-bold text-blue-800">{stat.number}</h3>
              <p className="text-slate-600 mt-2">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* 🚀 CTA FOOTER */}
      <section className="py-24 bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500 text-white text-center relative overflow-hidden px-4">
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent blur-[150px]"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 8, repeat: Infinity }}
          aria-hidden
        />
        <div className="relative z-10 max-w-3xl mx-auto">
          <motion.h2 className="text-3xl md:text-4xl font-bold" initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            Together, We’re Building the Future of Justice
          </motion.h2>
          <p className="mt-4 text-blue-100 max-w-2xl mx-auto">
            LawBridge isn’t just a platform — it’s a bright vision for justice,
            collaboration, and progress.
          </p>

          <div className="mt-10">
            <Button className="bg-white text-blue-700 hover:bg-sky-50 rounded-full px-8 py-3 text-lg font-semibold shadow-lg shadow-blue-200/40">
              Join the Vision
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
