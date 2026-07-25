import { test, expect } from '@playwright/test';
import { login, hasCreds } from './helpers/auth';

/**
 * Authenticated walkthrough — signs in with the env credentials, then visits each built feature page and
 * asserts its heading rendered. The whole suite SKIPS (not fails) when credentials aren't configured, so
 * `pnpm test:e2e` still runs the login-page suite for anyone without a test account.
 *
 * Add credentials in apps/admin/.env.e2e:
 *   E2E_ADMIN_EMAIL=you@barakath.com
 *   E2E_ADMIN_PASSWORD=•••
 */
test.describe('Admin panel (signed in)', () => {
  test.skip(!hasCreds(), 'Set E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD in apps/admin/.env.e2e');

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('lands on the dashboard after sign in', async ({ page }) => {
    await expect(page).not.toHaveURL(/\/login/);
    // The sidebar shell is present once inside the app.
    await expect(page.getByText('Dashboard', { exact: false }).first()).toBeVisible();
  });

  // Each built feature page + the heading text we expect (null = just assert an <h1> rendered).
  const routes: { path: string; heading: RegExp | null }[] = [
    { path: '/sub-admin', heading: /sub admin/i },
    { path: '/reports', heading: /reports & analytics/i },
    { path: '/notifications', heading: null },
    { path: '/banners', heading: /banner/i },
    { path: '/flash-sale', heading: /flash sale/i },
    { path: '/new-arrivals', heading: /new arrivals/i },
    { path: '/affiliate', heading: /affiliate program/i },
    { path: '/coupons', heading: null },
    { path: '/customers', heading: null },
    { path: '/orders', heading: null },
  ];

  for (const r of routes) {
    test(`opens ${r.path}`, async ({ page }) => {
      await page.goto(r.path);
      await expect(page).toHaveURL(new RegExp(`${r.path}$`));
      const h1 = page.getByRole('heading', { level: 1 });
      await expect(h1.first()).toBeVisible();
      if (r.heading) {
        await expect(h1.filter({ hasText: r.heading }).first()).toBeVisible();
      }
    });
  }
});
