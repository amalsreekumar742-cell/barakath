import { doc, runTransaction } from 'firebase/firestore';
import { FirestoreCollections, FirestoreDocs } from '@barakath/shared';
import { db } from '@/lib/firebaseConfig';

/**
 * The `#RP-XXXX` display reference stamped on a replacement request.
 *
 * WHY this two-step shape (WEB_BATCH4_NOTES.md §4): the "preferred" design is a shared transactional
 * counter on `general/config.replacementCounter`, incremented atomically so every request across every
 * client gets a genuinely sequential number. But `firestore.rules` gives `general/{docId}`
 * `allow write: if isAdmin()` only — a signed-in customer's transaction on it always fails
 * permission-denied. Verified against `apps/app/lib/features/replacement/data/datasources/
 * replacement_remote_datasource.dart`'s `_nextRequestId`: it attempts the exact same transaction, catches
 * the same denial, and falls back to a hash of the request's own Firestore auto-id. Every real customer
 * request today — on the ONLY client that has ever created these documents — goes through the fallback;
 * the transaction path is currently unreachable in practice for a non-admin caller.
 *
 * This mirrors that shape (attempt the transaction first, so the day rules gain a customer-write path
 * the number becomes genuinely sequential for free) rather than skipping straight to the fallback, but
 * makes no attempt to bit-for-bit replicate Dart's `String.hashCode` in JavaScript — that would be
 * meaningless work: Flutter's own fallback was never a hard uniqueness guarantee (`% 10000` already
 * collides across different Flutter-only requests with non-zero probability), it is a COSMETIC display
 * reference only. The real key everywhere (admin resolution, the `replacements/{id}` document itself)
 * is the Firestore document id, never this string. A simple deterministic string hash of the doc id is
 * therefore just as sound as Dart's, and does not need to match it digit-for-digit.
 */
export async function nextRequestId(docId: string): Promise<string> {
  const counterRef = doc(db, FirestoreCollections.general, FirestoreDocs.generalConfig);
  try {
    const next = await runTransaction(db, async (tx) => {
      const snap = await tx.get(counterRef);
      const current = Number(snap.data()?.replacementCounter) || 0;
      tx.update(counterRef, { replacementCounter: current + 1 });
      return current + 1;
    });
    return formatRequestId(next);
  } catch {
    // Expected path today (see header): general/{docId} write is admin-only, so this always denies for
    // a customer. Fall back to a deterministic hash of the document's own auto-id.
    return formatRequestId(hashToFourDigits(docId));
  }
}

function formatRequestId(counter: number): string {
  return `#RP-${(((counter % 10000) + 10000) % 10000).toString().padStart(4, '0')}`;
}

/**
 * A small, deterministic string hash (djb2-style), reduced mod 10000. Not cryptographic and not
 * intended to match Dart's `String.hashCode` — see this file's header for why that equivalence is not
 * load-bearing. Only needs to be: (a) deterministic for the same doc id, (b) spread reasonably across
 * four digits for a readable display reference.
 */
function hashToFourDigits(value: string): number {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 33 + value.charCodeAt(i)) | 0; // |0 keeps this in 32-bit signed range
  }
  return Math.abs(hash) % 10000;
}
