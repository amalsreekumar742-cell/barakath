import {
  doc,
  getDoc,
  serverTimestamp,
  type WriteBatch,
} from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import { db } from '@/lib/firebaseConfig';

/**
 * Purchase price ("purchase payment") read/write helpers.
 *
 * WHY a sibling collection instead of a field on the variant: `products/{id}/variants/{vid}` is
 * world-readable — the storefront renders variants without a session — and Firestore rules gate whole
 * documents, not fields. A `purchasePrice` there would publish the business's cost, and therefore its
 * margin on every product, to anyone who opened the site. `variantCosts/{variantId}` is admin-only.
 *
 * The doc id IS the variant id, so both directions are direct gets/sets with no query and no index.
 */

const costRef = (variantId: string) => doc(db, FirestoreCollections.variantCosts, variantId);

/**
 * Purchase prices for the given variants, as `variantId → price`. Variants with no recorded cost are
 * simply absent from the map — the caller must treat that as "unknown", not as ₹0.
 *
 * WHY parallel gets rather than one `documentId() in` query: a product has a handful of variants, so
 * this is a few reads by primary key; an `in` query would cap at 30 ids and buy nothing here.
 */
export async function fetchVariantCosts(variantIds: string[]): Promise<Map<string, number>> {
  const ids = variantIds.filter(Boolean);
  const out = new Map<string, number>();
  if (ids.length === 0) return out;

  const snaps = await Promise.all(ids.map((id) => getDoc(costRef(id))));
  snaps.forEach((snap, i) => {
    if (!snap.exists()) return;
    const raw = snap.data().purchasePrice;
    if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) out.set(ids[i] as string, raw);
  });
  return out;
}

/**
 * Queues the cost write for one variant onto the product's existing batch, so a product save stays a
 * single atomic commit — a saved variant can never end up without its cost, or vice versa.
 */
export function queueVariantCost(
  batch: WriteBatch,
  variantId: string,
  productId: string,
  purchasePrice: number,
): void {
  batch.set(
    costRef(variantId),
    { variantId, productId, purchasePrice, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

/** Queues deletion of a removed variant's cost, so no orphan cost rows accumulate. */
export function queueVariantCostDelete(batch: WriteBatch, variantId: string): void {
  batch.delete(costRef(variantId));
}
