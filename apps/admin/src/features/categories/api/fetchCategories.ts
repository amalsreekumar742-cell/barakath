import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  getDocs,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { CategoryProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';
import { Constants } from '@/config/constants';

export interface CategoriesPage {
  items: CategoryProps[];
  // The cursor is a QueryDocumentSnapshot; typed `any` is the one accepted `any` (never leaves the
  // store, only fed back into startAfter) per the skill's cursor-pagination note.
  lastVisible: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  hasMore: boolean;
}

/**
 * fetchCategories — one cursor-paginated page of categories (spec §1.4; skill mandatory pagination).
 *
 * WHY startAfter(cursor) + limit(PAGE_SIZE): reads only the next page instead of re-reading skipped
 * docs (Firestore has no offset). `hasMore = items.length === PAGE_SIZE`. The slice appends + dedups
 * by id (StrictMode / rapid clicks can dispatch the same page twice).
 */
export const fetchCategories = createAsyncThunk<
  CategoriesPage,
  { cursor?: QueryDocumentSnapshot | null },
  { rejectValue: string }
>('categories/fetchPage', async ({ cursor }, { rejectWithValue }) => {
  try {
    const q = query(
      collection(db, FirestoreCollections.categories),
      orderBy('createdAt', 'desc'),
      ...(cursor ? [startAfter(cursor)] : []),
      limit(Constants.PAGE_SIZE),
    );
    const snap = await getDocs(q);
    const items = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as CategoryProps);
    return {
      items,
      lastVisible: snap.docs[snap.docs.length - 1] ?? null,
      hasMore: items.length === Constants.PAGE_SIZE,
    };
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not load categories');
  }
});
