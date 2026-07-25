import { createAsyncThunk } from '@reduxjs/toolkit';
import { collection, getCountFromServer } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import { db } from '@/lib/firebaseConfig';

/**
 * fetchCouponCount — the total coupon count shown next to the page title (spec §1.12 count summary).
 * WHY getCountFromServer (not reading docs): the header needs the collection-wide total, not just the
 * loaded page — the aggregation is computed server-side and only the single number is transmitted, so it
 * stays cheap regardless of collection size (skill: mandatory aggregation queries for counts).
 */
export const fetchCouponCount = createAsyncThunk<number, void, { rejectValue: string }>(
  'coupons/fetchCount',
  async (_, { rejectWithValue }) => {
    try {
      const snap = await getCountFromServer(collection(db, FirestoreCollections.coupons));
      return snap.data().count;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Could not load coupon count');
    }
  },
);
