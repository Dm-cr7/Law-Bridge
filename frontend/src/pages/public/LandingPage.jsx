//D:\back up main\legal-justice-dashboard\frontend\src\pages\public\LandingPage.jsx
import React from "react";
import NavbarPublic from "@/components/public/NavbarPublic";
import FooterPublic from "@/components/public/FooterPublic";
import Hero3D from "@/components/public/Hero3D";
import { Button } from "@/components/ui/Button.jsx";
import { motion } from "framer-motion";
import { Users, Mail, Globe, LogIn } from "lucide-react";

/**
 * 🌍 Public Landing Page
 * - First page visitors see
 * - Highlights company name, mission, vision, about, and contact
 * - Ends with login CTA (for professionals only)
 */
const LandingPage = () => {
  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-white via-blue-50 to-white text-black-800">
      {/* 🌐 Navbar */}
      <NavbarPublic />

      {/* 🪩 Hero 3D Section */}
      <section className="relative flex flex-col items-center justify-center w-full h-[90vh]">
        <Hero3D />
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="absolute bottom-20 text-center"
        >
          <h1 className="text-4xl md:text-6xl font-bold text-black-900 drop-shadow-lg">
            Welcome to <span className="text-blue-600">law Bridge Legal Hub</span>
          </h1>
          <p className="mt-4 text-lg md:text-xl text-black-600 max-w-2xl mx-auto">
            Empowering advocates, mediators, and paralegals with seamless legal management and collaboration tools.
          </p>
        </motion.div>
      </section>

      {/* 💡 Vision & Mission */}
      <section
        id="vision"
        className="py-20 bg-gradient-to-r from-blue-50 to-blue-100 text-center"
      >
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-3xl md:text-4xl font-bold mb-10 text-black-800"
        >
          Our Vision & Mission
        </motion.h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 px-6 md:px-20 max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="bg-white rounded-2xl shadow-lg p-8 hover:shadow-xl"
          >
            <h3 className="text-2xl font-semibold text-blue-700 mb-4">
              Our Vision
            </h3>
            <p className="text-black-600 leading-relaxed">
              To revolutionize the legal ecosystem by fostering collaboration,
              transparency, and digital transformation in legal processes.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="bg-white rounded-2xl shadow-lg p-8 hover:shadow-xl"
          >
            <h3 className="text-2xl font-semibold text-blue-700 mb-4">
              Our Mission
            </h3>
            <p className="text-black-600 leading-relaxed">
              To empower advocates, paralegals, and mediators with intuitive
              digital tools for efficient case handling, document management,
              and client engagement.
            </p>
          </motion.div>
        </div>
      </section>

      {/* 🧭 About Section */}
      <section id="about" className="py-20 bg-white text-center">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-3xl md:text-4xl font-bold mb-10 text-black-800"
        >
          Who We Are
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="text-lg text-black-600 max-w-3xl mx-auto px-6"
        >
          law Bridge Legal Hub is a modern platform dedicated to streamlining legal workflows.
          Our system integrates communication, documentation, scheduling, and task management —
          making the legal profession smarter and more collaborative.
        </motion.p>
      </section>

      {/* 📞 Contact & Socials */}
      <section
        id="contact"
        className="py-20 bg-gradient-to-r from-blue-600 to-indigo-700 text-white text-center"
      >
        <h2 className="text-3xl md:text-4xl font-bold mb-8">
          Connect With Us
        </h2>
        <div className="flex flex-wrap justify-center gap-6 mb-10">
          <div className="flex items-center gap-2">
            <Mail size={20} />
            <span>contact@law Bridgehub.com</span>
          </div>
          <div className="flex items-center gap-2">
            <Globe size={20} />
            <span>www.law Bridgehub.com</span>
          </div>
          <div className="flex items-center gap-2">
            <Users size={20} />
            <span>@law BridgeHub (Twitter, LinkedIn)</span>
          </div>
        </div>
      </section>

      {/* 🚪 Login CTA */}
      <section className="py-24 bg-black-100 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-3xl font-bold text-black-800 mb-6"
        >
          Professional Portal
        </motion.h2>
        <p className="text-black-600 mb-8">
          Are you an advocate, mediator, or paralegal?  
          Access your secure workspace below.
        </p>
        <Button
          asChild
          size="lg"
          className="bg-blue-600 hover:bg-blue-700 text-white text-lg rounded-xl shadow-lg"
        >
          <a href="/login">
            <LogIn className="mr-2" /> Go to Login Portal
          </a>
        </Button>
      </section>

      {/* 🦶 Footer */}
      <FooterPublic />
    </div>
  );
};

export default LandingPage;
