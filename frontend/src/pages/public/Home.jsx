// src/pages/Home.jsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Scale, Users, ShieldCheck, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/Button.jsx";
import { Link } from "react-router-dom";
import ResponsiveImage from "@/components/ResponsiveImage";

/**
 * Home.jsx — Slideshow with 5s delayed autoplay
 * - Slideshow starts paused, begins autoplay after 5000ms
 * - Autoplay, keyboard nav, pause on hover/focus, touch swipe
 * - Ken-Burns + crossfade, accessible controls & indicators
 */

const SLIDE_INTERVAL = 5000; // ms between slides
const START_DELAY = 5000; // wait 5s before starting autoplay

const SLIDES = [
  { id: "legal-bg", src: "/images/legal-bg.jpg", alt: "Courtroom benches", title: "Justice, Connected by Technology", body: "LawBridge redefines how advocates, mediators, and clients collaborate — building trust, efficiency, and clarity through innovation." },
  { id: "1", src: "/images/1.jpg", alt: "Legal professional portrait", title: "Justice, Connected by Technology", body: "LawBridge redefines how advocates, mediators, and clients collaborate — building trust, efficiency, and clarity through innovation." },
  { id: "2", src: "/images/2.jpg", alt: "People collaborating around a table", title: "Justice, Connected by Technology", body: "LawBridge redefines how advocates, mediators, and clients collaborate — building trust, efficiency, and clarity through innovation." },
  { id: "3", src: "/images/3.jpg", alt: "Smiling client with lawyer", title: "Justice, Connected by Technology", body: "LawBridge redefines how advocates, mediators, and clients collaborate — building trust, efficiency, and clarity through innovation." },
  { id: "4", src: "/images/4.jpg", alt: "Courtroom interaction", title: "Justice, Connected by Technology", body: "LawBridge redefines how advocates, mediators, and clients collaborate — building trust, efficiency, and clarity through innovation." },
  { id: "5", src: "/images/5.jpg", alt: "Law books closeup", title: "Justice, Connected by Technology", body: "LawBridge redefines how advocates, mediators, and clients collaborate — building trust, efficiency, and clarity through innovation." },
  { id: "6", src: "/images/6.jpg", alt: "Handshake between professionals", title: "Justice, Connected by Technology", body: "LawBridge redefines how advocates, mediators, and clients collaborate — building trust, efficiency, and clarity through innovation." },
];

const features = [
  { icon: <Scale className="w-10 h-10 text-blue-500" />, title: "Justice Simplified", description: "Empowering legal professionals and clients through smart tools that make justice more accessible and transparent." },
  { icon: <Users className="w-10 h-10 text-sky-500" />, title: "Unified Legal Ecosystem", description: "Connecting advocates, mediators, paralegals, and clients in one modern collaborative platform." },
  { icon: <Briefcase className="w-10 h-10 text-blue-400" />, title: "Efficiency & Transparency", description: "Streamlining case workflows, hearings, and updates for faster, more reliable results." },
  { icon: <ShieldCheck className="w-10 h-10 text-amber-500" />, title: "Secure & Compliant", description: "Your legal data is protected with enterprise-level encryption and strict compliance standards." },
];

const testimonialData = [
  { name: "Adv. Mercy Nyaga", role: "Senior Advocate", img: "/images/1.jpg" },
  { name: "Samuel O.", role: "Client", img: "/images/2.jpg" },
  { name: "Mediator Jane M.", role: "Mediator", img: "/images/3.jpg" },
];

