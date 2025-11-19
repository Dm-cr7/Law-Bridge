// src/pages/Contact.jsx
import React from "react";
import { motion } from "framer-motion";
import { Mail, MapPin, Phone, Clock, ArrowRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/Button.jsx";
import ResponsiveImage from "@/components/ResponsiveImage";

/**
 * Contact.jsx — iframe removed (CSP-free)
 * - Shows a local/served snapshot image (public/images/map-snapshot.jpg) as visual
 * - Provides an "Open in Google Maps" button that opens the live map in a new tab
 *
 * Notes:
 * - Place a file named /public/images/map-snapshot.jpg in your frontend public folder (replace with any image)
 * - No CSP changes required
 */

export default function Contact() {
  const heroBg = "/images/legal-bg.jpg";
  const contactVisual = "/images/5.jpg";
  // Link to open in new tab (same URL as the iframe src)
  const mapsUrl =
    "https://www.google.com/maps/place/Nairobi/@-1.292066,36.821946,13z";

  // Local snapshot — keep this file in your frontend public/images folder
  const mapSnapshot = "/images/map-snapshot.jpg";

  return (
    <div className="flex flex-col min-h-screen bg-white text-slate-900 overflow-x-hidden">
      {/* 🌠 HERO SECTION */}
      <section
        className="relative w-full h-[60vh] flex items-center justify-center bg-gradient-to-br from-blue-900 via-indigo-900 to-black-900 text-white text-center"
        aria-label="Contact hero"
      >
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
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: "brightness(0.45) contrast(0.95)",
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-br from-blue-900/60 via-indigo-900/40 to-black-900/40" />
        </motion.div>

        <div className="relative z-10 px-6 max-w-3xl mx-auto">
          <motion.h1
            className="text-4xl md:text-6xl font-bold leading-tight"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1 }}
          >
            Let’s Connect
          </motion.h1>
          <motion.p
            className="mt-4 text-lg md:text-xl text-blue-100"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            Have questions, partnership ideas, or want to join the movement?
            We’re here to listen and collaborate.
          </motion.p>
        </div>
      </section>

      {/* 📨 CONTACT FORM SECTION */}
      <section className="py-24 px-6 bg-slate-50">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
          {/* Contact Info + visual */}
          <div>
            <div className="rounded-2xl overflow-hidden shadow-lg mb-8 border border-sky-100">
              <ResponsiveImage
                src={contactVisual}
                alt="Law books and workspace"
                className="w-full h-56 object-cover"
                style={{ width: "100%", height: "14rem", objectFit: "cover" }}
              />
            </div>

            <h2 className="text-3xl font-semibold mb-6 text-slate-900">
              Get in Touch with LawBridge
            </h2>
            <p className="text-slate-700 mb-8 leading-relaxed">
              Whether you’re a law firm, advocate, client, or mediator — LawBridge is designed to
              connect and empower. Reach out today to learn how we can collaborate and create impact.
            </p>

            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <MapPin className="text-blue-600 w-6 h-6 mt-1" />
                <div>
                  <p className="font-semibold">Head Office</p>
                  <p className="text-slate-700">
                    12th Floor, LegalTech Tower, Nairobi, Kenya
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <Mail className="text-blue-600 w-6 h-6 mt-1" />
                <div>
                  <p className="font-semibold">Email Us</p>
                  <p className="text-slate-700">contact@lawbridge.africa</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <Phone className="text-blue-600 w-6 h-6 mt-1" />
                <div>
                  <p className="font-semibold">Call</p>
                  <p className="text-slate-700">+254 712 345 678</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <Clock className="text-blue-600 w-6 h-6 mt-1" />
                <div>
                  <p className="font-semibold">Business Hours</p>
                  <p className="text-slate-700">
                    Monday – Friday: 8:00 AM – 6:00 PM
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Form */}
          <motion.form
            className="bg-white shadow-xl rounded-2xl p-8 space-y-6"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            onSubmit={(e) => e.preventDefault()}
            aria-label="Contact form"
          >
            <div>
              <label htmlFor="fullName" className="block text-slate-800 font-medium mb-2">
                Full Name
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                placeholder="Your Name"
                required
                aria-required="true"
                className="w-full border border-slate-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-slate-800 font-medium mb-2">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
                aria-required="true"
                className="w-full border border-slate-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="subject" className="block text-slate-800 font-medium mb-2">
                Subject
              </label>
              <input
                id="subject"
                name="subject"
                type="text"
                placeholder="What’s this about?"
                className="w-full border border-slate-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="message" className="block text-slate-800 font-medium mb-2">
                Message
              </label>
              <textarea
                id="message"
                name="message"
                rows="5"
                placeholder="Tell us how we can help..."
                className="w-full border border-slate-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              ></textarea>
            </div>
            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg text-lg font-semibold flex items-center justify-center gap-2"
            >
              Send Message
              <ArrowRight className="w-5 h-5" />
            </Button>
          </motion.form>
        </div>
      </section>

      {/* 🗺️ MAP / VISUAL — replaced iframe with image + open-in-maps button */}
      <section className="relative w-full px-6 pb-12">
        <div className="max-w-6xl mx-auto">
          <div className="rounded-2xl overflow-hidden shadow-lg border border-slate-200">
            {/* ResponsiveImage points to a local or served image (no CSP issues) */}
            <ResponsiveImage
              src={mapSnapshot}
              alt="Map snapshot — click to open in Google Maps"
              className="w-full h-[400px] object-cover"
              style={{ width: "100%", height: "400px", objectFit: "cover" }}
            />
          </div>

          <div className="mt-4 flex items-center justify-center gap-4">
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-white text-slate-900 px-5 py-3 rounded-full shadow hover:shadow-md transition"
            >
              Open in Google Maps
              <ExternalLink className="w-4 h-4" />
            </a>

            {/* Optional: download or view fullscreen (if you want) */}
            <a
              href={mapSnapshot}
              download
              className="inline-flex items-center gap-2 text-slate-700 px-4 py-2 rounded-full hover:bg-slate-100 transition"
            >
              View Snapshot
            </a>
          </div>
        </div>
      </section>

      {/* 💬 CTA */}
      <section className="py-24 bg-gradient-to-r from-indigo-700 via-blue-700 to-indigo-800 text-white text-center">
        <motion.h2
          className="text-3xl md:text-4xl font-bold"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          Building Bridges in the Legal World
        </motion.h2>
        <p className="mt-4 text-blue-100 max-w-2xl mx-auto">
          LawBridge is redefining how justice is delivered and experienced.
          Let’s make the system more human, efficient, and transparent together.
        </p>

        <div className="mt-10">
          <Button className="bg-white text-blue-700 hover:bg-blue-50 rounded-full px-8 py-3 text-lg font-semibold">
            Join the Conversation
          </Button>
        </div>
      </section>
    </div>
  );
}
