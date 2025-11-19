import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HelpCircle, Mail, MessageSquare, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * 🧠 FAQ.jsx / Support Page
 * --------------------------------------------------------------------
 * Engaging, mobile-responsive FAQ + support center with collapsible
 * answers and a CTA to contact support directly.
 */

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState(null);

  const faqs = [
    {
      question: "What is LawBridge and how does it work?",
      answer:
        "LawBridge is an AI-powered legal collaboration platform designed to connect advocates, clients, paralegals, mediators, and arbitrators in a single, secure workspace. It simplifies case management, document sharing, and communication through intelligent automation and real-time updates.",
    },
    {
      question: "Is my data secure on LawBridge?",
      answer:
        "Absolutely. LawBridge employs enterprise-grade encryption, multi-layer authentication, and secure data centers. We follow international compliance standards, ensuring that your sensitive legal data remains private and protected.",
    },
    {
      question: "Can clients access their case details in real time?",
      answer:
        "Yes. Clients can securely log in to their personalized dashboards, view case progress, upload documents, and communicate directly with their legal representatives.",
    },
    {
      question: "Is LawBridge suitable for small law firms?",
      answer:
        "Definitely. LawBridge is built to scale — whether you’re a solo advocate or a large firm, our modular tools adapt to your workflow and grow with your practice.",
    },
    {
      question: "Do I need to install any software?",
      answer:
        "No installation required. LawBridge is fully cloud-based and accessible through any modern browser on desktop, tablet, or mobile.",
    },
  ];

  const toggleFAQ = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-black-50 to-black-100 text-black-800">
      {/* Hero / Header */}
      <section className="relative bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-800 text-white py-28 px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-3xl mx-auto"
        >
          <HelpCircle className="w-14 h-14 mx-auto mb-6 text-blue-300" />
          <h1 className="text-4xl md:text-6xl font-bold mb-4">Help & Support</h1>
          <p className="text-blue-100 text-lg md:text-xl">
            Your questions answered. Everything you need to know to get the most out of LawBridge.
          </p>
        </motion.div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-6 max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-12 text-black-800">
          Frequently Asked Questions
        </h2>

        <div className="space-y-6">
          {faqs.map((faq, i) => (
            <motion.div
              key={i}
              className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1, duration: 0.6 }}
            >
              <button
                className="w-full flex justify-between items-center p-6 text-left"
                onClick={() => toggleFAQ(i)}
              >
                <span className="text-lg font-medium">{faq.question}</span>
                <ChevronDown
                  className={`w-6 h-6 transition-transform duration-300 ${
                    openIndex === i ? "rotate-180 text-blue-600" : ""
                  }`}
                />
              </button>
              <AnimatePresence initial={false}>
                {openIndex === i && (
                  <motion.div
                    key="content"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.4 }}
                    className="px-6 pb-6 text-black-600"
                  >
                    <p>{faq.answer}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Support Contact CTA */}
      <section className="bg-blue-900 text-white py-24 px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="max-w-2xl mx-auto"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Still Need Help?
          </h2>
          <p className="text-blue-100 mb-8 text-lg">
            Our support team is here to assist you 24/7. Reach out for account,
            technical, or onboarding assistance.
          </p>
          <div className="flex flex-col md:flex-row gap-4 justify-center">
            <Button className="bg-white text-blue-900 hover:bg-blue-100 px-6 py-3 rounded-full font-semibold flex items-center justify-center gap-2">
              <Mail className="w-5 h-5" /> Email Support
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-full font-semibold flex items-center justify-center gap-2">
              <MessageSquare className="w-5 h-5" /> Live Chat
            </Button>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
