import { createAsyncThunk } from '@reduxjs/toolkit';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import { db } from '@/lib/firebaseConfig';

/**
 * toggleCouponActive — flip a coupon's `isActive` flag from the list (spec §1.12 status toggle).
 * WHY only isActive + updatedAt are written: activation is a single low-risk field flip; nothing else
 * (least-surprise, and it can't disturb the redemption counter or dates). updatedAt is server-stamped.
 * WHY it returns {couponId, isActive}: the slice patches just that row's flag in place — no re-fetch — and
 * the component recomputes the status badge from it.
 */
export const toggleCouponActive = createAsyncThunk<
  { couponId: string; isActive: boolean },
  { couponId: string; isActive: boolean },
  { rejectValue: string }
>('coupons/toggleActive', async ({ couponId, isActive }, { rejectWithValue }) => {
  try {
    await updateDoc(doc(db, FirestoreCollections.coupons, couponId), {
      isActive,
      updatedAt: serverTimestamp(),
    });
    return { couponId, isActive };
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not update coupon');
  }
});
