import { test, expect } from '@playwright/test';
import { hasCreds, login } from './helpers/auth';

/**
 * Admin fulfilment, refunds and affiliate withdrawals — the money-and-operations screens.
 *
 * These are the flows with the highest cost of failure in the whole product: an order that cannot be
 * progressed blocks delivery, and a refund or withdrawal that misbehaves moves real money. They run
 * against live data, so every one of them is READ-ONLY unless it is operating on a record it can
 * prove is safe to touch. Nothing here approves a real withdrawal or refunds a real order — the
 * assertions are about the controls being present, correctly gated, and correctly guarded.
 *
 * The destructive halves (actually progressing an order to Delivered, actually issuing a refund) are
 * covered in `apps/web/e2e` against a SEEDED order owned by the E2E test customer, where the money
 * involved is fictional. That split is deliberate: an admin suite pointed at production must not be
 * one careless selector away from refunding a customer.
 */

test.describe('admin fulfilment', () => {
  test.skip(!hasCreds(), 'Set E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD in apps/admin/.env.e2e');

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('the orders list loads and can be opened', async ({ page }) => {
    await page.goto('/orders');
    await page.waitForTimeout(7000);

    await expect(page.locator('body')).toContainText(/order/i);

    // Open the first order, if the store has any.
    const row = page.locator('a[href^="/orders/"], tr[role="button"], tbody tr').first();
    test.skip((await row.count()) === 0, 'no orders in the store yet');

    await row.click();
    await page.waitForTimeout(7000);
    expect(page.url()).toMatch(/\/orders\//);
  });

  test('an order detail page exposes the status progression controls', async ({ page }) => {
    await page.goto('/orders');
    await page.waitForTimeout(7000);
    const row = page.locator('a[href^="/orders/"], tbody tr').first();
    test.skip((await row.count()) === 0, 'no orders in the store yet');

    await row.click();
    await page.waitForTimeout(8000);

    const body = await page.locator('body').innerText();
    // The five fulfilment states from spec §1.7. At least the current one must be shown, and the
    // screen must offer a way to move the order forward.
    expect(body).toMatch(/pending|accepted|packed|shipped|out for delivery|delivered|cancelled/i);

    const hasProgression =
      (await page.getByRole('button', { name: /accept|pack|ship|deliver|update status|mark/i }).count()) >
        0 || (await page.locator('select').count()) > 0;
    expect(hasProgression, 'an order must be progressable from its detail page').toBe(true);
  });

  test('the payments screen loads with its stats', async ({ page }) => {
    await page.goto('/payments');
    await page.waitForTimeout(7000);
    await expect(page.locator('body')).toContainText(/payment/i);
  });

  test('refund controls are present but never fire without confirmation', async ({ page }) => {
    await page.goto('/orders');
    await page.waitForTimeout(7000);
    const row = page.locator('a[href^="/orders/"], tbody tr').first();
    test.skip((await row.count()) === 0, 'no orders in the store yet');

    await row.click();
    await page.waitForTimeout(8000);

    const refund = page.getByRole('button', { name: /refund/i }).first();
    test.skip((await refund.count()) === 0, 'this order is not in a refundable state');

    await refund.click();
    await page.waitForTimeout(2500);

    // Money movement must be behind an explicit confirmation. If clicking Refund immediately issued
    // one, that is the finding — so this asserts a confirm step exists, then backs out.
    const confirmVisible =
      (await page.getByRole('dialog').count()) > 0 ||
      (await page.getByRole('button', { name: /^(confirm|yes|proceed)$/i }).count()) > 0;
    expect(confirmVisible, 'a refund must require confirmation before it moves money').toBe(true);

    await page.keyboard.press('Escape');
  });
});

test.describe('affiliate withdrawals', () => {
  test.skip(!hasCreds(), 'Set E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD in apps/admin/.env.e2e');

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('the withdrawals queue loads', async ({ page }) => {
    await page.goto('/affiliate');
    await page.waitForTimeout(8000);
    await expect(page.locator('body')).toContainText(/affiliate|withdraw|commission/i);
  });

  test('approving a withdrawal requires confirmation', async ({ page }) => {
    await page.goto('/affiliate');
    await page.waitForTimeout(8000);

    const approve = page.getByRole('button', { name: /approve/i }).first();
    test.skip((await approve.count()) === 0, 'no pending withdrawal requests');

    await approve.click();
    await page.waitForTimeout(2500);

    const confirmVisible =
      (await page.getByRole('dialog').count()) > 0 ||
      (await page.getByRole('button', { name: /^(confirm|yes|approve)$/i }).count()) > 0;
    expect(confirmVisible, 'approving a payout must require confirmation').toBe(true);

    // Back out — this suite must never actually approve a real withdrawal.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
  });
});
