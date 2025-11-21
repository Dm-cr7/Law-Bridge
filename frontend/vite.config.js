// frontend/vite.config.js
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import styledJsx from "styled-jsx/babel";
import path from "path";

export default ({ mode }) => {
  // Load environment variables from .env, .env.local, etc.
  const env = loadEnv(mode, process.cwd(), "");

  // canonical env names (Vite client vars must start with VITE_)
  // VITE_API_URL (e.g. http://localhost:5000/api or https://law-bridge-sq66.onrender.com/api)
  // BACKEND_PUBLIC_URL (optional, used to include backend host in CSP)
  // FRONTEND_PUBLIC_URL (optional, used to include frontend host in CSP)
  const viteApiUrl = env.VITE_API_URL || "http://localhost:5000/api";
  const backendPublic = env.BACKEND_PUBLIC_URL || env.API_PUBLIC_URL || "http://localhost:5000";
  const frontendPublic = env.FRONTEND_PUBLIC_URL || "http://localhost:5173";

  // Build a dev CSP that mirrors what we'll use in production
  const cspPolicy = [
    "default-src 'self'",
    // allow XHR / fetch / websocket to the backend and remote https
    `connect-src 'self' https: wss: ${backendPublic} ${frontendPublic}`,
    "img-src 'self' data: blob: https:",
    "style-src 'self' 'unsafe-inline' https:",
    "font-src 'self' data: https:",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' https:",
    "frame-src 'self' https:",
    "object-src 'none'",
  ].join("; ");

  return defineConfig({
    plugins: [
      react({
        babel: {
          plugins: [styledJsx],
        },
      }),
    ],

    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },

    server: {
      proxy: {
        "/api": {
          target: "http://localhost:5000",
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            proxy.on("error", (err) => {
              console.error("✖ Vite proxy error:", err);
            });
          },
        },
      },

      // Add headers in dev server responses so local dev respects CSP
      headers: {
        "Content-Security-Policy": cspPolicy,
      },
    },

    // Expose any needed defines or build options here if required
    define: {
      __BUILD_BACKEND__: JSON.stringify(backendPublic),
      __BUILD_FRONTEND__: JSON.stringify(frontendPublic),
      __BUILD_API_URL__: JSON.stringify(viteApiUrl),
    },
  });
};
