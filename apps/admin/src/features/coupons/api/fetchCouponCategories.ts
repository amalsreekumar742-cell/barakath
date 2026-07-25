import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { CategoryProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';

/**
 * fetchCouponCategories — the category set feeding the coupon form's "Specific categories" multi-select.
 * WHY a single bounded read (limit 50, not pagination): categories are a small curated set powering a
 * dropdown — a capped lookup is the correct pattern here (skill: bounded lookups use a sane cap with a
 * comment saying why), and the multi-select filters them client-side.
 * WHY a standalone function (not a thunk): the picker owns its own local option state; this list never
 * needs to live in the Redux slice, so keeping it a plain async call avoids slice bloat.
 */
export async function fetchCouponCategories(): Promise<CategoryProps[]> {
  const snap = await getDocs(
    query(collection(db, FirestoreCollections.categories), orderBy('name', 'asc'), limit(50)),
  );
  return snap.docs.map((d) => ({ ...d.data(), id: d.id }) as CategoryProps);
}
