import { test, expect } from '@playwright/test';

/**
 * Login page — runs with NO credentials, so it works out of the box. Covers the sign-in screen rendering,
 * client-side validation, and a rejected sign-in staying on the login route.
 */
test.describe('Login page', () => {
  test('renders the sign-in screen', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Admin panel' })).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('shows validation errors on an empty submit', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText('Email is required')).toBeVisible();
    await expect(page.getByText('Password is required')).toBeVisible();
  });

  test('rejects wrong credentials and stays on /login', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#email').fill('nobody@example.com');
    await page.locator('#password').fill('WrongPassw0rd!');
    await page.getByRole('button', { name: /sign in/i }).click();
    // A rejected sign-in surfaces an error toast and does NOT navigate to the dashboard.
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('#email')).toBeVisible();
  });
});
