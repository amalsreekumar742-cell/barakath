import { createAsyncThunk } from '@reduxjs/toolkit';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { ReviewProps } from '@barakath/shared/types';
import { db, storage } from '@/lib/firebaseConfig';

/**
 * deleteReview — permanently remove a review (spec §1.11 + §1.22: hard deletes throughout, with
 * confirmation + toast in the UI).
 *
 * WHY read-then-delete: we grab the doc's `photos[]` first so we can also clean up the Storage objects
 * the customer uploaded — leaving them would orphan files and cost storage.
 * WHY best-effort per-photo (each wrapped in try/catch): a missing object, a foreign/CDN URL we can't
 * resolve, or a permission quirk must NOT fail the delete — the review row is already gone from the
 * primary store, so a photo that can't be removed is only a minor leak, not a failed operation.
 */
export const deleteReview = createAsyncThunk<string, string, { rejectValue: string }>(
  'reviews/delete',
  async (reviewId, { rejectWithValue }) => {
    try {
      const refDoc = doc(db, FirestoreCollections.reviews, reviewId);
      const snap = await getDoc(refDoc);
      const photos = (snap.exists() ? (snap.data() as ReviewProps).photos : []) ?? [];

      // Hard delete the review document (the source of truth) first.
      await deleteDoc(refDoc);

      // Then best-effort clean up each uploaded photo; never let one failure fail the whole op.
      await Promise.all(
        photos.map(async (url) => {
          try {
            // `ref(storage, url)` resolves gs:// URIs and Firebase download URLs; a foreign URL throws.
            await deleteObject(ref(storage, url));
          } catch {
            // Ignore: missing object / non-Storage URL / permission — the review is already deleted.
          }
        }),
      );

      return reviewId;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Could not delete review');
    }
  },
);
