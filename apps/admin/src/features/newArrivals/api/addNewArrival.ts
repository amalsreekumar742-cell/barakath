import { createAsyncThunk } from '@reduxjs/toolkit';
import { doc, updateDoc, getDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { ProductProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';

/**
 * addNewArrival — mark an existing product as a new arrival (spec §1.17: managed via the `isNewArrival`
 * boolean flag, no separate collection). Sets isNewArrival: true + a fresh updatedAt (server-stamped) so
 * the product sorts to the top of the updatedAt-desc list.
 *
 * WHY it re-reads and returns the product: the modal prepends the newly-added product into the list
 * without a full re-fetch, so it needs the full ProductProps (thumbnail, price, category, etc.).
 */
export const addNewArrival = createAsyncThunk<ProductProps, string, { rejectValue: string }>(
  'newArrivals/add',
  async (productId, { rejectWithValue }) => {
    try {
      const ref = doc(db, FirestoreCollections.products, productId);
      await updateDoc(ref, { isNewArrival: true, updatedAt: serverTimestamp() });
      const snap = await getDoc(ref);
      if (!snap.exists()) return rejectWithValue('Product not found');
      // Mirror updatedAt with a client Timestamp so the prepended row is immediately sortable/displayable.
      return { ...snap.data(), id: snap.id, isNewArrival: true, updatedAt: Timestamp.now() } as ProductProps;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Could not add to new arrivals');
    }
  },
);
