import {
  collection,
  deleteDoc,
  doc,
  documentId,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { FirestoreCollections, ProductStatus, type ProductProps } from '@barakath/shared';
import { db } from '@/lib/firebaseConfig';

/**
 * wishlist — direct client reads/writes over `users/{uid}/wishlist/{productId}`.
 *
 * WHY a direct client read/write and not a Cloud Function: this is a low-risk, self-owned,
 * non-financial write fully constrained by `firestore.rules` (`match /users/{userId}/wishlist/{productId}
 * { allow read, write: if isOwner(userId); }`) — the same trust-boundary rule
 * `features/address/api/addresses.ts` already applies. No callable exists for this and none is needed.
 *
 * Doc id IS the product id (`WEB_BATCH3_NOTES.md` §10), doc body `{ productId, addedAt }` — confirmed
 * against `firestore.rules` and `@barakath/shared`'s own collection doc comment, NOT a field on the
 * user document as an earlier prompt draft assumed.
 */

/**
 * Bounded read cap: above this many wishlisted ids, the page stops fetching product docs entirely
 * (see `fetchWishlistProducts`'s caller) rather than silently issuing 20+ chunked reads. Kept local to
 * this feature (not `Constants`) — no other surface has a reason to know this number.
 */
export const WISHLIST_MAX_ITEMS = 200;

/**
 * `where(documentId(), 'in', …)` accepts up to 30 comparison values (current Firestore limit, and the
 * exact number `src/lib/data/catalog.ts#getProductsByIds` already chunks by for the identical query
 * shape elsewhere in this codebase) — NOT 10, despite an earlier planning note claiming a 10-id cap.
 * Trusting the already-shipped, working code over that note; see the build report for the flag.
 */
const CHUNK_SIZE = 30;

function wishlistRef(uid: string) {
  return collection(db, FirestoreCollections.users, uid, FirestoreCollections.wishlist);
}

/**
 * Every wishlisted product id for `uid`, newest-saved first.
 *
 * WHY `limit(WISHLIST_MAX_ITEMS + 1)`: this read has to stay bounded even BEFORE the "too many items"
 * guard can see the count — a customer with, say, 5,000 saved ids must never turn into a single
 * 5,000-document read just to discover the count is over the cap. Asking for one more than the cap is
 * enough to detect "over the limit" (`ids.length > WISHLIST_MAX_ITEMS`) without ever reading the whole
 * pathological set; the actual count beyond that point is never needed (the page just asks the
 * customer to trim their list).
 */
export async function listWishlistIds(uid: string): Promise<string[]> {
  const snap = await getDocs(
    query(wishlistRef(uid), orderBy('addedAt', 'desc'), limit(WISHLIST_MAX_ITEMS + 1)),
  );
  return snap.docs.map((d) => d.id);
}

/**
 * Resolve wishlisted ids to full products, chunked `documentId() in [...]` reads fired in parallel,
 * Active-only (a wishlisted product may have been unpublished since — treated as stale, never shown).
 * Does NOT re-sort to the requested id order (unlike `buildProductQuery`'s `productIds` mode) — the
 * wishlist page re-sorts the result itself per the customer's chosen sort, so preserving id order here
 * would just be discarded work.
 */
export async function fetchWishlistProducts(ids: string[]): Promise<ProductProps[]> {
  if (ids.length === 0) return [];

  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += CHUNK_SIZE) chunks.push(ids.slice(i, i + CHUNK_SIZE));

  const pages = await Promise.all(
    chunks.map((chunk) =>
      getDocs(query(collection(db, FirestoreCollections.products), where(documentId(), 'in', chunk))),
    ),
  );

  return pages
    .flatMap((snap) => snap.docs.map((d) => ({ ...(d.data() as Omit<ProductProps, 'id'>), id: d.id })))
    .filter((p) => p.status === ProductStatus.ACTIVE);
}

/** Add one product to the wishlist (the persistence middleware's write for an optimistic "on"). */
export async function addWishlistDoc(uid: string, productId: string): Promise<void> {
  await setDoc(doc(wishlistRef(uid), productId), { productId, addedAt: serverTimestamp() });
}

/** Remove one product from the wishlist (the persistence middleware's write for an optimistic "off"). */
export async function removeWishlistDoc(uid: string, productId: string): Promise<void> {
  await deleteDoc(doc(wishlistRef(uid), productId));
}

/**
 * Clean up ids whose product no longer resolves (deleted or unpublished) — a single batched delete so
 * a customer's wishlist quietly stops carrying dead rows instead of the page re-discovering the same
 * stale ids on every visit.
 */
export async function removeStaleWishlistDocs(uid: string, staleIds: string[]): Promise<void> {
  if (staleIds.length === 0) return;
  const batch = writeBatch(db);
  for (const id of staleIds) batch.delete(doc(wishlistRef(uid), id));
  await batch.commit();
}
