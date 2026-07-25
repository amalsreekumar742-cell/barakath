import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  doc,
  getDoc,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { ProductProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';
import { Constants } from '@/config/constants';

/**
 * searchBannerProducts — a standalone cursor-paginated product search for the banner form's single
 * "Product" link picker (spec §1.15 attach product).
 *
 * WHY its own search (not the products feature's list): features must not import another feature (skill:
 * unidirectional imports), so the banners feature owns this small read. A term filters by the precomputed
 * `keywords` array; an empty term returns recent products. Cursor-paginated with the standard 12 + View More.
 */
export async function searchBannerProducts(
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
 * loadBannerProductById — resolve a single already-selected product id back to its doc so the Edit page can
 * label the picker with the product's name/thumbnail.
 * WHY a single getDoc (not the `in` query): a banner links to at most ONE product, so a direct id read is
 * the cheapest way to hydrate the chip on Edit. Returns null if the product was deleted (spec §1.15:
 * "Product not available" when an attached product is gone).
 */
export async function loadBannerProductById(id: string): Promise<ProductProps | null> {
  if (!id) return null;
  const snap = await getDoc(doc(db, FirestoreCollections.products, id));
  return snap.exists() ? ({ ...snap.data(), id: snap.id } as ProductProps) : null;
}
