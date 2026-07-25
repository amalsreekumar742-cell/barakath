import { createAsyncThunk } from '@reduxjs/toolkit';
import { doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import { db } from '@/lib/firebaseConfig';

/**
 * reorderBanners — persist a new manual order for banners (spec §1.15 Move up / Move down).
 *
 * WHY a writeBatch of `position = index`: reordering must be atomic — either every affected banner's new
 * position lands or none does, so the list can never end up with duplicate/gapped positions. The caller
 * passes the FULL desired order (`bannerIds` in their new sequence, position 1-based by index); we rewrite
 * each doc's `position` in one batch (like the orders status batch pattern).
 * WHY 1-based (index + 1): matches createBanner's `count + 1` so a freshly created banner and a reordered
 * one share the same 1..N positioning scheme.
 * WHY it returns bannerIds: the slice reorders its in-memory list + rewrites positions to match, so the UI
 * reflects the new order without a re-fetch. The "Banner order updated" toast is fired by the component.
 */
export const reorderBanners = createAsyncThunk<
  { bannerIds: string[] },
  { bannerIds: string[] },
  { rejectValue: string }
>('banners/reorder', async ({ bannerIds }, { rejectWithValue }) => {
  try {
    const batch = writeBatch(db);
    bannerIds.forEach((id, index) => {
      batch.update(doc(db, FirestoreCollections.banners, id), {
        position: index + 1,
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
    return { bannerIds };
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not reorder banners');
  }
});
