/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// The Android app (Capacitor) ships all files inside the APK, so the service worker is not needed there.
const isAndroid = process.env.BUILD_TARGET === 'android';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      disable: isAndroid,
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Tennis Vision Coach',
        short_name: 'TV Coach',
        description: 'Интерактивный 3D-тренажёр игровых ситуаций в теннисе',
        lang: 'ru',
        theme_color: '#0d1420',
        background_color: '#0d1420',
        display: 'standalone',
        orientation: 'any',
        start_url: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Lessons work offline after the first visit: app shell + scenarios are precached.
        globPatterns: ['**/*.{js,css,html,svg,png,json,woff2}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          r3f: ['@react-three/fiber', '@react-three/drei'],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
