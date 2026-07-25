import { test, expect, type Page } from '@playwright/test';
import { login, hasCreds } from './helpers/auth';

/**
 * Per-feature functional E2E for every admin feature. Complements functional.spec.ts (which covers the
 * fetch sweep + coupon lazy-load/create). Here we verify, feature by feature:
 *   • CREATE FORMS render and BLOCK invalid submits — WITHOUT writing to production. This is the safe,
 *     universal proof that each "add" flow is wired (validation fires, disabled buttons stay disabled,
 *     the notification "send" path stops at its confirm gate and is cancelled — never sent).
 *   • SAFE REAL WRITE — a spinner campaign is actually created (doc-only, no image/product/push) and its
 *     configure page opens; it is cleaned up afterwards by the cleanup helper (name prefix "E2E Spin").
 *   • DETAIL NAVIGATION — clicking a list row/card opens the detail/edit page and it loads cleanly.
 *   • REPORTS dialogs + SETTINGS tabs render and operate.
 *
 * SAFETY: we deliberately never complete a submit that would send an FCM/broadcast, write affiliate/
 * financial data, mutate live product prices (flash sale), upload an image, or reset a real password.
 */
test.describe('Admin features — per-feature E2E', () => {
  test.skip(!hasCreds(), 'Set E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD in apps/admin/.env.e2e');

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  async function waitSettled(page: Page) {
    await expect(page.locator('.react-loading-skeleton')).toHaveCount(0, { timeout: 20_000 });
  }

  // =============================================================================================
  // CREATE FORMS — render + block invalid submit (NO production writes)
  // =============================================================================================
  test.describe('create forms render + reject invalid submit (no writes)', () => {
    test('categories: add form renders; empty submit is blocked', async ({ page }) => {
      await page.goto('/categories/add');
      await expect(page.getByPlaceholder(/e\.g\. Perfumes/i)).toBeVisible();
      await page.getByRole('button', { name: 'Save category' }).click();
      await expect(page).toHaveURL(/\/categories\/add$/); // did NOT navigate to the list
    });

    test('products: add form renders; empty submit is blocked', async ({ page }) => {
      await page.goto('/products/add');
      await expect(page.getByPlaceholder(/Amber Oud/i)).toBeVisible();
      await page.getByRole('button', { name: 'Save product' }).click();
      await expect(page).toHaveURL(/\/products\/add$/);
    });

    test('coupons: create form renders; empty submit is blocked', async ({ page }) => {
      await page.goto('/coupons/create');
      await expect(page.getByPlaceholder('e.g. WELCOME20')).toBeVisible();
      await page.getByRole('button', { name: 'Create coupon' }).click();
      await expect(page).toHaveURL(/\/coupons\/create$/);
    });

    test('banners: add form renders; empty submit is blocked (image required)', async ({ page }) => {
      await page.goto('/banners/add');
      await expect(page.getByPlaceholder(/The Eid Edit/i)).toBeVisible();
      await page.getByRole('button', { name: 'Save banner' }).click();
      await expect(page).toHaveURL(/\/banners\/add$/);
    });

    test('flash sale: create form renders; empty submit is blocked', async ({ page }) => {
      await page.goto('/flash-sale/create');
      await expect(page.getByPlaceholder(/Eid Flash/i)).toBeVisible();
      await page.getByRole('button', { name: 'Create flash sale' }).click();
      await expect(page).toHaveURL(/\/flash-sale\/create$/);
    });

    test('new arrivals: add form renders; submit disabled with nothing selected', async ({ page }) => {
      await page.goto('/new-arrivals/add');
      await waitSettled(page);
      // The submit is disabled until at least one product is checked.
      await expect(page.getByRole('button', { name: /Add products/i })).toBeDisabled();
    });

    test('affiliate: allocate form renders; Allocate disabled until a customer is chosen', async ({ page }) => {
      await page.goto('/affiliate/allocate');
      await expect(page.getByPlaceholder(/name, phone or email/i)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Allocate' })).toBeDisabled();
    });

    test('sub admin: create form renders; empty submit is blocked', async ({ page }) => {
      await page.goto('/sub-admin/create');
      await expect(page.getByPlaceholder(/Fatima N/i)).toBeVisible();
      await page.getByRole('button', { name: 'Create admin' }).click();
      await expect(page).toHaveURL(/\/sub-admin\/create$/);
    });

    test('inventory: adjust-stock page renders its reason field', async ({ page }) => {
      await page.goto('/inventory/adjust');
      await waitSettled(page);
      await expect(page.getByPlaceholder(/Restock from supplier/i)).toBeVisible();
    });

    // Notifications is FCM-critical: we fill the form and click Send, but STOP at the confirm dialog
    // and Cancel — so a real notification is NEVER written or sent.
    test('notifications: create validates and reaches the Send confirm gate WITHOUT sending', async ({ page }) => {
      await page.goto('/notifications/create');
      await page.getByPlaceholder(/Eid sale is live/i).fill('E2E test — do not send');
      await page.getByPlaceholder(/signature oud/i).fill('E2E functional test message. Not sent.');
      await page.getByRole('button', { name: 'Send / schedule' }).click();

      // The confirm dialog appears — this is the gate BEFORE any write. Cancel it (scope to the dialog:
      // the create page's sticky bar also has a "Cancel" button).
      const dialog = page.getByRole('dialog');
      await expect(dialog.getByText(/Send notification now\?/i)).toBeVisible();
      await dialog.getByRole('button', { name: 'Cancel' }).click();
      await expect(page.getByText(/Send notification now\?/i)).toBeHidden();
      await expect(page).toHaveURL(/\/notifications\/create$/); // nothing sent, nothing navigated
    });
  });

  // =============================================================================================
  // SAFE REAL WRITE — create a spinner campaign (doc only) and land on its configure page
  // =============================================================================================
  test('spinner campaigns: "Create & configure" writes a campaign and opens it', async ({ page }) => {
    const name = `E2E Spin ${Date.now()}`;
    await page.goto('/spinner-campaigns/create');
    await page.getByPlaceholder(/Eid Mega Spin/i).fill(name);
    await page.getByRole('button', { name: 'Create & configure' }).click();

    // Success navigates from /spinner-campaigns/create to /spinner-campaigns/{id}.
    await page.waitForURL(
      (url) => /\/spinner-campaigns\/[^/]+$/.test(url.pathname) && !url.pathname.endsWith('/create'),
      { timeout: 15_000 },
    );
    await waitSettled(page);
    await expect(page.getByRole('button', { name: /^retry$/i })).toHaveCount(0);
  });

  // =============================================================================================
  // DETAIL NAVIGATION — clicking a list item opens its detail/edit page (skips when empty)
  // =============================================================================================
  test('categories: clicking a row opens the sub-categories page', async ({ page }) => {
    await page.goto('/categories');
    await waitSettled(page);
    const rows = page.locator('table tbody tr');
    const n = await rows.count();
    test.skip(n === 0, 'No categories to open');
    await rows.first().locator('td').first().click();
    await expect(page).toHaveURL(/\/categories\/[^/]+$/);
    await expect(page).not.toHaveURL(/\/categories\/add$/);
    await waitSettled(page);
    await expect(page.getByRole('button', { name: /^retry$/i })).toHaveCount(0);
  });

  test('products: clicking a row opens the edit page', async ({ page }) => {
    await page.goto('/products');
    await waitSettled(page);
    const rows = page.locator('table tbody tr');
    const n = await rows.count();
    test.skip(n === 0, 'No products to open');
    await rows.first().locator('td').first().click();
    await expect(page).toHaveURL(/\/products\/[^/]+\/edit$/);
    await waitSettled(page);
    await expect(page.getByRole('button', { name: /^retry$/i })).toHaveCount(0);
  });

  test('banners: clicking a card opens the edit page', async ({ page }) => {
    await page.goto('/banners');
    await waitSettled(page);
    const cards = page.locator('.grid [role="button"]');
    const n = await cards.count();
    test.skip(n === 0, 'No banners to open');
    // Click the top-left (image area) to avoid the top-right delete ✕.
    await cards.first().click({ position: { x: 12, y: 12 } });
    await expect(page).toHaveURL(/\/banners\/[^/]+\/edit$/);
    await waitSettled(page);
    await expect(page.getByRole('button', { name: /^retry$/i })).toHaveCount(0);
  });

  // =============================================================================================
  // REPORTS — KPIs render, Export + Date-range dialogs open (no export performed)
  // =============================================================================================
  test('reports: overview renders and the Export/Date-range dialogs open', async ({ page }) => {
    await page.goto('/reports');
    await expect(page.getByRole('heading', { level: 1, name: /Reports & Analytics/i })).toBeVisible();
    await waitSettled(page);

    await page.getByRole('button', { name: 'Export Excel' }).click();
    await expect(page.getByText('Export to Excel')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText('Export to Excel')).toBeHidden();

    await page.getByRole('button', { name: 'Date range' }).click();
    await expect(page.getByText('Select date range')).toBeVisible();
    await page.getByRole('button', { name: 'This year' }).click();
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect(page.getByText('Select date range')).toBeHidden();
  });

  // =============================================================================================
  // SETTINGS — every tab renders and switches (no save)
  // =============================================================================================
  test('settings: all tabs render and switch cleanly', async ({ page }) => {
    await page.goto('/settings');
    await waitSettled(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();

    for (const tab of ['Delivery & Tax', 'Payment Gateway', 'Privacy Policy', 'Terms & Conditions', 'Help & Support', 'Variables']) {
      await page.getByRole('button', { name: tab, exact: true }).click();
      await expect(page).toHaveURL(/\/settings$/);
      await expect(page.getByRole('button', { name: /^retry$/i })).toHaveCount(0);
    }
  });
});
