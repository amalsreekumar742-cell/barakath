import 'server-only';

import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';

/**
 * serverFirestore — the Firestore handle used by Server Components to read the PUBLIC catalog.
 *
 * WHY the Web SDK on the server instead of firebase-admin: `firestore.rules` grants
 * `allow read: if true` on categories, sub-categories, products, variants, banners, reviews and
 * `general/config`. The catalog is genuinely public, so the same public config the browser uses is
 * enough to render it on the server — full SEO with no service-account JSON to generate, commit-guard
 * or rotate, and no privileged credential in the App Hosting environment at all.
 *
 * WHY that is a feature, not a shortcut: this client can only ever read what a signed-out visitor
 * could. "Never fetch user-specific data in a Server Component" stops being a rule someone has to
 * remember and becomes structurally impossible — an order or wallet query here simply returns
 * permission-denied. If a future screen genuinely needs privileged server reads, add firebase-admin
 * as a SEPARATE module rather than widening this one.
 *
 * WHY `import 'server-only'`: it makes the boundary a build error. A `"use client"` file that
 * imports this (directly or transitively) fails the build with a clear message instead of silently
 * shipping a second Firestore connection into the browser bundle.
 *
 * WHY a separate init from `lib/firebaseConfig.ts`: that module also constructs Auth, Storage and
 * Functions, which have no meaning on the server and drag their bundles into the server build. This
 * one initialises the app and Firestore, nothing else.
 */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** Named so it can never collide with the browser app instance during SSR. */
const SERVER_APP_NAME = 'barakath-server';

function serverApp() {
  const existing = getApps().find((a) => a.name === SERVER_APP_NAME);
  return existing ?? initializeApp(firebaseConfig, SERVER_APP_NAME);
}

export const serverDb: Firestore = getFirestore(serverApp());

/**
 * THE CATALOG ISR WINDOW IS 300 SECONDS.
 *
 * WHY 300 rather than `force-dynamic`: catalog content changes when an admin edits it — minutes to
 * hours apart, not per request. Five minutes keeps pages fast and Firestore reads flat under traffic
 * while still picking up an admin's change without a deploy.
 *
 * WHY it is NOT exported as a constant for the route segments to import: Next.js statically analyses
 * `export const revalidate` at build time and rejects anything that is not a literal —
 * "Unknown identifier … at revalidate". So each segment writes `export const revalidate = 300;`
 * itself. If this number changes, grep `revalidate = 300` and change them together; this comment is
 * the single place the reasoning lives.
 */
