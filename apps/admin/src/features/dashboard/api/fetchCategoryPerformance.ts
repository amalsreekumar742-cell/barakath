import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getCountFromServer,
} from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import { ProductStatus } from '@barakath/shared/config/enums';
import type { CategoryProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';
import type { CategoryPerformanceItem } from '../types';

/**
 * fetchCategoryPerformance — each category's share of the catalogue for the horizontal bars (spec §1.3).
 *
 * WHY active-product count per category (via getCountFromServer): orders store items as an array with
 * productIds but no top-level category field, so order revenue is not directly aggregatable by category
 * without denormalization. The available live, index-cheap aggregation is the count of active products
 * per category — a faithful "category performance" proxy until an order→category rollup exists.
 * WHY a bounded categories read (limit 20, not paginated): categories are a small curated set; a single
 * capped read is correct here (skill: bounded config/lookup reads use a sane cap with a comment).
 */
export const fetchCategoryPerformance = createAsyncThunk<
  CategoryPerformanceItem[],
  void,
  { rejectValue: string }
>('dashboard/fetchCategoryPerformance', async (_, { rejectWithValue }) => {
  try {
    // Bounded lookup — the full (small) category set.
    const catSnap = await getDocs(
      query(collection(db, FirestoreCollections.categories), orderBy('name'), limit(20)),
    );
    const categories = catSnap.docs.map((d) => ({ ...d.data(), id: d.id }) as CategoryProps);

    // One count aggregation per category (concurrent).
    const counts = await Promise.all(
      categories.map(async (c) => {
        const snap = await getCountFromServer(
          query(
            collection(db, FirestoreCollections.products),
            where('categoryId', '==', c.id),
            where('status', '==', ProductStatus.ACTIVE),
          ),
        );
        return snap.data().count;
      }),
    );

    const total = counts.reduce((a, b) => a + b, 0);
    return categories
      .map((c, i) => ({
        categoryName: c.name,
        value: counts[i] ?? 0,
        percentage: total > 0 ? Math.round(((counts[i] ?? 0) / total) * 100) : 0,
      }))
      .sort((a, b) => b.value - a.value);
  } catch (err) {
    return rejectWithValue(
      err instanceof Error ? err.message : 'Could not load category performance',
    );
  }
});
