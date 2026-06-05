import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// __dirname is not available in ESM; derive it from import.meta.url so it
// always points to the web/ directory whether running locally or on Vercel.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => ({
  base: mode === 'capacitor' ? './' : '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // manifest.json lives in web/public/ — we manage it manually.
      manifest: false,
      // Include icon assets in the precache manifest.
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'logo.png', 'logo_no_bg.png'],
      workbox: {
        // Pre-cache everything Vite emits: JS chunks, CSS, HTML, fonts, images.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // SPA fallback — serve index.html for any unmatched navigation.
        navigateFallback: 'index.html',
        // Never intercept API calls with the service worker.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Google Fonts stylesheet + font files — cache for a year.
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  root: __dirname,
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../src'),
    },
  },
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
}));
