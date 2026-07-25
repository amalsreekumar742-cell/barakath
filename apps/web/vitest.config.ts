import { defineConfig } from 'vitest/config';
import path from 'node:path';

/**
 * Vitest config for the customer website — currently exercises `src/lib/commerce/*`'s pure money
 * math (see totals.test.ts). `environment: 'node'` (not jsdom) because these are plain-function tests
 * with no DOM; a future component test can override per-file with a `@vitest-environment jsdom`
 * pragma rather than paying jsdom's startup cost on every run.
 *
 * WHY a manual `@` alias instead of a tsconfig-paths plugin: the only alias this app declares is
 * `@/* -> ./src/*` (see tsconfig.json) — one line here is simpler than adding a new dependency for it.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
