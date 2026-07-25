import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import { db } from '@/lib/firebaseConfig';

/**
 * isSkuTaken — whether a SKU already exists on another product (spec §1.5 unique SKU).
 * WHY a plain async helper (not a thunk): it's called both on-blur in the form and inside
 * create/update; `limit(1)` keeps it a single cheap read. `excludeId` lets the edit form ignore the
 * product's own current SKU.
 */
export async function isSkuTaken(sku: string, excludeId?: string): Promise<boolean> {
  const trimmed = sku.trim();
  if (!trimmed) return false;
  const snap = await getDocs(
    query(collection(db, FirestoreCollections.products), where('sku', '==', trimmed), limit(2)),
  );
  return snap.docs.some((d) => d.id !== excludeId);
}
