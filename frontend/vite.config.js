import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import styledJsx from 'styled-jsx/babel';
import path from 'path';

// ✅ Add a clear Content-Security-Policy header to allow WebSocket + API access
const cspPolicy = `
  default-src 'self';
  connect-src 'self' ws://localhost:5000 http://localhost:5000;
  img-src 'self' blob: data:;
  style-src 'self' 'unsafe-inline';
  script-src 'self' 'unsafe-eval' 'unsafe-inline';
`.replace(/\s+/g, ' ');

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [styledJsx],
      },
    }),
  ],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },

  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.error('✖ Vite proxy error:', err);
          });
        },
      },
    },

    // ✅ Add the headers here
    headers: {
      'Content-Security-Policy': cspPolicy,
    },
  },
});
