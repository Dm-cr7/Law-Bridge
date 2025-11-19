/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class", // Enables .dark class toggle
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}", // ✅ Scan all React files
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        serif: ["Roboto Serif", "serif"],
      },

      colors: {
        primary: {
          DEFAULT: "#0a66c2",
          dark: "#084b8a",
          light: "#60a5fa",
        },
        accent: {
          DEFAULT: "#22c55e",
          dark: "#16a34a",
        },
        danger: {
          DEFAULT: "#ef4444",
          dark: "#dc2626",
        },
        warning: {
          DEFAULT: "#f59e0b",
          dark: "#d97706",
        },
        background: {
          light: "#f9fafb",
          dark: "#111827",
        },
        surface: {
          light: "#ffffff",
          dark: "#1f2937",
        },
        muted: {
          light: "#6b7280",
          dark: "#9ca3af",
        },
      },

      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
      },

      boxShadow: {
        soft: "0 4px 10px rgba(0,0,0,0.08)",
        card: "0 8px 20px rgba(0,0,0,0.05)",
        glow: "0 0 12px rgba(10,102,194,0.3)",
      },

      transitionTimingFunction: {
        smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
      },

      keyframes: {
        fadeIn: {
          "0%": { opacity: 0, transform: "translateY(6px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
        scaleIn: {
          "0%": { opacity: 0, transform: "scale(0.95)" },
          "100%": { opacity: 1, transform: "scale(1)" },
        },
        pulseGlow: {
          "0%, 100%": { opacity: 1, boxShadow: "0 0 0 rgba(10,102,194,0)" },
          "50%": { opacity: 0.9, boxShadow: "0 0 20px rgba(10,102,194,0.4)" },
        },
      },

      animation: {
        fadeIn: "fadeIn 0.4s ease-in-out both",
        scaleIn: "scaleIn 0.35s ease-in-out both",
        pulseGlow: "pulseGlow 2s ease-in-out infinite",
      },

      container: {
        center: true,
        padding: {
          DEFAULT: "1rem",
          sm: "1.5rem",
          lg: "2rem",
          xl: "2.5rem",
        },
      },
    },
  },
  plugins: [
    require("@tailwindcss/forms"), // ✅ Modern form inputs
    require("@tailwindcss/typography"), // ✅ For legal documents
    require("@tailwindcss/aspect-ratio"), // ✅ For media evidence previews
  ],
};
