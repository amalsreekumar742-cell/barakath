import { createAsyncThunk } from '@reduxjs/toolkit';
import { collection, query, where, getCountFromServer } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import { db } from '@/lib/firebaseConfig';

/**
 * fetchSubCategoryProducts — product count for one sub-category, keyed by its id (spec §1.4 table).
 * WHY getCountFromServer by `subCategoryId` (not name): computed server-side (a few index entries, not
 * one read per product) and rename-safe — products reference the stable sub-category doc id.
 */
export const fetchSubCategoryProducts = createAsyncThunk<
  { subCategoryId: string; count: number },
  { subCategoryId: string },
  { rejectValue: string }
>('categories/fetchSubCategoryCount', async ({ subCategoryId }, { rejectWithValue }) => {
  try {
    const snap = await getCountFromServer(
      query(collection(db, FirestoreCollections.products), where('subCategoryId', '==', subCategoryId)),
    );
    return { subCategoryId, count: snap.data().count };
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not count products');
  }
});
