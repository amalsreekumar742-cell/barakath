import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  Timestamp,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { ProductProps, VariantProps, FlashSaleProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';
import { Constants } from '@/config/constants';

/**
 * searchFlashSaleProducts — a standalone cursor-paginated product search for the flash-sale form's
 * SINGLE-select product picker (spec §1.16 product selection).
 *
 * WHY its own search (not the products / coupons feature's): features must not import another feature
 * (skill: unidirectional imports), so the flash-sale feature owns this small read. A term filters by the
 * precomputed `keywords`; an empty term returns recent products. Standard 12 + View More.
 */
export async function searchFlashSaleProducts(
  term: string,
  cursor?: QueryDocumentSnapshot | null,
): Promise<{ items: ProductProps[]; lastVisible: QueryDocumentSnapshot | null; hasMore: boolean }> {
  const t = term.trim().toLowerCase();
  const snap = await getDocs(
    query(
      collection(db, FirestoreCollections.products),
      ...(t ? [where('keywords', 'array-contains', t)] : []),
      orderBy('createdAt', 'desc'),
      ...(cursor ? [startAfter(cursor)] : []),
      limit(Constants.PAGE_SIZE),
    ),
  );
  const items = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as ProductProps);
  return {
    items,
    lastVisible: snap.docs[snap.docs.length - 1] ?? null,
    hasMore: items.length === Constants.PAGE_SIZE,
  };
}

/**
 * fetchProductVariants — read a product's variants subcollection (spec §1.5: variants live under
 * products/{id}/variants). WHY: the create form needs each variant's MRP + offer price to seed the
 * per-variant flash-price table. Ordered by createdAt so the table order is stable.
 */
export async function fetchProductVariants(productId: string): Promise<VariantProps[]> {
  const snap = await getDocs(
    query(
      collection(db, FirestoreCollections.products, productId, FirestoreCollections.variants),
      orderBy('createdAt', 'asc'),
    ),
  );
  return snap.docs.map((d) => ({ ...d.data(), id: d.id }) as VariantProps);
}

/**
 * productsInActiveFlashSale — of the given product ids, which are already in an active flash sale still
 * running (spec §1.16: "same product cannot be in multiple active flash sales"). Returns the conflicting
 * ids. WHY a single `array-contains` per product then a client isActive/endDate check: a lone
 * array-contains needs no composite index, and the active-window test can't be expressed alongside it in
 * one query. createFlashSale re-checks at the write edge so the guard stays authoritative under a race.
 */
export async function productsInActiveFlashSale(productIds: string[]): Promise<Set<string>> {
  const nowMs = Timestamp.now().toMillis();
  const conflicts = new Set<string>();
  await Promise.all(
    productIds.map(async (pid) => {
      const snap = await getDocs(
        query(collection(db, FirestoreCollections.flashSales), where('productIds', 'array-contains', pid)),
      );
      const clash = snap.docs.some((d) => {
        const fs = d.data() as FlashSaleProps;
        return fs.isActive && fs.endDate.toMillis() > nowMs;
      });
      if (clash) conflicts.add(pid);
    }),
  );
  return conflicts;
}
