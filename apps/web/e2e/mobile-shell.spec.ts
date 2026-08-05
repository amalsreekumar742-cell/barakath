import { test, expect } from '@playwright/test';
import { discoverProduct } from './fixtures/catalog';
import { clickUntilVisible } from './fixtures/interaction';

/**
 * The mobile app-parity shell (bottom tab bar, sticky CTAs, full-bleed PDP gallery).
 *
 * These lock in the layout invariants that are easy to break and invisible from a desktop browser:
 * chrome that is supposed to be mobile-only, and the two pieces of fixed bottom furniture never
 * covering the content they sit over. The sticky-CTA reserve has already been wrong twice (the tab
 * bar's 1px border, then the CTA's 54px wishlist square), each time hiding the last row of a page.
 */

test.describe('mobile shell', () => {
  test.skip(({ isMobile }) => !isMobile, 'mobile-only layout');

  test('bottom tab bar has the five app tabs and hides desktop chrome', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);

    await expect(page.locator('nav[aria-label="Primary"]')).toBeVisible();
    expect(await page.locator('nav[aria-label="Primary"] li').count()).toBe(5);

    // Both stay in the DOM for crawlers; they must not be VISIBLE on a phone.
    const header = page.locator('header').first();
    if (await header.count()) await expect(header).toBeHidden();
    const footer = page.locator('footer').first();
    if (await footer.count()) await expect(footer).toBeHidden();
  });

  test('auth-gated tabs prompt in place instead of navigating away', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);

    for (const tab of ['Wallet', 'Profile']) {
      const before = page.url();
      // Retried for late hydration (see fixtures/interaction.ts) — the tab is a client island.
      await clickUntilVisible(
        page,
        page.locator(`nav[aria-label="Primary"] button:has-text("${tab}")`),
        page.locator('text=Login to continue'),
      );

      expect(page.url(), `${tab} must not yank a browsing guest to /login`).toBe(before);

      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);
    }
  });

  test('the tab bar is hidden on the sign-in screen', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    const nav = page.locator('nav[aria-label="Primary"]');
    if (await nav.count()) await expect(nav).toBeHidden();
  });

  test('no page scrolls horizontally', async ({ page }) => {
    for (const route of ['/', '/categories', '/search', '/cart', '/login']) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3500);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow, `${route} overflows horizontally by ${overflow}px`).toBeLessThanOrEqual(0);
    }
  });

  test('PDP gallery is full-bleed and square, with a floating back control', async ({ page }) => {
    const product = await discoverProduct(page);
    await page.goto(product.href, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(6000);

    const box = await page.evaluate(() => {
      const slide = document.querySelector('div[class*="flex-[0_0_100%]"]');
      if (!slide) return null;
      const r = slide.parentElement!.parentElement!.getBoundingClientRect();
      return { left: Math.round(r.left), width: Math.round(r.width), height: Math.round(r.height) };
    });

    expect(box, 'mobile gallery carousel should be present').not.toBeNull();
    expect(box!.left, 'gallery must start at the viewport edge').toBe(0);
    expect(box!.width).toBe(page.viewportSize()!.width);
    expect(Math.abs(box!.height - box!.width), 'gallery should be square').toBeLessThanOrEqual(2);

    await expect(page.locator('[aria-label="Go back"]').first()).toBeVisible();
  });

  test('the sticky CTA never covers the last row of content', async ({ page }) => {
    const product = await discoverProduct(page);
    await page.goto(product.href, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(6000);

    const geometry = await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
      const main = document.querySelector('main')!;
      const cta = [...document.querySelectorAll('div')]
        .filter((d) => getComputedStyle(d).position === 'fixed')
        .find((d) => /Add to bag|Go to cart|Out of stock/.test(d.textContent || ''));
      if (!cta) return null;

      // The deepest real content box. `main`'s own border-box bottom is the wrong yardstick: the
      // reserve lives in main's bottom PADDING, which is inside that box. Fixed descendants (the CTA
      // itself) are excluded or the measurement measures itself.
      let contentBottom = -1;
      for (const el of Array.from(main.querySelectorAll('*'))) {
        if (el.closest('.fixed') || getComputedStyle(el).position === 'fixed') continue;
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && r.bottom > contentBottom) contentBottom = r.bottom;
      }
      const ctaRect = cta.getBoundingClientRect();
      const nav = document.querySelector('nav[aria-label="Primary"]')!.getBoundingClientRect();
      return {
        contentBottom: Math.round(contentBottom),
        ctaTop: Math.round(ctaRect.top),
        ctaBottom: Math.round(ctaRect.bottom),
        navTop: Math.round(nav.top),
      };
    });

    test.skip(geometry === null, 'product has no sticky CTA (not purchasable)');

    expect(
      geometry!.contentBottom,
      'the last row of content is hidden under the sticky CTA',
    ).toBeLessThanOrEqual(geometry!.ctaTop + 1);

    expect(
      Math.abs(geometry!.navTop - geometry!.ctaBottom),
      'the CTA must sit flush on the tab bar, not overlap or float above it',
    ).toBeLessThanOrEqual(1);
  });
});
