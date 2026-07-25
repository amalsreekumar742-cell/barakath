import { createAsyncThunk } from '@reduxjs/toolkit';
import { doc, getDoc } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { CategoryProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';

/**
 * fetchCategoryDetail — a single category document (spec §1.4 sub-categories page).
 * WHY a plain get (not a listener): the sub-categories page reads the category once on load; edits go
 * through explicit thunks that update slice state.
 */
export const fetchCategoryDetail = createAsyncThunk<CategoryProps, string, { rejectValue: string }>(
  'categories/fetchDetail',
  async (categoryId, { rejectWithValue }) => {
    try {
      const snap = await getDoc(doc(db, FirestoreCollections.categories, categoryId));
      if (!snap.exists()) return rejectWithValue('Category not found');
      return { ...snap.data(), id: snap.id } as CategoryProps;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Could not load category');
    }
  },
);
