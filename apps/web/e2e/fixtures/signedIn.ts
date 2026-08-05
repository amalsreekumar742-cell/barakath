import { test as base, type Page, expect } from '@playwright/test';
import { BASE_URL, firebaseWebConfig, hasAdminCredentials, NO_CREDS_REASON } from './env';
import { ensureTestCustomer, mintCustomToken, type TestCustomer } from './testCustomer';

/**
 * Signing the browser in as the test customer.
 *
 * WHY it drives the real Firebase SDK instead of forging a cookie: `middleware.ts` only checks that
 * `barakath_session` is PRESENT, so a fake cookie would get past the route guard — and then every
 * Firestore read on the page would fail, because Security Rules check the real Firebase identity, not
 * the cookie. A test that got past the front door and then silently rendered empty screens would be
 * worse than no test. So this establishes a genuine session, exactly the way `useAuthFlow.ts` does:
 *
 *     signInWithCustomToken(auth, token) -> getIdToken() -> POST /api/session
 *
 * The only substitution is where the custom token comes from: production gets it from `verifyOTP`
 * after an MSG91 SMS; the suite mints the identical artefact with the Admin SDK, because a test
 * runner cannot receive a text message.
 *
 * WHY the SDK is imported from gstatic inside the page rather than reaching into the app's bundle:
 * the storefront never exposes its `auth` instance on `window` (it should not), and reaching into
 * webpack internals would break on any build change. A second SDK instance of the SAME major version
 * shares the same IndexedDB store (`firebaseLocalStorageDb`, key `firebase:authUser:{apiKey}:[DEFAULT]`),
 * so after the reload below the application's own instance picks the session up as its own. Pin the
 * version to the app's `firebase` dependency — a major-version drift here would mean two different
 * persistence formats and a fixture that signs in to nothing.
 */
const FIREBASE_CDN_VERSION = '11.1.0';

export async function signInAs(page: Page, customToken: string): Promise<void> {
  // IndexedDB is origin-scoped, so the sign-in must happen ON the app's origin.
  await page.goto(BASE_URL() + '/', { waitUntil: 'domcontentloaded' });

  const result = await page.evaluate(
    async ({ token, config, version }) => {
      const { initializeApp, getApps } = await import(
        /* webpackIgnore: true */ `https://www.gstatic.com/firebasejs/${version}/firebase-app.js`
      );
      const { getAuth, signInWithCustomToken } = await import(
        /* webpackIgnore: true */ `https://www.gstatic.com/firebasejs/${version}/firebase-auth.js`
      );

      // Reuse the default app if this CDN instance already made one (a retry within the same page).
      const app = getApps().length ? getApps()[0] : initializeApp(config);
      const auth = getAuth(app);
      const cred = await signInWithCustomToken(auth, token);
      const idToken = await cred.user.getIdToken();

      // The same POST the real login page makes — the cookie the Edge middleware reads.
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });

      return { uid: cred.user.uid, sessionOk: res.ok };
    },
    { token: customToken, config: firebaseWebConfig(), version: FIREBASE_CDN_VERSION },
  );

  expect(result.sessionOk, 'POST /api/session should succeed').toBe(true);

  // Reload so the application's own SDK instance reads the persisted session and the AuthListener
  // reports a signed-in customer.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
}

/** Assert the app itself considers the session live, not just that a cookie exists. */
export async function expectSignedIn(page: Page): Promise<void> {
  await page.goto(BASE_URL() + '/account', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  expect(page.url(), 'a signed-in customer must not be bounced to /login').not.toContain('/login');
}

interface Fixtures {
  /** The provisioned test customer. Requesting it skips the spec when no credential is configured. */
  customer: TestCustomer;
  /** A page already signed in as that customer. */
  authedPage: Page;
}

export const test = base.extend<Fixtures>({
  customer: async ({}, use, testInfo) => {
    testInfo.skip(!hasAdminCredentials(), NO_CREDS_REASON);
    const c = await ensureTestCustomer();
    await use(c);
  },

  authedPage: async ({ page, customer }, use) => {
    const token = await mintCustomToken(customer.uid);
    await signInAs(page, token);
    await use(page);
  },
});

export { expect } from '@playwright/test';
