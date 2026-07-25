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
 * searchNewArrivalProducts — a standalone cursor-paginated product search for the "Add products" picker
 * (spec §1.17). A term filters by the precomputed `keywords`; an empty term returns recent products.
 *
 * WHY its own search (not another feature's): features must not import another feature (skill:
 * unidirectional imports), so the newArrivals feature owns this small read.
 * WHY isNewArrival is filtered CLIENT-side (not in the where clause): combining `keywords array-contains`
 * with `isNewArrival ==` + the createdAt ordering would need an extra composite index; filtering the small
 * page after read keeps the query on the existing single-field indexes. The picker excludes products that
 * are already new arrivals so they can't be added twice.
 */
export async function searchNewArrivalProducts(
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
  const raw = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as ProductProps);
  // Exclude products already flagged as new arrivals (spec §1.17: picker only offers un-marked products).
  const items = raw.filter((p) => !p.isNewArrival);
  return {
    items,
    // Cursor is the last RAW doc so pagination advances even when the visible page is filtered down.
    lastVisible: snap.docs[snap.docs.length - 1] ?? null,
    hasMore: raw.length === Constants.PAGE_SIZE,
  };
}
