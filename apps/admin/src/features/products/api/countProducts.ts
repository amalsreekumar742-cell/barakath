import { collection, query, getCountFromServer } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import { db } from '@/lib/firebaseConfig';
import { productFilterConstraints } from './fetchProducts';
import type { ProductFilters } from '../types';

/**
 * countProducts — total products matching the current filters (spec §1.5 count summary).
 * WHY getCountFromServer (not the loaded array length): the summary must reflect ALL matches, not just
 * the current page — computed server-side as a small aggregation (skill: aggregation for counts).
 */
export async function countProducts(filters: ProductFilters): Promise<number> {
  const snap = await getCountFromServer(
    query(collection(db, FirestoreCollections.products), ...productFilterConstraints(filters)),
  );
  return snap.data().count;
}
