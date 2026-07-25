import { createAsyncThunk } from '@reduxjs/toolkit';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import { db } from '@/lib/firebaseConfig';

/**
 * addAdminResponse — attach (or overwrite) the admin's public reply to a review (spec §1.11).
 *
 * WHY a direct updateDoc: writes one text field on an admin-writable doc (gated by the `admin` claim).
 * Returns the id + text so the slice patches the list row in place without a refetch.
 */
export const addAdminResponse = createAsyncThunk<
  { reviewId: string; adminResponse: string },
  { reviewId: string; adminResponse: string },
  { rejectValue: string }
>('reviews/addResponse', async ({ reviewId, adminResponse }, { rejectWithValue }) => {
  try {
    await updateDoc(doc(db, FirestoreCollections.reviews, reviewId), {
      adminResponse,
      updatedAt: serverTimestamp(),
    });
    return { reviewId, adminResponse };
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not add response');
  }
});
