import { createAsyncThunk } from '@reduxjs/toolkit';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { CategoryProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';

/**
 * fetchCategoriesForFilter — the category set for the filter panel + form dropdown (spec §1.5).
 * WHY a single bounded read (limit 50, not pagination): categories are a small curated set feeding a
 * dropdown — a capped lookup is correct (skill: bounded lookups use a sane cap with a comment).
 */
export const fetchCategoriesForFilter = createAsyncThunk<CategoryProps[], void, { rejectValue: string }>(
  'products/fetchFilterCategories',
  async (_, { rejectWithValue }) => {
    try {
      const snap = await getDocs(
        query(collection(db, FirestoreCollections.categories), orderBy('name', 'asc'), limit(50)),
      );
      return snap.docs.map((d) => ({ ...d.data(), id: d.id }) as CategoryProps);
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Could not load categories');
    }
  },
);
