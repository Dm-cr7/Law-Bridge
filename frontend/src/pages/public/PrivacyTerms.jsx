import React from "react";
import { motion } from "framer-motion";
import { ShieldCheck, Scale, Lock } from "lucide-react";

/**
 * 🧾 PrivacyTerms.jsx
 * ---------------------------------------------------------------
 * Displays Privacy Policy, Terms of Use, and Compliance summary.
 * Structured for legal clarity, user trust, and responsive design.
 */

export default function PrivacyTerms() {
  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-black-50 to-black-100 text-black-800">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-800 text-white py-28 px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-3xl mx-auto"
        >
          <Lock className="w-14 h-14 mx-auto mb-6 text-blue-300" />
          <h1 className="text-4xl md:text-6xl font-bold mb-4">
            Privacy & Terms
          </h1>
          <p className="text-blue-100 text-lg md:text-xl">
            Transparency and trust are at the core of LawBridge’s values.
          </p>
        </motion.div>
      </section>

      {/* Main Content */}
      <section className="py-20 px-6 max-w-5xl mx-auto space-y-16">
        {/* Privacy Policy */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="bg-white p-8 rounded-2xl shadow-lg"
        >
          <div className="flex items-center gap-3 mb-6">
            <ShieldCheck className="w-7 h-7 text-blue-700" />
            <h2 className="text-2xl font-bold">Privacy Policy</h2>
          </div>

          <p className="text-black-600 leading-relaxed mb-4">
            LawBridge respects your privacy and is committed to protecting your
            personal information. We collect only the data necessary to provide
            our services, improve platform performance, and ensure legal
            compliance.
          </p>

          <ul className="list-disc ml-6 text-black-600 space-y-2">
            <li>
              Personal data is processed securely using encryption and
              token-based authentication.
            </li>
            <li>
              We do not sell or share your data with third parties without
              consent.
            </li>
            <li>
              Users can request access, correction, or deletion of their data
              anytime.
            </li>
            <li>
              Data retention follows legal standards applicable to your
              jurisdiction.
            </li>
          </ul>

          <p className="text-black-600 mt-4">
            For questions or concerns, please contact our Data Protection
            Officer at{" "}
            <span className="text-blue-700 font-semibold">
              privacy@lawbridge.com
            </span>
            .
          </p>
        </motion.div>

        {/* Terms of Use */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="bg-white p-8 rounded-2xl shadow-lg"
        >
          <div className="flex items-center gap-3 mb-6">
            <Scale className="w-7 h-7 text-blue-700" />
            <h2 className="text-2xl font-bold">Terms of Use</h2>
          </div>

          <p className="text-black-600 leading-relaxed mb-4">
            By accessing or using LawBridge, you agree to the following terms
            and conditions. Please read them carefully before proceeding.
          </p>

          <ul className="list-disc ml-6 text-black-600 space-y-2">
            <li>
              LawBridge is provided for professional and lawful use only.
            </li>
            <li>
              You are responsible for maintaining the confidentiality of your
              account credentials.
            </li>
            <li>
              Any unauthorized access, data tampering, or misuse of platform
              resources is strictly prohibited.
            </li>
            <li>
              LawBridge reserves the right to update terms or features without
              prior notice to maintain service integrity.
            </li>
          </ul>

          <p className="text-black-600 mt-4">
            Violation of these terms may result in suspension or termination of
            your account in accordance with applicable law.
          </p>
        </motion.div>

        {/* Compliance & Legal Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="bg-blue-900 text-white p-10 rounded-2xl shadow-xl"
        >
          <h3 className="text-2xl font-bold mb-4">
            Compliance & Legal Responsibility
          </h3>
          <p className="text-blue-100 mb-6">
            LawBridge complies with global data protection standards including
            GDPR and applicable regional legal frameworks. We maintain a
            zero-tolerance policy for ethical or legal misconduct.
          </p>

          <ul className="list-disc ml-6 space-y-2 text-blue-100">
            <li>GDPR (General Data Protection Regulation)</li>
            <li>Local Bar Council Compliance (where applicable)</li>
            <li>Secure Cloud Infrastructure (ISO/IEC 27001 Certified)</li>
          </ul>
        </motion.div>
      </section>

      {/* Footer Note */}
      <footer className="text-center py-10 text-black-500 text-sm">
        © {new Date().getFullYear()} LawBridge. All rights reserved. |
        Privacy & Terms.
      </footer>
    </div>
  );
}
