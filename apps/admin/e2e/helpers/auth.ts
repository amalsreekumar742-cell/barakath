import { expect, type Page } from '@playwright/test';

/** True when real E2E admin credentials are configured (not the placeholder) in apps/admin/.env.e2e. */
export function hasCreds(): boolean {
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  return !!(email && password && !email.includes('REPLACE') && !password.includes('REPLACE'));
}

/**
 * login — sign in through the real login form with the env credentials and wait until we've left the
 * login screen (the protected shell has rendered). Throws if credentials are not configured.
 */
export async function login(page: Page): Promise<void> {
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  if (!email || !password) throw new Error('E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD are not set');

  await page.goto('/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();

  // On success the app redirects to '/', replacing the login route.
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Admin panel' })).toBeHidden();
}
