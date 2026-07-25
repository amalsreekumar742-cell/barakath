import { createAsyncThunk } from '@reduxjs/toolkit';
import { doc, deleteDoc } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import { db } from '@/lib/firebaseConfig';

/**
 * deleteCoupon — hard-delete a coupon document (spec §1.12 / §1.22: hard deletes throughout, with a
 * confirmation dialog + toast handled in the component).
 * WHY it returns the id: the slice removes the row from the list in place without a re-fetch, keeping the
 * paginated list intact.
 */
export const deleteCoupon = createAsyncThunk<string, string, { rejectValue: string }>(
  'coupons/delete',
  async (couponId, { rejectWithValue }) => {
    try {
      await deleteDoc(doc(db, FirestoreCollections.coupons, couponId));
      return couponId;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Could not delete coupon');
    }
  },
);
