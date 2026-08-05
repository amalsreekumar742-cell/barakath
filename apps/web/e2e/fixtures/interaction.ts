import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Click helpers that tolerate late hydration.
 *
 * WHY these exist: the storefront's pages are Server Components with small client islands, and in
 * `next dev` a route is compiled on first request. Under suite load the HTML (including the button)
 * can be on screen for several seconds before React has attached its handlers — so a click lands on
 * a button that is visible, enabled, and completely inert. It is swallowed silently.
 *
 * That produced exactly one flaky failure while building this suite: the guest add-to-bag gate,
 * which works reliably at every fixed delay when the server is idle and intermittently does nothing
 * when it is not. Raising the sleep would only move the threshold; retrying the click removes it.
 *
 * These are a DEV-SERVER accommodation, not a workaround for a product bug. If a click needs many
 * attempts against a production build, that is a real finding — hence `attempts` is small and the
 * failure message says what actually happened.
 */

interface RetryOptions {
  attempts?: number;
  gapMs?: number;
}

/** Click until the URL matches, re-clicking if the first attempt was swallowed pre-hydration. */
export async function clickUntilUrl(
  page: Page,
  locator: Locator,
  pattern: RegExp,
  { attempts = 4, gapMs = 6000 }: RetryOptions = {},
): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    await locator.click();
    try {
      await page.waitForURL(pattern, { timeout: gapMs });
      return;
    } catch {
      if (page.url().match(pattern)) return;
    }
  }
  throw new Error(
    `Clicked ${attempts}x over ${(attempts * gapMs) / 1000}s but the URL never matched ${pattern}. ` +
      `Still at ${page.url()}. If the server was idle, this is a real navigation bug, not flake.`,
  );
}

/** Click until a target locator becomes visible (bottom sheets, dialogs, drawers). */
export async function clickUntilVisible(
  page: Page,
  trigger: Locator,
  target: Locator,
  { attempts = 4, gapMs = 4000 }: RetryOptions = {},
): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    await trigger.click();
    try {
      await expect(target).toBeVisible({ timeout: gapMs });
      return;
    } catch {
      // fall through and click again
    }
  }
  throw new Error(
    `Clicked ${attempts}x but the expected element never appeared. ` +
      `If the server was idle, this is a real interaction bug, not flake.`,
  );
}
