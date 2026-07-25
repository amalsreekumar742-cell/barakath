import { createAsyncThunk } from '@reduxjs/toolkit';
import { collection, query, where, getCountFromServer } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import { db } from '@/lib/firebaseConfig';

/**
 * fetchNewArrivalsCount — the count of products marked as new arrivals, shown in the subtitle (spec §1.17).
 * WHY getCountFromServer (not reading docs): the header needs the total of matching products, not just the
 * loaded page — the aggregation is computed server-side and only the single number is transmitted, so it
 * stays cheap regardless of catalogue size (skill: mandatory aggregation queries for counts).
 */
export const fetchNewArrivalsCount = createAsyncThunk<number, void, { rejectValue: string }>(
  'newArrivals/fetchCount',
  async (_, { rejectWithValue }) => {
    try {
      const snap = await getCountFromServer(
        query(collection(db, FirestoreCollections.products), where('isNewArrival', '==', true)),
      );
      return snap.data().count;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Could not load new arrivals count');
    }
  },
);
