import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

/**
 * Environment loading for the storefront E2E suite.
 *
 * Mirrors the tiny KEY=VALUE parser in `apps/admin/playwright.config.ts` rather than adding a
 * `dotenv` dependency — the two suites should not disagree about how a `.env.e2e` is read, and this
 * file is the shared implementation so they cannot drift.
 */

/** Load `apps/web/.env.e2e` and `apps/web/.env` into process.env without overwriting real env vars. */
export function loadE2EEnv(webRoot: string): void {
  // `.env` supplies the public Firebase config (the same values the browser bundle gets); `.env.e2e`
  // supplies test-only credentials. `.env.e2e` is loaded FIRST so it wins on any overlapping key.
  for (const file of ['.env.e2e', '.env']) {
    const p = path.resolve(webRoot, file);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq === -1) continue;
      const key = t.slice(0, eq).trim();
      let val = t.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  }
}

export const BASE_URL = () => process.env.E2E_BASE_URL || 'http://localhost:3000';

/** The public web config, needed by the browser-side sign-in helper. */
export function firebaseWebConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  };
}

/**
 * Where the Admin-SDK service account lives, if the operator has provided one.
 *
 * WHY signed-in tests need it and guest tests do not: signing a customer in means minting a Firebase
 * CUSTOM TOKEN, which only the Admin SDK can do — the storefront's real login path gets one from the
 * `verifyOTP` Cloud Function after an MSG91 SMS, and an SMS cannot be received by a test runner.
 * The service account is also what lets a test SET UP its own preconditions (a customer with a known
 * wallet balance, an order in a known state) instead of hoping production data happens to be right.
 *
 * Nothing here is committed: the path points outside the repo and the file is listed in .gitignore.
 */
export function serviceAccountPath(): string | null {
  const explicit = process.env.E2E_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (explicit && existsSync(explicit)) return explicit;
  return null;
}

export const hasAdminCredentials = () => serviceAccountPath() !== null;

/** Reason string shown on skipped specs, so a skip never looks like a silent pass. */
export const NO_CREDS_REASON =
  'No Admin SDK service account configured — set E2E_SERVICE_ACCOUNT in apps/web/.env.e2e. ' +
  'See apps/web/e2e/README.md for how to generate one. Signed-in flows cannot run without it ' +
  'because signing a customer in requires minting a Firebase custom token.';
