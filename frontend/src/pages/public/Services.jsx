//frontend\src\pages\public\Services.jsx
import React from "react";
import { motion } from "framer-motion";
import { Scale, Users, Briefcase, Gavel, Handshake, Workflow } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * 💼 Services.jsx
 * ------------------------------------------------------------
 * A world-class product page highlighting LawBridge’s suite
 * of legal collaboration tools for different professional roles.
 */

export default function Services() {
  const services = [
    {
      title: "For Advocates",
      icon: <Scale className="w-12 h-12 text-blue-500 mb-4" />,
      description:
        "Manage cases, track deadlines, and collaborate securely with clients, paralegals, and mediators — all in one intelligent dashboard.",
      image:
        "https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=1000&q=80",
    },
    {
      title: "For Clients",
      icon: <Users className="w-12 h-12 text-indigo-500 mb-4" />,
      description:
        "Access your case status, upload documents, communicate with your advocate, and receive updates in real time with full transparency.",
      image:
        "https://images.unsplash.com/photo-1522204504621-6c8e1a8b99c3?auto=format&fit=crop&w=1000&q=80",
    },
    {
      title: "For Paralegals",
      icon: <Briefcase className="w-12 h-12 text-blue-500 mb-4" />,
      description:
        "Stay aligned with case assignments, manage filings, track progress, and coordinate seamlessly with advocates through structured workflows.",
      image:
        "https://images.unsplash.com/photo-1591696205602-2f950c417cb9?auto=format&fit=crop&w=1000&q=80",
    },
    {
      title: "For Mediators",
      icon: <Handshake className="w-12 h-12 text-indigo-500 mb-4" />,
      description:
        "Host virtual mediation sessions, manage evidence, and document agreements with built-in confidentiality and integrity protection.",
      image:
        "https://images.unsplash.com/photo-1581091870634-88e23f120d4d?auto=format&fit=crop&w=1000&q=80",
    },
    {
      title: "For Arbitrators",
      icon: <Gavel className="w-12 h-12 text-blue-500 mb-4" />,
      description:
        "Simplify arbitration processes with case history access, document verification, and structured award generation tools powered by AI.",
      image:
        "https://images.unsplash.com/photo-1613240797832-92e9de28fffd?auto=format&fit=crop&w=1000&q=80",
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-black-50 text-black-800">
      {/* 🌐 Hero Section */}
      <section className="relative bg-gradient-to-br from-blue-900 via-indigo-900 to-black-900 text-white text-center py-32 px-6 overflow-hidden">
        <motion.div
          className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1556761175-4b46a572b786?auto=format&fit=crop&w=1600&q=80')] bg-cover bg-center opacity-20"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.25 }}
          transition={{ duration: 1.2 }}
        />
        <motion.div
          className="relative z-10 max-w-3xl mx-auto"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
        >
          <h1 className="text-4xl md:text-6xl font-bold">
            What We <span className="text-blue-400">Offer</span>
          </h1>
          <p className="mt-4 text-blue-100 text-lg md:text-xl">
            A unified digital bridge connecting every legal stakeholder — built
            for transparency, speed, and collaboration.
          </p>
        </motion.div>
      </section>

      {/* 🧠 Service Cards */}
      <section className="py-24 px-6 max-w-7xl mx-auto grid md:grid-cols-2 lg:grid-cols-3 gap-12">
        {services.map((service, i) => (
          <motion.div
            key={i}
            className="relative bg-white rounded-2xl shadow-lg hover:shadow-2xl overflow-hidden group"
            initial={{ opacity: 0, y: 60 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.2, duration: 0.7 }}
          >
            <img
              src={service.image}
              alt={service.title}
              className="w-full h-52 object-cover transform group-hover:scale-105 transition-all duration-500"
              loading="lazy"
            />
            <div className="p-6">
              {service.icon}
              <h3 className="text-2xl font-semibold mb-3">{service.title}</h3>
              <p className="text-black-600 leading-relaxed mb-4">
                {service.description}
              </p>
              <Button
                variant="outline"
                className="border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white transition-all rounded-full"
              >
                Learn More
              </Button>
            </div>
          </motion.div>
        ))}
      </section>

      {/* ⚙️ Platform Overview */}
      <section className="bg-gradient-to-r from-indigo-700 via-blue-700 to-indigo-800 text-white py-24 px-6 text-center">
        <motion.div
          className="max-w-4xl mx-auto"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <Workflow className="w-12 h-12 mx-auto mb-4 text-blue-200" />
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Seamless Workflows, Unified Vision
          </h2>
          <p className="text-blue-100 mb-8 text-lg">
            LawBridge’s modular ecosystem ensures that each role — advocate,
            client, paralegal, mediator, or arbitrator — collaborates through a
            synchronized digital workflow that promotes transparency and trust.
          </p>
          <Button className="bg-white text-indigo-800 hover:bg-blue-100 rounded-full px-8 py-3 text-lg font-semibold">
            Explore the Platform
          </Button>
        </motion.div>
      </section>

      {/* 🚀 Call To Action */}
      <section className="py-20 bg-black-900 text-white text-center">
        <motion.h2
          className="text-3xl md:text-4xl font-bold"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          Experience the Future of Legal Collaboration
        </motion.h2>
        <p className="mt-4 text-black-400 max-w-2xl mx-auto">
          Join thousands of professionals transforming their legal practice
          through the power of LawBridge.
        </p>
        <div className="mt-10">
          <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-8 py-3 text-lg font-semibold">
            Get Started
          </Button>
        </div>
      </section>
    </div>
  );
}
