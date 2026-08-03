#!/usr/bin/env node
/**
 * backfill-customer-order-totals.js — one-off, idempotent, re-runnable.
 *
 * Recomputes `users/{id}.totalOrders` and `users/{id}.totalSpent` from the orders collection.
 *
 * WHY it is needed: both fields are seeded at 0 by `functions/src/utility/verifyOTP.ts` when the
 * account is created and, until now, NOTHING ever incremented them — so the admin Customers list
 * showed "0 orders / ₹0 spent" for every customer regardless of what they had bought, and the
 * customer report's "repeat customers" (`totalOrders >= 2`) and "top customers by totalSpent" were
 * permanently empty. The live increments now live in:
 *   - functions/src/orders/createPaymentOrder.ts  (wallet-only carts — paid the instant they are written)
 *   - functions/src/orders/service/promoteDraft.ts (Razorpay — counted when the payment is confirmed)
 * Those only see orders placed AFTER they deploy. Every existing order is invisible to them, which is
 * what this script fixes.
 *
 * WHY it SETS an absolute value rather than incrementing: increments are for the live path, where
 * concurrency matters. A backfill that increments is not re-runnable — run it twice and every total
 * doubles. Reading the orders and writing the totals is safe to run as many times as you like.
 *
 * Counting rule — mirrors the live increments exactly (change all three together):
 *   count an order UNLESS it is `status === 'Cancelled' && paymentStatus === 'Paid'`.
 *
 * That single exclusion is the "late payment" order raised by promoteDraftToOrder when a capture
 * lands after the checkout expired: it is born Cancelled and owes the customer a refund, so it is
 * money to give back, not a purchase to credit them with — and the live path skips it too.
 *
 * A normal cancellation is NOT excluded: `cancelOrder` moves paymentStatus to 'Refunded', and the
 * live path never decrements, so an order the customer placed and later cancelled stays counted in
 * both. These columns are lifetime "orders placed / money put through", not current net revenue.
 *
 * WHY the client SDK and not firebase-admin: this machine has no Application Default Credentials and
 * no gcloud. `users` is admin-writable per firebase/firestore.rules, so signing in as the super admin
 * from apps/admin/.env.e2e gets the same access without a service-account key on disk.
 *
 * Usage (from the repo root):
 *   node scripts/backfill-customer-order-totals.js --dry-run
 *   node scripts/backfill-customer-order-totals.js
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
const { getFirestore, collection, getDocs, doc, updateDoc } = fromAdmin('firebase/firestore');

/** Two decimals — money summed as floats drifts (0.1 + 0.2), and this value is displayed as currency. */
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

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

  // One read of every order, tallied in memory. The alternative — an aggregate query per customer —
  // is a round trip per user and cannot report the orphans below.
  const orders = await getDocs(collection(db, 'orders'));

  const tally = new Map(); // userId -> { count, spent }
  let skippedUnpaidCancel = 0;
  let skippedNoUser = 0;

  for (const snap of orders.docs) {
    const data = snap.data();

    if (String(data.status ?? '') === 'Cancelled' && String(data.paymentStatus ?? '') === 'Paid') {
      skippedUnpaidCancel++;
      continue;
    }

    const userId = String(data.userId ?? '').trim();
    if (userId === '') {
      skippedNoUser++;
      continue;
    }

    const current = tally.get(userId) ?? { count: 0, spent: 0 };
    current.count += 1;
    current.spent += Number(data.grandTotal ?? 0) || 0;
    tally.set(userId, current);
  }

  const users = await getDocs(collection(db, 'users'));
  console.log(
    `${orders.size} orders (${skippedUnpaidCancel} cancelled-awaiting-refund, ` +
      `${skippedNoUser} with no userId), ${users.size} users\n`,
  );

  let changed = 0;
  let unchanged = 0;
  const seen = new Set();

  for (const snap of users.docs) {
    seen.add(snap.id);
    const data = snap.data();
    const wanted = tally.get(snap.id) ?? { count: 0, spent: 0 };
    const wantedSpent = round2(wanted.spent);

    const currentOrders = Number(data.totalOrders ?? 0) || 0;
    const currentSpent = Number(data.totalSpent ?? 0) || 0;

    if (currentOrders === wanted.count && round2(currentSpent) === wantedSpent) {
      unchanged++;
      continue;
    }

    console.log(
      `  ${data.fullName || snap.id}: ` +
        `orders ${currentOrders} -> ${wanted.count}, spent ${currentSpent} -> ${wantedSpent}`,
    );
    if (!DRY_RUN) {
      await updateDoc(doc(db, 'users', snap.id), {
        totalOrders: wanted.count,
        totalSpent: wantedSpent,
      });
    }
    changed++;
  }

  // An order whose userId matches no user document — a deleted account, or bad data. Reported rather
  // than silently dropped, because it means the money is counted against nobody.
  const orphans = [...tally.keys()].filter((userId) => !seen.has(userId));
  if (orphans.length > 0) {
    console.log(`\n${orphans.length} userId(s) on orders with no matching user doc:`);
    for (const userId of orphans) {
      const t = tally.get(userId);
      console.log(`  ${userId}: ${t.count} order(s), ${round2(t.spent)}`);
    }
  }

  console.log(
    `\n${DRY_RUN ? '[DRY RUN] would update' : 'updated'} ${changed} user(s), ${unchanged} already correct.`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
