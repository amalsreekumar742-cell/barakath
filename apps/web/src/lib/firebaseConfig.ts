import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';
import { CloudFunctions } from '@/config/cloudFunctions';

/**
 * firebaseConfig — the ONE configured Firebase client for the customer website.
 * WHY centralize: every feature imports `db`/`auth`/`storage`/`functions` from here so the SDK is
 *   initialized exactly once.
 * WHY NEXT_PUBLIC_* env vars: the Firebase web config is genuinely public (it ships to the browser),
 *   but must not be hardcoded — reading from `process.env.NEXT_PUBLIC_*` keeps values out of source and
 *   lets each environment supply its own. Server-only secrets never live here.
 * WHY getApps() guard: Next.js can evaluate this module on both server and client and across HMR;
 *   reusing the existing app avoids double-initialization errors.
 */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
/**
 * REGION-PINNED, and it is not optional.
 *
 * Every Barakath callable is deployed to `asia-south1` (functions/src/index.ts pins it globally so the
 * onDocument* triggers sit in the same region as the Firestore database). `getFunctions(app)` with no
 * region resolves to `us-central1`, where nothing is deployed — verified live:
 *   POST https://asia-south1-…/verifyOTP -> 400 FAILED_PRECONDITION  (the function ran)
 *   POST https://us-central1-…/verifyOTP -> 404 Page not found       (no such function)
 * Login is the first thing that would have hit this: `authOTP` would 404 and the OTP screen would
 * report "internal error" with nothing in the function logs, because the request never arrived.
 */
export const functions = getFunctions(app, CloudFunctions.region);

export default app;
