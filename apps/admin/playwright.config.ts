import { defineConfig, devices } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// This config is ESM ("type": "module"), so derive the dir from import.meta.url (no __dirname here).
const rootDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Load apps/admin/.env.e2e (if present) into process.env — a tiny KEY=VALUE parser so we don't need a
 * dotenv dependency. This is where the test admin credentials live (E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD).
 * The file is git-ignored / never committed; only .env.e2e.example is checked in.
 */
const envPath = path.resolve(rootDir, '.env.e2e');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

const PORT = 5173;
const BASE_URL = `http://localhost:${PORT}`;

/**
 * Playwright E2E config for the Barakath admin panel.
 *
 * - `webServer` boots the Vite dev server (pnpm dev) and waits for it; `reuseExistingServer` means if you
 *   already have `pnpm dev` running, Playwright attaches to it instead of starting a second one.
 * - Trace + screenshot + video are captured so a failure is fully replayable in the HTML report / UI mode.
 * - Run live: `pnpm test:e2e:ui` (interactive) or `pnpm test:e2e:headed` (watch the real browser).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'on',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'corepack pnpm dev',
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
