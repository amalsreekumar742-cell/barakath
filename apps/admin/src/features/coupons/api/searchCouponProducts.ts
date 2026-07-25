import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  documentId,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { ProductProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';
import { Constants } from '@/config/constants';

/**
 * searchCouponProducts — a standalone cursor-paginated product search for the coupon form's "Specific
 * products" multi-select (spec §1.12 product restriction).
 *
 * WHY its own search (not the products feature's list): features must not import another feature (skill:
 * unidirectional imports), so the coupons feature owns this small read. A term filters by the precomputed
 * `keywords`; an empty term returns recent products. Cursor-paginated with the standard 12 + View More.
 */
export async function searchCouponProducts(
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
 * loadCouponProductsByIds — resolve already-selected product ids back to names so Edit can render chips
 * for previously chosen products. Firestore `in` allows up to 30 ids per query, so we chunk by 30.
 * WHY: the stored coupon holds only `applicableProducts: string[]` — the form needs the product names to
 * label the chips, and a bounded `documentId() in [...]` read fetches exactly those docs.
 */
export async function loadCouponProductsByIds(ids: string[]): Promise<ProductProps[]> {
  if (ids.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));
  const results = await Promise.all(
    chunks.map((chunk) =>
      getDocs(query(collection(db, FirestoreCollections.products), where(documentId(), 'in', chunk))),
    ),
  );
  return results.flatMap((snap) => snap.docs.map((d) => ({ ...d.data(), id: d.id }) as ProductProps));
}
