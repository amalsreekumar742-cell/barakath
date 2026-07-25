import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { ProductProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';
import { Constants } from '@/config/constants';

/**
 * searchProducts — a standalone cursor-paginated product search for the ProductPicker (spec §1.5
 * reusable picker). Kept separate from the list slice so picking products (e.g. for FBT) never clobbers
 * the main Products list state. A term filters by the precomputed `keywords`; empty term returns recent
 * products.
 */
export async function searchProducts(
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
