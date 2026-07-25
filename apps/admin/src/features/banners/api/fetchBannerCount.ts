import { createAsyncThunk } from '@reduxjs/toolkit';
import { collection, getCountFromServer } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import { db } from '@/lib/firebaseConfig';

/**
 * fetchBannerCount — the total banner count shown in the page subtitle (spec §1.15 listing).
 * WHY getCountFromServer (not reading docs): the header needs the collection-wide total, not just the
 * loaded page — the aggregation is computed server-side and only the single number is transmitted, so it
 * stays cheap regardless of collection size (skill: mandatory aggregation queries for counts).
 */
export const fetchBannerCount = createAsyncThunk<number, void, { rejectValue: string }>(
  'banners/fetchCount',
  async (_, { rejectWithValue }) => {
    try {
      const snap = await getCountFromServer(collection(db, FirestoreCollections.banners));
      return snap.data().count;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Could not load banner count');
    }
  },
);
