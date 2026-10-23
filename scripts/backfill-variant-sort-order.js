#!/usr/bin/env node
/**
 * backfill-variant-sort-order.js — one-off, idempotent, re-runnable.
 *
 * Gives every `products/{id}/variants/{vid}` document a `sortOrder` (0-based display position).
 *
 * WHY it is needed: `sortOrder` arrived with the admin's ▲/▼ variant reorder, so every variant written
 * before it has none. Readers cope (see `packages/shared/src/utils/sortVariants.ts`), but only by paying
 * for it: every "first variant" read is `orderBy('sortOrder')` with a `createdAt` fallback, because
 * Firestore silently EXCLUDES documents missing an orderBy field — so an un-backfilled product costs two
 * reads per card instead of one, and a product where only SOME variants have the field shows only those
 * to an ordered query. After this runs, every variant answers `orderBy('sortOrder')`.
 *
 * Assignment rule — chosen so the backfill changes NOTHING a shopper sees. Today's display order is
 * `sortVariants` over the `createdAt`-ordered list: variants with a `sortOrder` first by that value, the
 * rest after them in `createdAt` order. So:
 *   - NO variant has `sortOrder`   → sortOrder = its index in `createdAt` order (0, 1, 2 …)
 *   - SOME have it                 → the missing ones get max+1, max+2 … in `createdAt` order
 *   - ALL have it                  → skipped (this is what makes a re-run a no-op)
 * Existing values are never rewritten — they are the admin's choice.
 *
 * WHY variants are read UNORDERED and sorted here rather than `orderBy('createdAt')`: that query would
 * itself drop any variant missing `createdAt`, and the whole point is that no variant is left without a
 * `sortOrder`. The in-memory sort is `createdAt` ascending with ties (and missing values, last) broken by
 * document id — the same order Firestore's own `orderBy('createdAt')` returns.
 *
 * WHY the client SDK and not firebase-admin: this machine has no Application Default Credentials and no
 * gcloud. Variants are admin-writable per firebase/firestore.rules, so signing in as the super admin from
 * apps/admin/.env.e2e gets the same access without a service-account key on disk.
 *
 * Usage (from the repo root):
 *   node scripts/backfill-variant-sort-order.js --dry-run
 *   node scripts/backfill-variant-sort-order.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ADMIN_DIR = path.join(ROOT, 'apps', 'admin');
const DRY_RUN = process.argv.includes('--dry-run');

/** Products read per page. Bounded so a large catalogue never lands in memory as one snapshot. */
const PRODUCT_PAGE_SIZE = 200;
/** Firestore's hard cap on writes in one batch. */
const MAX_BATCH_OPS = 500;

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
  query,
  orderBy,
  startAfter,
  limit,
  documentId,
  writeBatch,
} = fromAdmin('firebase/firestore');

const hasSortOrder = (data) => typeof data.sortOrder === 'number' && Number.isFinite(data.sortOrder);

/** `createdAt` ascending; missing `createdAt` last; ties by doc id — Firestore's own ordering. */
function byCreatedAt(a, b) {
  const ta = a.data().createdAt?.toMillis?.();
  const tb = b.data().createdAt?.toMillis?.();
  if (ta !== tb) {
    if (ta === undefined) return 1;
    if (tb === undefined) return -1;
    return ta - tb;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * The `sortOrder` writes one product needs, as [{ ref, sortOrder }] — empty when every variant already
 * has one (or there are none). See the assignment rule in the header.
 */
function planProduct(variantDocs) {
  const ordered = [...variantDocs].sort(byCreatedAt);
  const unset = ordered.filter((d) => !hasSortOrder(d.data()));
  if (unset.length === 0) return { writes: [], partial: false };

  const existing = ordered.filter((d) => hasSortOrder(d.data())).map((d) => d.data().sortOrder);
  const start = existing.length === 0 ? 0 : Math.max(...existing) + 1;
  return {
    writes: unset.map((d, i) => ({ ref: d.ref, sortOrder: start + i })),
    partial: existing.length > 0,
  };
}

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

  // Writes accumulate across products and flush at the batch cap, so a catalogue of small products
  // costs a handful of commits rather than one per product.
  let batch = writeBatch(db);
  let batchOps = 0;
  let commits = 0;
  async function flush() {
    if (batchOps === 0) return;
    if (!DRY_RUN) await batch.commit();
    commits++;
    batch = writeBatch(db);
    batchOps = 0;
  }

  const stats = {
    products: 0,
    variants: 0,
    alreadyOrdered: 0,
    noVariants: 0,
    fullBackfill: 0,
    partialBackfill: 0,
    variantsWritten: 0,
    missingCreatedAt: 0,
  };

  // Paged by document id, not `createdAt`: an orderBy on a field would silently skip any product
  // missing it, and every product must be visited.
  let cursor = null;
  for (;;) {
    const page = await getDocs(
      query(
        collection(db, 'products'),
        orderBy(documentId()),
        ...(cursor ? [startAfter(cursor)] : []),
        limit(PRODUCT_PAGE_SIZE),
      ),
    );
    if (page.empty) break;

    for (const product of page.docs) {
      stats.products++;
      const name = product.data().name ?? '(unnamed)';
      const variants = await getDocs(collection(db, 'products', product.id, 'variants'));
      stats.variants += variants.size;
      stats.missingCreatedAt += variants.docs.filter((d) => !d.data().createdAt).length;

      if (variants.empty) {
        stats.noVariants++;
        continue;
      }

      const { writes, partial } = planProduct(variants.docs);
      if (writes.length === 0) {
        stats.alreadyOrdered++;
        continue;
      }

      if (partial) stats.partialBackfill++;
      else stats.fullBackfill++;
      stats.variantsWritten += writes.length;
      console.log(
        `  ${partial ? 'PARTIAL' : 'SET    '} ${name} [${product.id}] — ` +
          `${writes.length} of ${variants.size} variant(s) → sortOrder ` +
          `${writes[0].sortOrder}..${writes[writes.length - 1].sortOrder}`,
      );

      for (const { ref, sortOrder } of writes) {
        if (batchOps === MAX_BATCH_OPS) await flush();
        // Dry run never even stages the write — `flush` would not commit it, but nothing should be
        // one forgotten flag away from production.
        if (!DRY_RUN) batch.update(ref, { sortOrder });
        batchOps++;
      }
    }

    if (page.size < PRODUCT_PAGE_SIZE) break;
    cursor = page.docs[page.docs.length - 1];
  }
  await flush();

  const verb = DRY_RUN ? 'would write' : 'wrote';
  console.log(
    `\n${stats.products} products, ${stats.variants} variants scanned\n` +
      `  ${stats.alreadyOrdered} already fully ordered (skipped)\n` +
      `  ${stats.noVariants} with no variants (skipped)\n` +
      `  ${stats.fullBackfill} with no sortOrder at all (index in createdAt order)\n` +
      `  ${stats.partialBackfill} with some sortOrder (missing ones appended after the max)\n` +
      // Informational: such a variant is invisible to every reader's `orderBy('createdAt')` list query.
      `  ${stats.missingCreatedAt} variant(s) missing createdAt\n` +
      `${verb} sortOrder on ${stats.variantsWritten} variant(s) across ` +
      `${stats.fullBackfill + stats.partialBackfill} product(s) in ${commits} batch(es)`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
