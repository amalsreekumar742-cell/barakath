import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { SubCategoryProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';

/**
 * loadSubCategories — the sub-category docs of a category, for the product form's dependent dropdown
 * and the filter panel (spec §1.5). A plain async helper (called ad-hoc when the selected category
 * changes); the product needs the sub-category's id + name, so we read the actual docs, not just the
 * denormalized names on the category. Bounded read (small curated set).
 */
export async function loadSubCategories(categoryId: string): Promise<SubCategoryProps[]> {
  if (!categoryId) return [];
  const snap = await getDocs(
    query(
      collection(db, FirestoreCollections.categories, categoryId, FirestoreCollections.subCategories),
      orderBy('name', 'asc'),
      limit(200),
    ),
  );
  return snap.docs.map((d) => ({ ...d.data(), id: d.id }) as SubCategoryProps);
}
