import { createAsyncThunk } from '@reduxjs/toolkit';
import { collection, getCountFromServer } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import { db } from '@/lib/firebaseConfig';

/**
 * fetchFlashSaleCount — the total flash-sale count shown next to the page title (spec §1.16 count summary).
 * WHY getCountFromServer (not reading docs): the header needs the collection-wide total, not just the
 * loaded page — the aggregation is computed server-side and only the single number is transmitted, so it
 * stays cheap regardless of collection size (skill: mandatory aggregation queries for counts).
 */
export const fetchFlashSaleCount = createAsyncThunk<number, void, { rejectValue: string }>(
  'flashSale/fetchCount',
  async (_, { rejectWithValue }) => {
    try {
      const snap = await getCountFromServer(collection(db, FirestoreCollections.flashSales));
      return snap.data().count;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Could not load flash sale count');
    }
  },
);
