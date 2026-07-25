import { createAsyncThunk } from '@reduxjs/toolkit';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import { db } from '@/lib/firebaseConfig';

/**
 * removeNewArrival — clear a product's new-arrival flag (spec §1.17: removing does NOT delete the product,
 * only takes it off the New Arrivals view). Sets isNewArrival: false + a server-stamped updatedAt.
 * WHY it returns the id: the slice filters the row out of the list and decrements the count in place, no
 * re-fetch.
 */
export const removeNewArrival = createAsyncThunk<string, string, { rejectValue: string }>(
  'newArrivals/remove',
  async (productId, { rejectWithValue }) => {
    try {
      await updateDoc(doc(db, FirestoreCollections.products, productId), {
        isNewArrival: false,
        updatedAt: serverTimestamp(),
      });
      return productId;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Could not remove from new arrivals');
    }
  },
);
