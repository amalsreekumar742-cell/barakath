import { createAsyncThunk } from '@reduxjs/toolkit';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import { db } from '@/lib/firebaseConfig';

/**
 * removeAdminResponse — clear the admin reply on a review (spec §1.11).
 *
 * WHY set to '' (not delete the field): the model treats `adminResponse` as an always-present string, so
 * an empty value means "no response" consistently across the app/website reads. Returns the id so the
 * slice clears the response on the list row in place.
 */
export const removeAdminResponse = createAsyncThunk<string, string, { rejectValue: string }>(
  'reviews/removeResponse',
  async (reviewId, { rejectWithValue }) => {
    try {
      await updateDoc(doc(db, FirestoreCollections.reviews, reviewId), {
        adminResponse: '',
        updatedAt: serverTimestamp(),
      });
      return reviewId;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Could not remove response');
    }
  },
);
