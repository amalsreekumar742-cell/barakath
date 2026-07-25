import { defineConfig, configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

// Vite config for the Barakath admin SPA.
// WHY @tailwindcss/vite: Tailwind v4 is CSS-first (no tailwind.config.js) — the Vite plugin is the
//   supported way to wire Tailwind into a Vite build, replacing the old PostCSS setup.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
  },
  // Vitest config (per the skill's per-feature test rule): jsdom for component/slice tests, globals
  // so describe/it/expect need no import, and a setup file that wires jest-dom matchers.
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/testing/setup.ts'],
    css: false,
    // Keep Vitest (unit/component) and Playwright (e2e) apart: e2e specs are driven by playwright.config.ts.
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
});
