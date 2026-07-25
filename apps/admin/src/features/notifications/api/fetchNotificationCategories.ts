import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { CategoryProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';

/**
 * fetchNotificationCategories — the category set feeding the Create Notification form's deep-link picker
 * when linkType = 'Category' (spec §1.18 Deep link).
 *
 * WHY a single bounded read (limit 50, not pagination): categories are a small curated set powering a
 * dropdown — a capped lookup is the correct pattern here (skill: bounded lookups use a sane cap with a
 * comment saying why), and the picker filters them client-side.
 * WHY a standalone function (not a thunk): the picker owns its own local option state; this list never
 * needs to live in the Redux slice, so a plain async call avoids slice bloat. Features must not import
 * another feature, so notifications owns its own copy of this read.
 */
export async function fetchNotificationCategories(): Promise<CategoryProps[]> {
  const snap = await getDocs(
    query(collection(db, FirestoreCollections.categories), orderBy('name', 'asc'), limit(50)),
  );
  return snap.docs.map((d) => ({ ...d.data(), id: d.id }) as CategoryProps);
}
