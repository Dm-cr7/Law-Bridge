// frontend/src/components/public/FooterPublic.jsx
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Facebook,
  Twitter,
  Linkedin,
  Instagram,
  Mail,
  Phone,
  Home,
} from "lucide-react";
import logo from "../../assets/logo.svg"; // ✅ Ensure it exists in /src/assets/

/**
 * ⚖️ FooterPublic.jsx
 * ------------------------------------------------------------
 * Dark, elegant footer for LawBridge.
 * Seamlessly integrated with the new dark illustration-based UI.
 * Subtle motion, glowing gradients, and balanced contrast.
 */

const FooterPublic = () => {
  const year = new Date().getFullYear();

  const socialLinks = [
    { name: "Facebook", icon: <Facebook size={18} />, url: "https://facebook.com" },
    { name: "Twitter", icon: <Twitter size={18} />, url: "https://twitter.com" },
    { name: "LinkedIn", icon: <Linkedin size={18} />, url: "https://linkedin.com" },
    { name: "Instagram", icon: <Instagram size={18} />, url: "https://instagram.com" },
  ];

  const quickLinks = [
    { name: "Home", path: "/" },
    { name: "About", path: "/about" },
    { name: "Features", path: "/features" },
    { name: "Contact", path: "/contact" },
    { name: "Privacy", path: "/privacy" },
  ];

  return (
    <footer className="relative w-full bg-gradient-to-b from-[#0B1120] via-[#0E1C30] to-[#162B4D] text-slate-300 border-t border-sky-800/40 overflow-hidden">
      {/* === Soft Gradient Glow === */}
      <div className="absolute inset-0 bg-gradient-to-r from-sky-600/10 via-blue-700/10 to-indigo-700/10 blur-3xl opacity-60 pointer-events-none" />

      {/* === Main Footer Section === */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12 py-14 grid grid-cols-1 md:grid-cols-3 gap-12">
        {/* 🏛 Logo & About */}
        <div>
          <Link to="/" className="flex items-center gap-3 mb-4">
            <motion.img
              src={logo}
              alt="LawBridge Logo"
              className="h-10 w-10 drop-shadow-lg"
              whileHover={{ rotate: 8, scale: 1.05 }}
              transition={{ type: "spring", stiffness: 200 }}
            />
            <span className="text-sky-200 font-bold text-xl tracking-wide">
              LawBridge
            </span>
          </Link>
          <p className="text-slate-400 text-sm leading-relaxed max-w-sm">
            Empowering justice through digital innovation.  
            LawBridge connects advocates, mediators, and clients through secure,
            transparent, and human-centered technology.
          </p>
        </div>

        {/* ⚡ Quick Links */}
        <div>
          <h3 className="text-sky-300 font-semibold text-lg mb-4">
            Quick Links
          </h3>
          <ul className="space-y-2">
            {quickLinks.map((link) => (
              <li key={link.name}>
                <Link
                  to={link.path}
                  className="flex items-center gap-2 text-slate-400 hover:text-sky-300 transition duration-200 text-sm font-medium"
                >
                  {link.name === "Home" && <Home size={14} />}
                  {link.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* 💬 Contact & Socials */}
        <div>
          <h3 className="text-sky-300 font-semibold text-lg mb-4">
            Connect With Us
          </h3>
          <div className="flex flex-col gap-2 text-sm text-slate-400">
            <p className="flex items-center gap-2">
              <Mail size={16} className="text-sky-400" />
              support@lawbridge.ai
            </p>
            <p className="flex items-center gap-2">
              <Phone size={16} className="text-sky-400" />
              +1 (800) 555-0199
            </p>
          </div>

          <div className="flex gap-4 mt-5">
            {socialLinks.map((social) => (
              <motion.a
                key={social.name}
                href={social.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-white bg-white/5 p-2 rounded-full border border-sky-700/30 hover:border-sky-500/60 hover:shadow-[0_0_15px_rgba(56,189,248,0.3)] transition-all"
                whileHover={{ scale: 1.15, rotate: 5 }}
                whileTap={{ scale: 0.95 }}
              >
                {social.icon}
              </motion.a>
            ))}
          </div>
        </div>
      </div>

      {/* === Bottom Bar === */}
      <div className="relative z-10 border-t border-sky-800/40 text-center text-slate-500 text-sm py-5 bg-[#0B1120]/60 backdrop-blur-md">
        <p>
          © {year}{" "}
          <span className="text-sky-300 font-semibold">LawBridge</span>. All
          rights reserved.
        </p>
      </div>

      {/* === Decorative Glows === */}
      <div className="absolute bottom-10 left-10 w-[200px] h-[200px] bg-sky-400/20 rounded-full blur-[120px]" />
      <div className="absolute top-20 right-16 w-[280px] h-[280px] bg-indigo-500/20 rounded-full blur-[150px]" />
    </footer>
  );
};

export default FooterPublic;