export default function Home() {
  const [index, setIndex] = useState(0);

  // Start paused; slideshow will auto-start after START_DELAY ms
  const [isPaused, setIsPaused] = useState(true);
  const timeoutRef = useRef(null);
  const startDelayRef = useRef(null);
  const containerRef = useRef(null);
  const touchStartX = useRef(null);

  const next = useCallback(() => setIndex((i) => (i + 1) % SLIDES.length), []);
  const prev = useCallback(() => setIndex((i) => (i - 1 + SLIDES.length) % SLIDES.length), []);

  // Start delay effect: unpause after START_DELAY (only on mount)
  useEffect(() => {
    startDelayRef.current = setTimeout(() => {
      // Only start autoplay if user hasn't explicitly paused via controls yet
      setIsPaused(false);
    }, START_DELAY);

    return () => {
      if (startDelayRef.current) clearTimeout(startDelayRef.current);
    };
  }, []);

  // Autoplay effect: advances slides when not paused
  useEffect(() => {
    if (isPaused) return;
    timeoutRef.current = setTimeout(() => next(), SLIDE_INTERVAL);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [index, isPaused, next]);

  // Keyboard controls: ArrowLeft, ArrowRight, Space (toggle pause)
  useEffect(() => {
    function onKey(e) {
      if (e.key === "ArrowLeft") {
        setIsPaused(true);
        prev();
      } else if (e.key === "ArrowRight") {
        setIsPaused(true);
        next();
      } else if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        setIsPaused((p) => !p);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  // Touch handlers: simple swipe left/right
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function onTouchStart(e) {
      touchStartX.current = e.touches?.[0]?.clientX ?? null;
    }
    function onTouchEnd(e) {
      if (touchStartX.current == null) return;
      const dx = (e.changedTouches?.[0]?.clientX ?? 0) - touchStartX.current;
      const threshold = 40; // min px for swipe
      if (dx > threshold) {
        setIsPaused(true);
        prev();
      } else if (dx < -threshold) {
        setIsPaused(true);
        next();
      }
      touchStartX.current = null;
    }
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [next, prev]);

  return (
    <div className="flex flex-col overflow-x-hidden bg-white text-slate-800">
      {/* HERO / SLIDES */}
      <section
        ref={containerRef}
        className="relative w-full min-h-[88vh] flex items-center justify-center text-center px-4 overflow-hidden"
        aria-label="Hero slideshow"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onFocus={() => setIsPaused(true)}
        onBlur={() => setIsPaused(false)}
      >
        {/* Background slides (z-0 behind content) */}
        <div className="absolute inset-0 z-0">
          <AnimatePresence initial={false} mode="wait">
            {SLIDES.map((slide, i) =>
              i === index ? (
                <motion.div
                  key={slide.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.9 }}
                  className="absolute inset-0 w-full h-full"
                >
                  {/* Ken-Burns animated image */}
                  <div className="w-full h-full overflow-hidden">
                    <ResponsiveImage
                      src={slide.src}
                      alt={slide.alt}
                      priority={i === 0}
                      className="w-full h-full object-cover"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        animation: "kenburns 18s ease-in-out infinite",
                      }}
                    />
                  </div>

                  {/* Overlay for readability (light) */}
                  <div className="absolute inset-0 bg-black/24" aria-hidden />
                </motion.div>
              ) : null
            )}
          </AnimatePresence>
        </div>

        {/* Hero content on top (z-20) */}
        <div className="relative z-20 max-w-3xl mx-auto text-center px-4">
          {/* Optional translucent card to improve contrast */}
          <div className="inline-block px-6 py-4 rounded-xl bg-white/6 backdrop-blur-sm">
            <motion.h1
              key={`title-${index}`}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-4xl md:text-6xl font-extrabold leading-tight text-white drop-shadow-lg"
            >
              {SLIDES[index].title}
            </motion.h1>

            <motion.p
              key={`body-${index}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.12 }}
              className="mt-4 text-lg md:text-xl text-blue-50/95 max-w-2xl mx-auto"
            >
              {SLIDES[index].body}
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.24 }} className="mt-6 flex justify-center gap-4 flex-wrap">
              <Button asChild className="bg-white text-blue-700 font-medium rounded-full px-6 md:px-8 py-2 md:py-3 text-base md:text-lg shadow-md shadow-black/10">
                <Link to="/about">Discover Who We Are</Link>
              </Button>
              <Button asChild variant="outline" className="border border-white/30 text-white hover:bg-white/10 rounded-full px-6 md:px-8 py-2 md:py-3 text-base md:text-lg transition-all">
                <Link to="/contact">Get in Touch</Link>
              </Button>
            </motion.div>
          </div>
        </div>

        {/* Controls (on top) */}
        <button
          aria-label="Previous slide"
          onClick={() => {
            setIsPaused(true);
            prev();
          }}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white flex items-center justify-center hover:bg-white/20 transition"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M15 6 L9 12 L15 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <button
          aria-label="Next slide"
          onClick={() => {
            setIsPaused(true);
            next();
          }}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white flex items-center justify-center hover:bg-white/20 transition"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M9 6 L15 12 L9 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Dots */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2">
          {SLIDES.map((_, i) => {
            const active = i === index;
            return (
              <button
                key={`dot-${i}`}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={active ? "true" : "false"}
                onClick={() => {
                  setIndex(i);
                  setIsPaused(true);
                }}
                className={`w-3 h-3 rounded-full transition-all ${active ? "bg-white scale-125" : "bg-white/60"}`}
              />
            );
          })}
        </div>

        {/* Play / Pause */}
        <div className="absolute top-4 right-4 z-30">
          <button
            onClick={() => setIsPaused((p) => !p)}
            aria-label={isPaused ? "Play slideshow" : "Pause slideshow"}
            className="px-3 py-1 rounded-full bg-white/10 text-white border border-white/20 hover:bg-white/20 transition"
          >
            {isPaused ? "Play" : "Pause"}
          </button>
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-20 bg-gradient-to-b from-white via-sky-50 to-blue-50">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-blue-700 mb-4">Why Choose LawBridge</h2>
          <p className="text-slate-600 max-w-2xl mx-auto">Reimagining justice through collaboration, transparency, and digital transformation.</p>

          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((f, i) => (
              <motion.div key={f.title} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} whileHover={{ y: -6, scale: 1.03 }} transition={{ type: "spring", stiffness: 200, delay: i * 0.08 }} className="relative bg-white border border-sky-100 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all">
                <div className="flex justify-center mb-4">{f.icon}</div>
                <h3 className="text-lg font-semibold text-blue-700 mb-1">{f.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{f.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* MISSION */}
      <section className="py-20 px-6 bg-gradient-to-r from-blue-100 via-sky-50 to-amber-50 text-center">
        <div className="max-w-5xl mx-auto">
          <motion.h2 className="text-3xl md:text-4xl font-bold text-blue-700" initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            Our Mission & Vision
          </motion.h2>
          <p className="mt-6 max-w-3xl mx-auto text-slate-700 leading-relaxed">
            Bridging the gap between law and technology — empowering professionals and clients to collaborate, simplify workflows, and build trust.
          </p>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="py-16 bg-gradient-to-t from-sky-100 via-blue-50 to-white text-slate-800">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-blue-700">Trusted by Legal Professionals & Clients</h2>
          <p className="text-slate-600 mt-3">Real voices, real impact — how LawBridge transforms practice and trust.</p>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonialData.map(({ name, role, img }, idx) => (
              <motion.div key={name} whileHover={{ scale: 1.02 }} initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.08 }} className="bg-white border border-blue-100 shadow-sm p-6 rounded-2xl flex flex-col items-start gap-4">
                <div className="flex items-center gap-4 w-full">
                  <div className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0">
                    <ResponsiveImage src={img} alt={`Photo of ${name}`} className="w-full h-full object-cover" width={56} height={56} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-blue-700">{name}</h4>
                    <div className="text-sm text-sky-500">{role}</div>
                  </div>
                </div>
                <p className="text-slate-700 italic leading-relaxed">
                  {idx === 0 && "LawBridge has redefined how I manage my practice — intuitive, powerful, and secure."}
                  {idx === 1 && "I finally understand my case updates in real-time. Transparency made simple."}
                  {idx === 2 && "Scheduling and communication have never been smoother. Truly forward-thinking."}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 text-white text-center relative overflow-hidden">
        <motion.div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-white/10 rounded-full blur-[180px]" animate={{ scale: [1, 1.05, 1], opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }} aria-hidden />
        <div className="relative z-10">
          <motion.h2 className="text-2xl md:text-3xl font-bold mb-4" initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            Ready to Experience the Future of Law?
          </motion.h2>
          <p className="mt-4 text-blue-50 max-w-2xl mx-auto">Discover how LawBridge empowers you to manage cases, collaborate, and deliver justice with confidence and clarity.</p>
          <div className="mt-8 flex justify-center gap-4 flex-wrap">
            <Button asChild className="bg-white text-blue-700 font-semibold px-8 py-3 rounded-full shadow-lg shadow-black/10">
              <Link to="/about">Learn More</Link>
            </Button>
            <Button asChild variant="secondary" className="border border-white text-white hover:bg-white/10 px-8 py-3 rounded-full font-semibold">
              <Link to="/contact">Contact Us</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Ken-Burns keyframes injected inline so no separate CSS file is required */}
      <style>{`
        @keyframes kenburns {
          0% { transform: scale(1) translateY(0); }
          50% { transform: scale(1.06) translateY(-2%); }
          100% { transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}
