import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// The app installs on the show laptop and keeps working with no internet:
// everything it needs, including the current single-file Neon Loop under /legacy/, is cached.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'icons/apple-touch-icon.png', 'fonts/*.woff'],
      manifest: {
        name: 'Neon Loop',
        short_name: 'Neon Loop',
        description: 'Run-of-show, live graphics and pledging for fundraising events.',
        theme_color: '#100e18',
        background_color: '#100e18',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff,png,jpg,svg}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/legacy\//]
      }
    })
  ],
  test: { globals: true, environment: 'node', include: ['src/**/*.test.ts'] }
});
