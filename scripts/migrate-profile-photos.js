#!/usr/bin/env node
/**
 * migrate-profile-photos.js — one-off, idempotent, re-runnable.
 *
 * Moves customer profile photos from the old Storage prefix
 *   customers/{customerId}/profile          (spec 4.22, superseded)
 * to
 *   users/{uid}/profile                     (canonical — matches the Firestore collection)
 *
 * For each object under `customers/`:
 *   1. copy to the matching `users/{uid}/...` key
 *   2. mint a fresh download URL
 *   3. write it to that user's `profilePhoto` field
 *   4. ONLY THEN delete the original
 *
 * Safety properties:
 *   - --dry-run prints every action and writes nothing. Run this first.
 *   - Idempotent: an object whose destination already exists is skipped, not re-copied.
 *   - If the uid cannot be matched to a user document, the object is LEFT IN PLACE and logged.
 *     Deleting an object we cannot re-link would strand a customer's avatar with no way back.
 *   - The delete only ever runs after the Firestore write has resolved.
 *
 * Usage:
 *   node scripts/migrate-profile-photos.js --dry-run
 *   node scripts/migrate-profile-photos.js
 *
 * Dependencies: firebase-admin. There is no package.json in scripts/, so borrow
 * the one already installed for the functions package:
 *   NODE_PATH=./functions/node_modules node scripts/migrate-profile-photos.js --dry-run
 *
 * Credentials: Application Default Credentials. Either
 *   set GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 * or run `gcloud auth application-default login`.
 */

const admin = require('firebase-admin');

const DRY_RUN = process.argv.includes('--dry-run');
const OLD_PREFIX = 'customers/';
const PROJECT_ID = process.env.GCLOUD_PROJECT || 'barakath-e6ad3';
const BUCKET = process.env.STORAGE_BUCKET || `${PROJECT_ID}.firebasestorage.app`;

const log = (...args) => console.log(DRY_RUN ? '[dry-run]' : '[migrate]', ...args);

/**
 * `customers/{uid}/profile` → uid. Returns null for anything that does not look
 * like a per-customer object, so an unexpected key is reported rather than
 * guessed at.
 */
function uidFromPath(name) {
  const parts = name.split('/');
  if (parts.length < 3 || parts[0] !== 'customers') return null;
  return parts[1] || null;
}

async function main() {
  admin.initializeApp({ projectId: PROJECT_ID, storageBucket: BUCKET });
  const bucket = admin.storage().bucket();
  const db = admin.firestore();

  log(`project=${PROJECT_ID} bucket=${BUCKET}`);
  log(`scanning gs://${BUCKET}/${OLD_PREFIX} …`);

  const [files] = await bucket.getFiles({ prefix: OLD_PREFIX });
  if (files.length === 0) {
    log('nothing found under the old prefix — no migration needed.');
    return;
  }
  log(`found ${files.length} object(s)`);

  const stats = { copied: 0, skipped: 0, orphaned: 0, failed: 0 };

  for (const file of files) {
    const oldPath = file.name;
    const uid = uidFromPath(oldPath);

    if (!uid) {
      log(`SKIP  unrecognised key, leaving in place: ${oldPath}`);
      stats.skipped++;
      continue;
    }

    const newPath = oldPath.replace(/^customers\//, 'users/');

    // Only migrate photos belonging to a real user document. An object we
    // cannot re-link must never be deleted (requirement d).
    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      log(`ORPHAN no users/${uid} document — leaving ${oldPath} in place`);
      stats.orphaned++;
      continue;
    }

    const [destExists] = await bucket.file(newPath).exists();
    if (destExists) {
      log(`SKIP  destination already present: ${newPath}`);
      stats.skipped++;
      // Fall through to the delete below only if the doc already points at the
      // new object; otherwise leave both and let a human look.
      const current = userSnap.get('profilePhoto') || '';
      if (!DRY_RUN && current.includes(encodeURIComponent(newPath))) {
        await bucket.file(oldPath).delete();
        log(`      removed stale original ${oldPath}`);
      }
      continue;
    }

    try {
      log(`COPY  ${oldPath} → ${newPath}`);
      if (!DRY_RUN) await bucket.file(oldPath).copy(bucket.file(newPath));

      let url = '(dry-run: not generated)';
      if (!DRY_RUN) {
        const dest = bucket.file(newPath);
        await dest.makePublic().catch(() => {});
        const [meta] = await dest.getMetadata();
        const token = meta.metadata && meta.metadata.firebaseStorageDownloadTokens;
        url = token
          ? `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(newPath)}?alt=media&token=${token}`
          : `https://storage.googleapis.com/${BUCKET}/${newPath}`;
      }

      log(`WRITE users/${uid}.profilePhoto = ${url}`);
      if (!DRY_RUN) {
        await userRef.update({
          profilePhoto: url,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      // Delete last — only once the document points at the new object.
      log(`DEL   ${oldPath}`);
      if (!DRY_RUN) await bucket.file(oldPath).delete();

      stats.copied++;
    } catch (err) {
      log(`FAIL  ${oldPath}: ${err.message} — original left in place`);
      stats.failed++;
    }
  }

  log('---');
  log(
    `copied=${stats.copied} skipped=${stats.skipped} ` +
      `orphaned=${stats.orphaned} failed=${stats.failed}`,
  );
  if (DRY_RUN) log('DRY RUN — nothing was written or deleted.');
}

main().catch((err) => {
  console.error('[migrate] fatal:', err.message);
  process.exitCode = 1;
});
