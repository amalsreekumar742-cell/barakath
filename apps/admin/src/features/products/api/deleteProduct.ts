import { createAsyncThunk } from '@reduxjs/toolkit';
import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import { db } from '@/lib/firebaseConfig';
import { deleteStorageFolder } from '@/utils/storageCleanup';

/**
 * deleteProduct — hard-delete a product, its variants and all variant images (spec §1.5, §1.22).
 * WHY delete variant docs in the same batch as the product: Firestore doesn't cascade subcollections,
 * so we enumerate + batch-delete them with the product doc, then purge the product's Storage folder.
 */
export const deleteProduct = createAsyncThunk<string, string, { rejectValue: string }>(
  'products/delete',
  async (productId, { rejectWithValue }) => {
    try {
      const varSnap = await getDocs(
        collection(db, FirestoreCollections.products, productId, FirestoreCollections.variants),
      );
      const batch = writeBatch(db);
      varSnap.docs.forEach((d) => batch.delete(d.ref));
      batch.delete(doc(db, FirestoreCollections.products, productId));
      await batch.commit();

      await deleteStorageFolder(`products/${productId}`);
      return productId;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Could not delete product');
    }
  },
);
