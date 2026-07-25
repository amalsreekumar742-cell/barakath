import { createAsyncThunk } from '@reduxjs/toolkit';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { SubCategoryProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';

/**
 * fetchSubCategories — the sub-category documents of one category (spec §1.4).
 *
 * Reads the subcollection `categories/{categoryId}/subCategories`, oldest first.
 * WHY a single bounded read (limit 200), not pagination: sub-categories per category are a small
 * curated set — a capped lookup is correct (skill: bounded reads use a sane cap with a comment).
 */
export const fetchSubCategories = createAsyncThunk<
  SubCategoryProps[],
  { categoryId: string },
  { rejectValue: string }
>('categories/fetchSubCategories', async ({ categoryId }, { rejectWithValue }) => {
  try {
    const snap = await getDocs(
      query(
        collection(db, FirestoreCollections.categories, categoryId, FirestoreCollections.subCategories),
        orderBy('createdAt', 'asc'),
        limit(200),
      ),
    );
    return snap.docs.map((d) => ({ ...d.data(), id: d.id }) as SubCategoryProps);
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not load sub-categories');
  }
});
