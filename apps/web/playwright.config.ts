import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { loadE2EEnv, BASE_URL } from './e2e/fixtures/env';

/**
 * Playwright E2E config for the Barakath storefront (apps/web).
 *
 * Two projects, deliberately: the storefront has a desktop layout and a genuinely different mobile
 * one (the app-parity shell — bottom tab bar, sticky CTAs, bottom sheets), and a regression in one
 * is invisible from the other. Every spec runs in both unless it opts out.
 *
 * `webServer` attaches to an already-running `next dev` when there is one. That matters more here
 * than in the admin suite: a `next build` that runs while `next dev` holds `.next` corrupts the
 * directory, so the suite must never start a competing server behind the developer's back.
 */
loadE2EEnv(__dirname);

export default defineConfig({
  testDir: path.join(__dirname, 'e2e'),
  // Storefront pages hold live Firestore listeners open and the dev server compiles on demand, so
  // generous timeouts here are about the environment, not about slow assertions.
  timeout: 120_000,
  expect: { timeout: 20_000 },
  // Serial: the signed-in specs mutate ONE shared test customer (wallet balance, orders). Running
  // them in parallel would have two specs fighting over the same balance.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],

  use: {
    baseURL: BASE_URL(),
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // The catalogue is served from Firestore; a cold page can take several seconds.
    actionTimeout: 30_000,
    navigationTimeout: 90_000,
  },

  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: BASE_URL(),
    reuseExistingServer: true,
    timeout: 180_000,
    cwd: __dirname,
  },
});
