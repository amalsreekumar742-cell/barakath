#!/usr/bin/env node
/**
 * resort-variants-by-size.js — give every product's variants a sensible display order:
 * colour (kept in its current first-seen order), then Size ascending, then Layer ascending (natural sort, so 50 < 51 < 100 ml and
 * "57" < "57 · Layer 2"), and write it as `sortOrder` (0-based) on each variant.
 *
 * WHY this exists: `backfill-variant-sort-order.js` numbered existing variants in `createdAt` order, but
 * every variant of a product created in one admin save shares the SAME server timestamp — so that
 * "creation order" was really document-id order, i.e. random (C CAP read 51, 54, 52, 50, 57…). The order
 * the admin typed the rows in was never stored and cannot be recovered; size order is the closest
 * meaningful order.
 *
 * WHY products edited after the reorder feature shipped are flagged (and skippable): from then on an
 * admin can arrange variants with ▲/▼ on purpose. `--skip-edited-since=<ISO date>` leaves those alone.
 *
 * Usage:
 *   node scripts/resort-variants-by-size.js --dry-run                     # show what would change
 *   node scripts/resort-variants-by-size.js                               # apply
 *   node scripts/resort-variants-by-size.js --skip-edited-since=2026-10-14T05:05:00Z
 *   node scripts/resort-variants-by-size.js --products=<id>,<id>          # only these products
 *
 * Re-runnable: a product already in this order produces no writes. Auth mirrors
 * backfill-variant-sort-order.js (client SDK signed in as the e2e super admin).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ADMIN_DIR = path.join(ROOT, 'apps', 'admin');
const DRY_RUN = process.argv.includes('--dry-run');
const argValue = (name) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};
const SKIP_EDITED_SINCE = argValue('skip-edited-since') ? new Date(argValue('skip-edited-since')) : null;
const ONLY_PRODUCTS = argValue('products') ? new Set(argValue('products').split(',').filter(Boolean)) : null;
/** When the ▲/▼ reorder went live — products saved after this MAY carry a deliberate order. */
const REORDER_LAUNCH = new Date('2026-10-14T05:05:00Z');

const MAX_BATCH_OPS = 500;

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
const missing = ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID', 'E2E_ADMIN_EMAIL', 'E2E_ADMIN_PASSWORD'].filter(
  (key) => !env[key],
);
if (missing.length > 0) {
  console.error(`Missing from apps/admin/.env and .env.e2e: ${missing.join(', ')}`);
  process.exit(1);
}

// scripts/ has no node_modules — borrow the firebase package installed for the admin app.
const fromAdmin = (id) => require(require.resolve(id, { paths: [ADMIN_DIR] }));
const { initializeApp } = fromAdmin('firebase/app');
const { getAuth, signInWithEmailAndPassword } = fromAdmin('firebase/auth');
const { getFirestore, collection, getDocs, writeBatch } = fromAdmin('firebase/firestore');

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

/** Canonical group name — mirrors `axisLabel` in packages/shared/src/utils/variantOptions.ts. */
const axisLabel = (g) =>
  String(g ?? '')
    .trim()
    .toLowerCase()
    .replace(/(^|\s)\S/g, (c) => c.toUpperCase());

/** Non-colour axes of a variant as { Size: '57', Layer: '2' } — a legacy variant's name is its Size. */
function axes(v) {
  const opts = Array.isArray(v.options) ? v.options.filter((o) => o && o.value) : [];
  if (opts.length === 0) return { Size: String(v.name ?? '') };
  return Object.fromEntries(opts.map((o) => [axisLabel(o.group), String(o.value)]));
}

