import { Outlet, Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { FaLinkedin, FaTwitter, FaGithub } from "react-icons/fa";
import MobileNavBar from "@/components/public/MobileNavBar";

/**
 * ⚖️ PublicLayout.jsx
 * ------------------------------------------------------------
 * Unified 2D Bright Gradient Edition
 * Replaces old 3D Hero version. Features cohesive navbar,
 * smooth page transitions, and bright footer.
 */

// === Navbar (Desktop) ===
const Navbar = () => (
  <header className="hidden md:block fixed top-0 left-0 w-full z-50 bg-white/60 backdrop-blur-2xl border-b border-blue-100 shadow-sm">
    <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
      <Link
        to="/"
        className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-sky-600 to-amber-500 bg-clip-text text-transparent tracking-tight"
      >
        LawBridge
      </Link>

      <nav className="flex items-center gap-8 text-blue-800 font-medium">
        <Link to="/about" className="hover:text-blue-500 transition">
          About
        </Link>
        <Link to="/features" className="hover:text-blue-500 transition">
          Features
        </Link>
        <Link to="/contact" className="hover:text-blue-500 transition">
          Contact
        </Link>
        <Link to="/login">
          <Button className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-full shadow-md shadow-blue-300/30 transition">
            Login
          </Button>
        </Link>
      </nav>
    </div>
  </header>
);

// === Footer ===
const Footer = () => (
  <footer className="relative mt-24 border-t border-blue-100 bg-gradient-to-b from-white via-sky-50 to-blue-50 py-12 text-slate-700">
    <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8">
      <div>
        <h3 className="text-lg font-semibold text-blue-700 mb-3">LawBridge</h3>
        <p className="text-sm leading-relaxed text-slate-600">
          Bridging the gap between law and innovation. Empowering advocates,
          paralegals, and clients through intelligent, secure technology.
        </p>
      </div>

      <div>
        <h4 className="text-blue-700 font-semibold mb-3">Quick Links</h4>
        <ul className="space-y-2 text-sm">
          <li>
            <Link to="/about" className="hover:text-blue-500 transition">
              About
            </Link>
          </li>
          <li>
            <Link to="/features" className="hover:text-blue-500 transition">
              Features
            </Link>
          </li>
          <li>
            <Link to="/contact" className="hover:text-blue-500 transition">
              Contact
            </Link>
          </li>
          <li>
            <Link to="/privacy" className="hover:text-blue-500 transition">
              Privacy Policy
            </Link>
          </li>
        </ul>
      </div>

      <div>
        <h4 className="text-blue-700 font-semibold mb-3">Connect</h4>
        <div className="flex space-x-5 text-xl text-blue-700">
          <a
            href="https://linkedin.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-sky-500 transition"
          >
            <FaLinkedin />
          </a>
          <a
            href="https://twitter.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-sky-500 transition"
          >
            <FaTwitter />
          </a>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-sky-500 transition"
          >
            <FaGithub />
          </a>
        </div>
      </div>
    </div>

    <div className="text-center text-sm text-slate-500 mt-10">
      © {new Date().getFullYear()} LawBridge. All Rights Reserved.
    </div>
  </footer>
);

// === Page Transition Animation ===
const pageVariants = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
  exit: { opacity: 0, y: -30, transition: { duration: 0.4, ease: "easeInOut" } },
};

// === Main Layout ===
const PublicLayout = () => {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="relative min-h-screen flex flex-col bg-gradient-to-b from-sky-50 via-white to-blue-50 text-slate-800 overflow-x-hidden">
      {/* Mobile Navigation */}
      <div className="md:hidden">
        <MobileNavBar />
      </div>

      {/* Desktop Navbar */}
      <Navbar />

      {/* Page Transitions */}
      <main className="flex-grow pt-[70px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default PublicLayout;
