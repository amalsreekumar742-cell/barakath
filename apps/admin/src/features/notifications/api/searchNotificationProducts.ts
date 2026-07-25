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
 * searchNotificationProducts — a standalone cursor-paginated product search for the Create Notification
 * form's deep-link picker when linkType = 'Product' (spec §1.18 Deep link).
 *
 * WHY its own search (not the products feature's list): features must not import another feature (skill:
 * unidirectional imports), so the notifications feature owns this small read. A term filters by the
 * precomputed `keywords`; an empty term returns recent products. Cursor-paginated with the standard 12 +
 * View More — products are an unbounded, growable pool, so a native <select> won't do.
 */
export async function searchNotificationProducts(
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
