import { useState, useEffect } from "react";
import { Link, NavLink } from "react-router-dom";
import { Menu, X, Home, Info, Star, Mail, LogIn } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import logo from "../../assets/logo.svg"; // ✅ Ensure this exists in /src/assets/

/**
 * 🌤️ MobileNavBar.jsx — Bright Gradient Edition
 * ------------------------------------------------------------
 * Clean, elegant, and responsive top navigation.
 * Unified with the new bright LawBridge visual identity.
 * Sky → white gradients, soft shadows, and motion highlights.
 */

const MobileNavBar = () => {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 15);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { name: "Home", to: "/", icon: <Home size={18} /> },
    { name: "About", to: "/about", icon: <Info size={18} /> },
    { name: "Features", to: "/features", icon: <Star size={18} /> },
    { name: "Contact", to: "/contact", icon: <Mail size={18} /> },
  ];

  return (
    <motion.nav
      className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/80 backdrop-blur-xl border-b border-blue-100 shadow-md"
          : "bg-gradient-to-b from-sky-50/70 via-white/70 to-transparent backdrop-blur-xl"
      }`}
      initial={{ y: -70 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 160 }}
    >
      {/* === Top Bar === */}
      <div className="flex justify-between items-center px-5 py-3">
        {/* Logo & Brand */}
        <Link to="/" className="flex items-center gap-2 select-none">
          <motion.img
            src={logo}
            alt="LawBridge Logo"
            className="h-9 w-9 drop-shadow-md"
            whileHover={{ rotate: 10, scale: 1.05 }}
            transition={{ type: "spring", stiffness: 200 }}
          />
          <span className="text-blue-700 font-bold text-xl tracking-wide">
            LawBridge
          </span>
        </Link>

        {/* Hamburger Button */}
        <button
          onClick={() => setOpen(!open)}
          className="p-2 text-blue-700 hover:text-blue-800 transition"
          aria-label="Toggle Menu"
        >
          {open ? <X size={26} /> : <Menu size={26} />}
        </button>
      </div>

      {/* === Mobile Drawer Menu === */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute top-full left-0 w-full bg-white/95 backdrop-blur-2xl border-t border-blue-100 shadow-lg rounded-b-3xl overflow-hidden"
            initial={{ opacity: 0, y: -15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            <div className="flex flex-col px-5 py-6 space-y-3">
              {navLinks.map((link) => (
                <NavLink
                  key={link.name}
                  to={link.to}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-xl text-slate-700 font-medium tracking-wide
                    ${
                      isActive
                        ? "bg-gradient-to-r from-sky-100 to-blue-100 border border-blue-200 text-blue-700"
                        : "hover:bg-sky-50 hover:text-blue-700"
                    } transition-all duration-200`
                  }
                >
                  <span className="text-blue-600">{link.icon}</span>
                  <span>{link.name}</span>
                </NavLink>
              ))}

              {/* === Portal / Login Button === */}
              <Link
                to="/portal/login"
                onClick={() => setOpen(false)}
                className="flex items-center justify-center gap-2 py-3 rounded-full
                  bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 text-white font-semibold
                  shadow-md shadow-blue-300/30 hover:scale-105 transition-all duration-300"
              >
                <LogIn size={18} />
                <span>Portal Login</span>
              </Link>
            </div>

            {/* Animated Glow Line */}
            <motion.div
              className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 3, repeat: Infinity }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
};

export default MobileNavBar;
