import { createAsyncThunk } from '@reduxjs/toolkit';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import { db } from '@/lib/firebaseConfig';

/**
 * toggleReviewPublish — publish or hide a single review (spec §1.11: admin can hide/show later; hidden
 * reviews are not shown on app/website and are excluded from the product's averageRating recompute).
 *
 * WHY a direct updateDoc (not a Cloud Function): this flips one non-financial boolean on a doc the admin
 * is authorised to write (gated by the `admin` claim in Security Rules). Returns the id + new value so
 * the slice patches the list row and adjusts the published/hidden stat counts without a refetch.
 */
export const toggleReviewPublish = createAsyncThunk<
  { reviewId: string; isPublished: boolean },
  { reviewId: string; isPublished: boolean },
  { rejectValue: string }
>('reviews/togglePublish', async ({ reviewId, isPublished }, { rejectWithValue }) => {
  try {
    await updateDoc(doc(db, FirestoreCollections.reviews, reviewId), {
      isPublished,
      updatedAt: serverTimestamp(),
    });
    return { reviewId, isPublished };
  } catch (err) {
    return rejectWithValue(
      err instanceof Error ? err.message : `Could not ${isPublished ? 'publish' : 'hide'} review`,
    );
  }
});
