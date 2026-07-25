import { createAsyncThunk } from '@reduxjs/toolkit';
import { collection, getCountFromServer } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import { db } from '@/lib/firebaseConfig';

/**
 * fetchCampaignCount — the total campaign count shown next to the page title (spec F13 count subtitle).
 * WHY getCountFromServer (not reading docs): the header needs the collection-wide total, not just the
 * loaded page — the aggregation is computed server-side and only the single number is transmitted, so it
 * stays cheap regardless of collection size (skill: mandatory aggregation queries for counts).
 */
export const fetchCampaignCount = createAsyncThunk<number, void, { rejectValue: string }>(
  'spinnerCampaigns/fetchCount',
  async (_, { rejectWithValue }) => {
    try {
      const snap = await getCountFromServer(collection(db, FirestoreCollections.spinnerCampaigns));
      return snap.data().count;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Could not load campaign count');
    }
  },
);
