import { useState, useEffect } from "react";
import { Link, NavLink } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import logo from "../../assets/logo.svg"; // ✅ ensure this file exists

const NavbarPublic = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { name: "Home", to: "/" },
    { name: "About", to: "/about" },
    { name: "Features", to: "/features" },
    { name: "Contact", to: "/contact" },
  ];

  return (
    <motion.nav
      className={`fixed w-full top-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-[#0B1120]/90 backdrop-blur-xl border-b border-sky-800/40 shadow-md"
          : "bg-gradient-to-b from-[#0B1120]/70 via-[#0E1C30]/50 to-transparent"
      }`}
      initial={{ y: -80 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
        <Link
          to="/"
          className="flex items-center gap-2 group cursor-pointer select-none"
        >
          <motion.img
            src={logo}
            alt="LawBridge Logo"
            className="h-10 w-10 drop-shadow-md"
            whileHover={{ rotate: 8, scale: 1.05 }}
            transition={{ type: "spring", stiffness: 200 }}
          />
          <span className="font-bold text-sky-200 text-2xl tracking-wide group-hover:text-sky-400 transition-colors">
            LawBridge
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <NavLink
              key={link.name}
              to={link.to}
              className={({ isActive }) =>
                `relative font-medium text-sm uppercase tracking-wide transition-all ${
                  isActive
                    ? "text-sky-400 after:content-[''] after:absolute after:w-full after:h-[2px] after:bg-sky-500 after:bottom-[-6px] after:left-0"
                    : "text-slate-300 hover:text-sky-400"
                }`
              }
            >
              {link.name}
            </NavLink>
          ))}

          {/* Portal now points to the existing /login route */}
          <NavLink
            to="/login"
            className={({ isActive }) =>
              `ml-4 px-5 py-2.5 rounded-full text-white font-semibold shadow-lg shadow-sky-500/30 
               bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-700 hover:scale-105 transition-all duration-300 ${
                 isActive ? "ring-2 ring-sky-400" : ""
               }`
            }
          >
            Portal
          </NavLink>
        </div>

        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="text-sky-300 md:hidden p-2 hover:text-white transition"
        >
          {menuOpen ? <X size={26} /> : <Menu size={26} />}
        </button>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="md:hidden bg-[#0B1120]/95 backdrop-blur-xl border-t border-sky-700/40 shadow-lg rounded-b-3xl"
          >
            <div className="flex flex-col gap-4 px-6 py-5">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  to={link.to}
                  onClick={() => setMenuOpen(false)}
                  className="text-sky-300 text-lg font-medium hover:text-white transition"
                >
                  {link.name}
                </Link>
              ))}

              {/* mobile Portal link also uses /login */}
              <Link
                to="/login"
                onClick={() => setMenuOpen(false)}
                className="bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600
                  text-white text-center py-2.5 rounded-full font-semibold shadow-md 
                  hover:scale-105 hover:shadow-sky-400/40 transition-all duration-300"
              >
                Portal
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
};

export default NavbarPublic;
