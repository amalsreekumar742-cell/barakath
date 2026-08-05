import { test, expect } from '@playwright/test';
import { discoverProduct } from './fixtures/catalog';
import { clickUntilUrl } from './fixtures/interaction';

/**
 * Guest browsing — everything a visitor can do without an account (spec §3.3: guests browse the
 * whole catalogue). These need no credentials and are the suite's baseline: if they fail, nothing
 * else is worth diagnosing.
 */

test.describe('guest browsing', () => {
  test('home page renders catalogue content', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);

    await expect(page.locator('main')).toBeVisible();
    // A storefront home page with no product links at all is broken, however it got that way.
    expect(await page.locator('a[href^="/product/"]').count()).toBeGreaterThan(0);
  });

  test('categories page lists categories that open a listing', async ({ page }) => {
    await page.goto('/categories', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);

    const links = page.locator('a[href^="/category/"]');
    expect(await links.count()).toBeGreaterThan(0);

    await links.first().click();
    await page.waitForURL('**/category/**');
    await page.waitForTimeout(5000);
    await expect(page.locator('main')).toBeVisible();
  });

  test('product detail shows a price and an add-to-bag control', async ({ page }) => {
    const product = await discoverProduct(page);
    await page.goto(product.href, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(6000);

    await expect(page.locator('h1')).toBeVisible();
    const text = await page.locator('main').innerText();
    expect(text, 'PDP must show a rupee price').toMatch(/₹/);
    expect(await page.locator('button:has-text("Add to bag")').count()).toBeGreaterThan(0);
  });

  test('search returns results or an explicit empty state', async ({ page }) => {
    await page.goto('/search', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // The desktop header field is present-but-hidden on mobile and vice versa; drive whichever the
    // current viewport actually shows.
    const input = page.locator('input:visible').first();
    await input.click();
    await input.fill('oud');
    await page.keyboard.press('Enter');
    await page.waitForURL(/\/search\?/);
    await page.waitForTimeout(5000);

    const results = await page.locator('a[href^="/product/"]').count();
    const body = await page.locator('body').innerText();
    expect(
      results > 0 || /no results|nothing|didn't match/i.test(body),
      'search must either show results or say it found none',
    ).toBe(true);
  });

  test('a guest is redirected to login from protected routes', async ({ page }) => {
    for (const route of ['/account', '/account/wallet', '/account/orders', '/checkout']) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2500);
      expect(page.url(), `${route} must gate a guest`).toContain('/login');
      expect(page.url(), `${route} must preserve the return path`).toContain('next=');
    }
  });

  test('guest add-to-bag is gated, and returns the visitor to the product', async ({ page }) => {
    const product = await discoverProduct(page);
    await page.goto(product.href, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(6000);

    const cta = page.locator('button:has-text("Add to bag"):visible').first();
    test.skip((await cta.count()) === 0, 'product has no purchasable variant');

    // Retried, because in `next dev` the button can be painted several seconds before React attaches
    // its handler — see fixtures/interaction.ts. The gate itself is not flaky; the dev server is.
    await clickUntilUrl(page, cta, /\/login/);
    expect(decodeURIComponent(page.url())).toContain('next=/product/');
  });

  test('unknown routes render a real 404, not a crash', async ({ page }) => {
    const res = await page.goto('/no-such-page-e2e', { waitUntil: 'domcontentloaded' });
    expect(res?.status()).toBe(404);
    await expect(page.locator('body')).toContainText(/not found/i);
  });
});