/** Current display order: by sortOrder (missing last), then createdAt, then id — what readers show. */
function currentOrder(variants) {
  return [...variants].sort((a, b) => {
    const sa = typeof a.sortOrder === 'number' ? a.sortOrder : Infinity;
    const sb = typeof b.sortOrder === 'number' ? b.sortOrder : Infinity;
    if (sa !== sb) return sa < sb ? -1 : 1;
    const ta = a.createdAt?.toMillis?.() ?? 0;
    const tb = b.createdAt?.toMillis?.() ?? 0;
    if (ta !== tb) return ta - tb;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/** Proposed order: colour, then Size, then Layer, then any other axis — ties keep the current order. */
function proposedOrder(current) {
  const axisNames = ['Size', 'Layer'];
  for (const v of current) for (const k of Object.keys(axes(v))) if (!axisNames.includes(k)) axisNames.push(k);
  // Colours keep the order they first appear in NOW — an admin's deliberate colour grouping (e.g. RED
  // before MAROON) survives; only the sizes/layers inside each colour are put in ascending order.
  const colourRank = new Map();
  for (const v of current) if (!colourRank.has(v.color)) colourRank.set(v.color, colourRank.size);
  return current
    .map((v, i) => ({ v, i, a: axes(v) }))
    .sort((x, y) => {
      const c = colourRank.get(x.v.color) - colourRank.get(y.v.color);
      if (c !== 0) return c;
      for (const name of axisNames) {
        const xv = x.a[name];
        const yv = y.a[name];
        if (xv === undefined && yv === undefined) continue;
        if (xv === undefined) return 1; // a variant without this axis sorts after those with it
        if (yv === undefined) return -1;
        const d = collator.compare(xv, yv);
        if (d !== 0) return d;
      }
      return x.i - y.i;
    })
    .map(({ v }) => v);
}

const label = (v) => `${v.color ? `${v.color}/` : ''}${v.name}`;

async function main() {
  const app = initializeApp({
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
  });
  const db = getFirestore(app);
  const cred = await signInWithEmailAndPassword(getAuth(app), env.E2E_ADMIN_EMAIL, env.E2E_ADMIN_PASSWORD);
  console.log(`${DRY_RUN ? '[DRY RUN] ' : ''}signed in as ${cred.user.uid}`);
  if (SKIP_EDITED_SINCE) console.log(`skipping products edited since ${SKIP_EDITED_SINCE.toISOString()}`);

  const products = (await getDocs(collection(db, 'products'))).docs.filter((p) => !ONLY_PRODUCTS || ONLY_PRODUCTS.has(p.id));
  const writes = [];
  let unchanged = 0;
  let skipped = 0;
  for (const p of products) {
    const pd = p.data();
    const variants = (await getDocs(collection(db, 'products', p.id, 'variants'))).docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() }));
    if (variants.length < 2) continue;
    const current = currentOrder(variants);
    const proposed = proposedOrder(current);
    const changes = proposed.filter((v, i) => v.sortOrder !== i);
    if (changes.length === 0) {
      unchanged++;
      continue;
    }
    const updated = pd.updatedAt?.toDate?.();
    const editedAfterLaunch = updated && updated > REORDER_LAUNCH;
    if (SKIP_EDITED_SINCE && updated && updated > SKIP_EDITED_SINCE) {
      skipped++;
      console.log(`  SKIP   ${pd.name} [${p.id}] — edited ${updated.toISOString()}`);
      continue;
    }
    const flag = editedAfterLaunch ? `  ⚠ edited ${updated.toISOString().slice(0, 16)}Z (after reorder launch — order may be deliberate)` : '';
    console.log(`\n  ${pd.name} [${p.id}] ${pd.status ?? ''}${flag}`);
    console.log(`     now: ${current.slice(0, 12).map(label).join(' | ')}${current.length > 12 ? ' …' : ''}`);
    console.log(`     new: ${proposed.slice(0, 12).map(label).join(' | ')}${proposed.length > 12 ? ' …' : ''}`);
    proposed.forEach((v, i) => {
      if (v.sortOrder !== i) writes.push({ ref: v.ref, sortOrder: i });
    });
  }

  console.log(
    `\n${products.length} products scanned · ${unchanged} already in size order · ${skipped} skipped · ` +
      `${DRY_RUN ? 'would write' : 'writing'} sortOrder on ${writes.length} variant(s)`,
  );
  if (DRY_RUN || writes.length === 0) return;

  for (let i = 0; i < writes.length; i += MAX_BATCH_OPS) {
    const batch = writeBatch(db);
    for (const w of writes.slice(i, i + MAX_BATCH_OPS)) batch.update(w.ref, { sortOrder: w.sortOrder });
    await batch.commit();
  }
  console.log('done');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('FAILED', err.code ?? '', err.message ?? err);
    process.exit(1);
  });
