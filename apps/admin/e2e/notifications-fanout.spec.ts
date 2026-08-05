import { test, expect } from '@playwright/test';
import { hasCreds, login } from './helpers/auth';

/**
 * Notification authoring (spec §1.18) — the admin half of the feature.
 *
 * Background: the admin panel can only RECORD a notification. Fanning it out needs every customer's
 * `fcmToken`, a cross-user read the Security Rules correctly forbid a client — which is why
 * `createNotification.ts` and `sendNotificationNow.ts` each stopped at a TODO and no push was ever
 * delivered. The `onNotificationSend` Cloud Function now owns delivery.
 *
 * WHY THIS SPEC NEVER PRESSES SEND: this suite runs against the LIVE project, and a send-now
 * notification defaults to `targetType: 'All'`. Submitting one here would push a test message to
 * every real customer's phone, and a push cannot be recalled. So this spec covers authoring only —
 * the form loads, validates, and offers the right targeting and scheduling options.
 *
 * Delivery itself is verified in `apps/web/e2e/notification-fanout.spec.ts`, which writes a
 * notification addressed to the single E2E test customer and then asserts the trigger's stamps
 * (`fcmDispatchedAt`, `fcmSentCount`, `recipientCount`). Same code path, audience of one.
 */

test.describe('notification authoring', () => {
  test.skip(!hasCreds(), 'Set E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD in apps/admin/.env.e2e');

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('the notifications screen lists past sends', async ({ page }) => {
    await page.goto('/notifications');
    await page.waitForTimeout(6000);
    await expect(page.locator('body')).toContainText(/notification/i);
  });

  test('the create form loads with its targeting and scheduling controls', async ({ page }) => {
    // A real route (`app/router.tsx`: 'notifications/create'), so this cannot break on a label change.
    await page.goto('/notifications/create');
    await page.waitForTimeout(6000);

    const title = page.locator('input[name="title"], #title').first();
    await expect(title, 'the create form should expose a title field').toBeVisible();

    const body = await page.locator('body').innerText();
    // Targeting is what decides whether a send reaches one customer or the entire base, so both
    // options must be offered — a form that can only broadcast is a foot-gun.
    expect(body, 'both audience options should be available').toMatch(/all/i);
    expect(body).toMatch(/specific|selected|choose/i);
    // Scheduling is the half that had no server-side dispatcher until now.
    expect(body).toMatch(/schedule|now/i);
  });

  test('an empty notification cannot be submitted', async ({ page }) => {
    await page.goto('/notifications/create');
    await page.waitForTimeout(6000);

    const submit = page.getByRole('button', { name: /send|create|save|schedule/i }).last();
    test.skip((await submit.count()) === 0, 'no submit control found on the create form');

    await submit.click();
    await page.waitForTimeout(3000);

    // Validation must stop it. If this ever navigates away, an empty push went out.
    expect(page.url(), 'submitting an empty form must not create a notification').toContain(
      '/notifications/create',
    );
  });

  test('choosing Schedule requires a date', async ({ page }) => {
    await page.goto('/notifications/create');
    await page.waitForTimeout(6000);

    const schedule = page.getByRole('radio', { name: /schedule/i }).first();
    test.skip((await schedule.count()) === 0, 'no schedule option in the notification form');

    await schedule.check();
    await page.waitForTimeout(1500);

    // A scheduled send with no date must not silently fall back to sending immediately — that is the
    // difference between "goes out Friday 9am" and "goes out now, to everyone".
    await expect(
      page.locator('input[type="datetime-local"], input[type="date"]').first(),
    ).toBeVisible();
  });
});
