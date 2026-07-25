import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

/**
 * firebaseConfig — the ONE configured Firebase client for the admin app.
 * WHY centralize: every feature imports `db`/`auth`/`storage`/`functions` from here, so the SDK is
 *   initialized exactly once and configuration lives in a single place.
 * WHY VITE_* env vars: the Firebase web config is genuinely public (it ships to the browser), but it
 *   still must not be hardcoded — reading from `import.meta.env.VITE_*` keeps values out of source and
 *   lets each environment (dev/prod) supply its own. Server-only secrets never live here.
 * WHY getApps() guard: Vite HMR / React StrictMode can re-run this module; reusing the existing app
 *   avoids "Firebase App named '[DEFAULT]' already exists" errors.
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
// WHY the region argument: `functions/src/index.ts` deploys every callable to asia-south1 (same region
// as Firestore). getFunctions(app) with no region silently targets us-central1, where nothing is
// deployed — the same bug apps/web already hit and documented in its own firebaseConfig.
export const functions = getFunctions(app, 'asia-south1');

export default app;
