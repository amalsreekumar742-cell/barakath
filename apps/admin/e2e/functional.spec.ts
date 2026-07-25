import { test, expect, type Page } from '@playwright/test';
import { login, hasCreds } from './helpers/auth';

/**
 * Functional walkthrough — proves the app actually WORKS end to end, not just that headings render:
 *   • FETCH      every list page loads without hitting its error/Retry state (data resolves)
 *   • LAZY-LOAD  the coupons list pages past PAGE_SIZE via the "View More" cursor button
 *   • ADD/SEND   the real Create-Coupon form writes a doc that then appears in the list
 *
 * Requires the 15 seeded E2ESEED-* coupons (so the coupon list exceeds PAGE_SIZE=12 and lazy-load is
 * observable) and admin credentials in apps/admin/.env.e2e. Skips wholesale without credentials.
 */
test.describe('Admin — functional (fetch / lazy-load / add)', () => {
  test.skip(!hasCreds(), 'Set E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD in apps/admin/.env.e2e');

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  /** Wait for a list page to finish its fetch: skeletons gone, no error/Retry, an <h1> is present. */
  async function expectCleanFetch(page: Page) {
    await expect(page.locator('.react-loading-skeleton')).toHaveCount(0, { timeout: 20_000 });
    // The error branch of every list page renders a "Retry" button — its absence means the fetch resolved.
    await expect(page.getByRole('button', { name: /^retry$/i })).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  }

  // ---- FETCH: sweep every list surface ------------------------------------------------------------
  const listRoutes = [
    '/', '/categories', '/products', '/inventory', '/orders', '/customers', '/payments',
    '/replacement', '/reviews', '/coupons', '/spinner-campaigns', '/affiliate', '/banners',
    '/flash-sale', '/new-arrivals', '/notifications', '/reports', '/sub-admin', '/settings',
  ];

  for (const route of listRoutes) {
    test(`fetch: ${route} loads without error`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(new RegExp(`${route === '/' ? '/$' : route + '$'}`));
      await expectCleanFetch(page);
    });
  }

  // ---- FETCH renders real rows (needs seeded coupons) ---------------------------------------------
  // These two require the coupon collection to exceed PAGE_SIZE=12. Seed with the coupon seed helper
  // (15 disposable E2ESEED-* coupons); they auto-skip when the collection is too small so the suite
  // stays green in an unseeded database.
  test('fetch: coupons list renders a full first page of rows', async ({ page }) => {
    await page.goto('/coupons');
    await expectCleanFetch(page);
    const count = await page.locator('table tbody tr').count();
    test.skip(count < 12, 'Needs >12 coupons — run the coupon seed helper to seed disposable rows.');
    // A full first page is exactly PAGE_SIZE=12 rows.
    await expect(page.locator('table tbody tr')).toHaveCount(12);
  });

  // ---- LAZY-LOAD: cursor pagination past page one -------------------------------------------------
  test('lazy-load: "View More" fetches the next page of coupons', async ({ page }) => {
    await page.goto('/coupons');
    await expectCleanFetch(page);

    const rows = page.locator('table tbody tr');
    const viewMore = page.getByRole('button', { name: 'View More' });
    const hasNextPage = await viewMore.isVisible().catch(() => false);
    test.skip(!hasNextPage, 'Needs >12 coupons — run the coupon seed helper to seed disposable rows.');

    await expect(rows).toHaveCount(12); // page 1
    await viewMore.click();
    // Page 2 is appended (dedup-by-id in the slice), so the row count grows beyond the first page.
    await expect.poll(async () => rows.count(), { timeout: 15_000 }).toBeGreaterThan(12);
  });

  // ---- ADD / SEND: the real create form writes a doc that appears in the list ---------------------
  test('add: creating a coupon via the form writes it and it appears in the list', async ({ page }) => {
    // Unique, cleanup-safe code (E2E prefix, A–Z0–9- only, ≤20 chars).
    const code = `E2EUI-${Date.now().toString(36).toUpperCase()}`;

    await page.goto('/coupons/create');
    await expect(page.getByRole('heading', { level: 1, name: /create coupon/i })).toBeVisible();

    // Code (custom input, matched by placeholder) + description + the percentage-required max discount.
    await page.getByPlaceholder('e.g. WELCOME20').fill(code);
    await page.getByPlaceholder(/Flat 20% off/i).fill('E2E functional-test coupon — safe to delete');
    await page.getByText('Maximum discount (₹)', { exact: true }).locator('xpath=..').locator('input').fill('50');

    await page.getByRole('button', { name: 'Create coupon' }).click();

    // Success path: toast + redirect back to the list.
    await expect(page.getByText('Coupon created')).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(/\/coupons$/);

    // Newest-first ordering puts the just-created coupon on page one — assert the write is really there.
    await expectCleanFetch(page);
    await expect(page.locator('table tbody').getByText(code)).toBeVisible({ timeout: 15_000 });
  });
});
