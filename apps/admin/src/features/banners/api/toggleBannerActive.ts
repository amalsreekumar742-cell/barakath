import { createAsyncThunk } from '@reduxjs/toolkit';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import { db } from '@/lib/firebaseConfig';

/**
 * toggleBannerActive — flip a banner's `isActive` flag from the list card (spec §1.15 publish toggle).
 * WHY only isActive + updatedAt are written: activation is a single low-risk field flip; nothing else
 * (least-surprise, and it can't disturb position or the schedule). updatedAt is server-stamped.
 * WHY it returns {bannerId, isActive}: the slice patches just that card's flag in place — no re-fetch — and
 * the card recomputes its status dot from it.
 */
export const toggleBannerActive = createAsyncThunk<
  { bannerId: string; isActive: boolean },
  { bannerId: string; isActive: boolean },
  { rejectValue: string }
>('banners/toggleActive', async ({ bannerId, isActive }, { rejectWithValue }) => {
  try {
    await updateDoc(doc(db, FirestoreCollections.banners, bannerId), {
      isActive,
      updatedAt: serverTimestamp(),
    });
    return { bannerId, isActive };
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not update banner');
  }
});
