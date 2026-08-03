#!/usr/bin/env node
/**
 * backfill-category-product-counts.js — one-off, idempotent, re-runnable.
 *
 * Recomputes `categories/{id}.productCount` from the products collection.
 *
 * WHY it is needed: `createCategory` seeds the field at 0 and the trigger that maintains it
 * (`functions/src/triggers/onProductCategoryCount.ts`) only reacts to product writes that happen while
 * it is deployed. Every product that already existed at deploy time is invisible to it, so those counts
 * stay at 0 and the app's Categories grid reads "0 products" under tiles that have stock behind them.
 *
 * WHY it SETS an absolute value rather than incrementing: increments are for the live trigger, where
 * concurrency matters. A backfill that increments is not re-runnable — run it twice and every count
 * doubles. Counting the collection and writing the total is safe to run as many times as you like.
 *
 * Counting rule — mirrors the trigger exactly (change both together):
 *   status === 'Active'  AND  categoryId === <category id>
 * Archived products are excluded because the catalogue never shows them, so counting them would
 * promise the shopper products they cannot open.
 *
 * WHY the client SDK and not firebase-admin: this machine has no Application Default Credentials and no
 * gcloud. `categories` is admin-writable per firebase/firestore.rules, so signing in as the super admin
 * from apps/admin/.env.e2e gets the same access without a service-account key on disk.
 *
 * Usage (from the repo root):
 *   node scripts/backfill-category-product-counts.js --dry-run
 *   node scripts/backfill-category-product-counts.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ADMIN_DIR = path.join(ROOT, 'apps', 'admin');
const DRY_RUN = process.argv.includes('--dry-run');

/** Minimal .env reader — no dotenv dependency in scripts/. */
function readEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

const env = { ...readEnv(path.join(ADMIN_DIR, '.env')), ...readEnv(path.join(ADMIN_DIR, '.env.e2e')) };

const required = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'E2E_ADMIN_EMAIL',
  'E2E_ADMIN_PASSWORD',
];
const missing = required.filter((key) => !env[key]);
if (missing.length > 0) {
  console.error(`Missing from apps/admin/.env and .env.e2e: ${missing.join(', ')}`);
  process.exit(1);
}

// Node resolves from the SCRIPT's directory, and scripts/ has no node_modules of its own — so borrow
// the firebase package already installed for the admin app.
const fromAdmin = (id) => require(require.resolve(id, { paths: [ADMIN_DIR] }));

const { initializeApp } = fromAdmin('firebase/app');
const { getAuth, signInWithEmailAndPassword } = fromAdmin('firebase/auth');
const {
  getFirestore,
  collection,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp,
} = fromAdmin('firebase/firestore');

async function main() {
  const app = initializeApp({
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  });

  await signInWithEmailAndPassword(getAuth(app), env.E2E_ADMIN_EMAIL, env.E2E_ADMIN_PASSWORD);
  const db = getFirestore(app);
  console.log(`${DRY_RUN ? '[DRY RUN] ' : ''}project ${env.VITE_FIREBASE_PROJECT_ID}\n`);

  // One read of every product, tallied in memory. The alternative — a count() query per category —
  // is one round trip per category and cannot report the orphans below.
  const products = await getDocs(collection(db, 'products'));

  const tally = new Map();
  let archived = 0;
  let uncategorised = 0;
  for (const snap of products.docs) {
    const data = snap.data();
    if (String(data.status ?? '') !== 'Active') {
      archived++;
      continue;
    }
    const categoryId = String(data.categoryId ?? '').trim();
    if (categoryId === '') {
      uncategorised++;
      continue;
    }
    tally.set(categoryId, (tally.get(categoryId) ?? 0) + 1);
  }

  const categories = await getDocs(collection(db, 'categories'));
  console.log(
    `${products.size} products (${archived} archived, ${uncategorised} with no categoryId), ` +
      `${categories.size} categories\n`,
  );

  let changed = 0;
  const seen = new Set();

  for (const snap of categories.docs) {
    seen.add(snap.id);
    const current = Number(snap.data().productCount ?? 0);
    const actual = tally.get(snap.id) ?? 0;
    const name = snap.data().name ?? '(unnamed)';

    if (current === actual) {
      console.log(`  ok      ${name} — ${actual}`);
      continue;
    }

    changed++;
    console.log(`  FIX     ${name} — ${current} → ${actual}`);
    if (DRY_RUN) continue;

    await updateDoc(doc(db, 'categories', snap.id), {
      productCount: actual,
      updatedAt: serverTimestamp(),
    });
  }

  // Products pointing at a category document that no longer exists. Nothing to write — but those
  // products are unreachable from the Categories grid, and that is worth knowing about.
  for (const [categoryId, count] of tally) {
    if (!seen.has(categoryId)) {
      console.log(`  ORPHAN  ${count} product(s) reference missing category ${categoryId}`);
    }
  }

  console.log(
    `\n${DRY_RUN ? 'would update' : 'updated'} ${changed} of ${categories.size} categories`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
