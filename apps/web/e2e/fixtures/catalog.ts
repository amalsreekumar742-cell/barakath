import type { Page } from '@playwright/test';
import { BASE_URL } from './env';

/**
 * Catalogue discovery.
 *
 * WHY nothing here is hard-coded: these specs run against the real project, whose catalogue changes.
 * A spec pinned to a product id passes until someone archives that product and then fails for a
 * reason that has nothing to do with the code under test. Every spec therefore asks the running site
 * what it is currently selling and drives whatever it finds.
 */

export interface DiscoveredProduct {
  href: string;
  id: string;
}

/** The first product the storefront links to from a listing — i.e. one that is Active and visible. */
export async function discoverProduct(page: Page): Promise<DiscoveredProduct> {
  await page.goto(BASE_URL() + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  let href = await firstProductHref(page);
  if (!href) {
    // The home page can legitimately be quiet (no flash sale, no new arrivals). The categories
    // page is the exhaustive route into the catalogue, so fall back there rather than failing.
    await page.goto(BASE_URL() + '/categories', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    const cat = await page.locator('a[href^="/category/"]').first().getAttribute('href');
    if (cat) {
      await page.goto(BASE_URL() + cat, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(5000);
      href = await firstProductHref(page);
    }
  }

  if (!href) throw new Error('No product could be discovered from home or any category listing');
  return { href, id: href.split('/').pop()! };
}

async function firstProductHref(page: Page): Promise<string | null> {
  const links = page.locator('a[href^="/product/"]');
  if ((await links.count()) === 0) return null;
  return links.first().getAttribute('href');
}

/**
 * Add the currently-open product to the bag, choosing the first in-stock variant.
 * Returns false when the product cannot be bought (every variant out of stock), so a caller can
 * skip rather than assert against a product the storefront is right to refuse.
 */
export async function addOpenProductToBag(page: Page): Promise<boolean> {
  const cta = page.locator('button:has-text("Add to bag"):visible').first();
  if ((await cta.count()) === 0) return false;
  if (await cta.isDisabled()) return false;

  await cta.click();
  await page.waitForTimeout(3000);
  return true;
}

/** The bag count shown on the mobile tab bar / desktop header badge. */
export async function bagCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Primary"]');
    const badge = nav?.querySelector('a[href="/cart"] span span');
    if (badge) return Number((badge.textContent || '0').trim()) || 0;
    // Desktop: the header cart button carries its own badge.
    const header = document.querySelector('header');
    const link = header?.querySelector('a[href="/cart"]');
    const n = link?.querySelector('span');
    return Number((n?.textContent || '0').trim()) || 0;
  });
}
