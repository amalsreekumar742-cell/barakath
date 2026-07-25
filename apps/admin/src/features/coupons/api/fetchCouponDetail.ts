import { createAsyncThunk } from '@reduxjs/toolkit';
import { doc, getDoc } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { CouponProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';

/**
 * fetchCouponDetail — load a single coupon by id for the Edit page (spec §1.12 editable after creation).
 * WHY a one-shot getDoc (not onSnapshot): the edit form takes an initial snapshot to hydrate its fields;
 * it does not need live updates while the admin is editing, so a single read is cheaper and simpler.
 */
export const fetchCouponDetail = createAsyncThunk<CouponProps, string, { rejectValue: string }>(
  'coupons/fetchDetail',
  async (couponId, { rejectWithValue }) => {
    try {
      const snap = await getDoc(doc(db, FirestoreCollections.coupons, couponId));
      if (!snap.exists()) return rejectWithValue('Coupon not found');
      return { ...snap.data(), id: snap.id } as CouponProps;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Could not load coupon');
    }
  },
);
