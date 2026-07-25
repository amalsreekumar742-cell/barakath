import { createAsyncThunk } from '@reduxjs/toolkit';
import { doc, deleteDoc } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import { db } from '@/lib/firebaseConfig';
import { deleteBannerImage } from '../utils/bannerImage';

/**
 * deleteBanner — hard-delete a banner doc AND its Storage image (spec §1.15 hard delete; §1.22 hard deletes
 * throughout, with a confirmation dialog + toast handled in the component).
 *
 * WHY delete the image too (best-effort): the doc is the source of truth for the banner existing, but the
 * `banners/{id}/image` object would otherwise be orphaned and keep billing storage. deleteBannerImage
 * swallows its own errors (try/catch inside) so a missing/already-deleted object never fails the delete.
 * WHY it returns the id: the slice removes the row from the list in place without a re-fetch.
 */
export const deleteBanner = createAsyncThunk<string, string, { rejectValue: string }>(
  'banners/delete',
  async (bannerId, { rejectWithValue }) => {
    try {
      await deleteDoc(doc(db, FirestoreCollections.banners, bannerId));
      await deleteBannerImage(bannerId); // best-effort Storage cleanup
      return bannerId;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Could not delete banner');
    }
  },
);
