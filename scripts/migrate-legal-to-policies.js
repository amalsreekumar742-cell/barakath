#!/usr/bin/env node
/**
 * migrate-legal-to-policies.js — one-off, idempotent, re-runnable.
 *
 * Copies the two legacy legal texts on `general/config` into the new `policies` collection (Settings ›
 * Policies — one document per policy):
 *   general/config.privacy.privacyPolicy    → policies/privacy-policy        "Privacy Policy",     order 1
 *   general/config.terms.termsAndConditions → policies/terms-and-conditions  "Terms & Conditions", order 2
 *
 * WHY fixed ids (LEGACY_POLICY_IDS in packages/shared/src/config/policies.ts — keep in sync): the old
 * `/privacy-policy` and `/terms` URLs (given to Razorpay, indexed by search engines) and the app's old
 * profile routes redirect straight to these two documents.
 *
 * WHY status follows the content: an empty legacy text becomes a `disabled` policy, so customers never
 * see a blank page, while the admin still finds it in the list ready to be written and enabled.
 *
 * WHY it SKIPS a policy that already exists (instead of overwriting): after the first run the admin edits
 * these documents in Settings › Policies. Re-running must never clobber that newer copy with the stale
 * legacy text — so the script only ever creates, which also makes it safe to run any number of times.
 *
 * WHY `general/config` is left untouched: app installs from before the move still read the legacy
 * maps. They are retired later, separately, once those installs have aged out.
 *
 * WHY the client SDK and not firebase-admin: this machine has no Application Default Credentials and no
 * gcloud. `policies` is admin-writable per firebase/firestore.rules, so signing in as the super admin
 * from apps/admin/.env.e2e gets the same access without a service-account key on disk. The rules'
 * shape check (exact field allow-list, server timestamps, updatedBy == caller) is satisfied by the
 * document written below — but only once the `policies` rules are DEPLOYED. Until then the live run is
 * refused by the default-deny rule (and so is the existence check in a dry run, which is reported).
 *
 * Usage (from the repo root):
 *   node scripts/migrate-legal-to-policies.js --dry-run
 *   node scripts/migrate-legal-to-policies.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ADMIN_DIR = path.join(ROOT, 'apps', 'admin');
const DRY_RUN = process.argv.includes('--dry-run');

/** Mirrors LEGACY_POLICY_IDS + the display order the two legacy pages get. */
const LEGACY = [
  {
    id: 'privacy-policy',
    name: 'Privacy Policy',
    order: 1,
    read: (config) => config?.privacy?.privacyPolicy,
    source: 'general/config.privacy.privacyPolicy',
  },
  {
    id: 'terms-and-conditions',
    name: 'Terms & Conditions',
    order: 2,
    read: (config) => config?.terms?.termsAndConditions,
    source: 'general/config.terms.termsAndConditions',
  },
];

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

/**
 * True when Quill HTML has no visible text (`''`, `<p><br></p>`…). Mirrors isBlankHtml in
 * apps/admin/src/features/settings/utils/policyContent.ts — the admin form uses the same test to
 * refuse a blank policy, so a migrated "blank" one is created disabled rather than published empty.
 */
function isBlankHtml(html) {
  return (
    String(html ?? '')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;|&#160;/gi, ' ')
      .trim().length === 0
  );
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
const { getFirestore, doc, getDoc, setDoc, serverTimestamp } = fromAdmin('firebase/firestore');

async function main() {
  const app = initializeApp({
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  });

  const cred = await signInWithEmailAndPassword(getAuth(app), env.E2E_ADMIN_EMAIL, env.E2E_ADMIN_PASSWORD);
  const uid = cred.user.uid;
  const db = getFirestore(app);
  console.log(`${DRY_RUN ? '[DRY RUN] ' : ''}project ${env.VITE_FIREBASE_PROJECT_ID} · signed in as ${uid}\n`);

  const configSnap = await getDoc(doc(db, 'general', 'config'));
  if (!configSnap.exists()) {
    console.log('general/config does not exist — nothing to migrate.');
    return;
  }
  const config = configSnap.data();

  let created = 0;
  let skipped = 0;
  let unknown = 0;

  for (const p of LEGACY) {
    const raw = p.read(config);
    const content = typeof raw === 'string' ? raw : '';
    const status = isBlankHtml(content) ? 'disabled' : 'enabled';
    const summary = `${p.name} — ${content.length} chars of HTML, status ${status}, order ${p.order}`;

    // Existence check first: never overwrite a policy the admin may already have edited.
    let exists;
    try {
      exists = (await getDoc(doc(db, 'policies', p.id))).exists();
    } catch (err) {
      if (err && err.code === 'permission-denied') {
        // Before the `policies` rules are deployed, the default-deny rule refuses even an admin read.
        if (!DRY_RUN) {
          throw new Error(
            `Reading policies/${p.id} was denied — deploy firebase/firestore.rules (the policies block) first.`,
          );
        }
        unknown++;
        console.log(`  WOULD CREATE?  policies/${p.id}  ${summary}`);
        console.log(`                 (could not check whether it already exists: the policies rules are not deployed yet)`);
        console.log(`                 from ${p.source}${typeof raw === 'string' ? '' : ' (missing — treated as empty)'}`);
        continue;
      }
      throw err;
    }

    if (exists) {
      skipped++;
      console.log(`  SKIP     policies/${p.id} already exists — left untouched`);
      continue;
    }

    created++;
    console.log(`  ${DRY_RUN ? 'WOULD CREATE' : 'CREATE      '}  policies/${p.id}  ${summary}`);
    console.log(`                 from ${p.source}${typeof raw === 'string' ? '' : ' (missing — treated as empty)'}`);
    if (DRY_RUN) continue;

    await setDoc(doc(db, 'policies', p.id), {
      id: p.id,
      name: p.name,
      content,
      status,
      order: p.order,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });
  }

  console.log(
    `\n${DRY_RUN ? 'would create' : 'created'} ${created}, skipped ${skipped} (already present)` +
      (unknown ? `, ${unknown} unchecked (rules not deployed — would be created unless present)` : '') +
      ` · general/config left unchanged`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
