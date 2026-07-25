import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  collection,
  doc,
  query,
  where,
  getCountFromServer,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { ref as storageRef, deleteObject } from 'firebase/storage';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import { db, storage } from '@/lib/firebaseConfig';

/**
 * deleteCategory — hard-delete a category, its sub-category docs and its image (spec §1.4).
 *
 * WHY the product-count guard FIRST: a category with products must not be deleted ("Delete products
 * first"). Only when the count is 0 do we hard-delete. WHY also delete the subcollection docs:
 * Firestore does NOT cascade subcollection deletes, so we batch-delete every `subCategories` doc with
 * the category — otherwise they'd be orphaned (the confirm copy promises they're removed).
 * WHY swallow the image-delete error: the docs are the source of truth; a missing image shouldn't fail.
 */
export const deleteCategory = createAsyncThunk<string, string, { rejectValue: string }>(
  'categories/delete',
  async (categoryId, { rejectWithValue }) => {
    try {
      const countSnap = await getCountFromServer(
        query(
          collection(db, FirestoreCollections.products),
          where('categoryId', '==', categoryId),
        ),
      );
      if (countSnap.data().count > 0) {
        return rejectWithValue('Delete products first before deleting this category');
      }

      const subSnap = await getDocs(
        collection(db, FirestoreCollections.categories, categoryId, FirestoreCollections.subCategories),
      );
      const batch = writeBatch(db);
      subSnap.docs.forEach((d) => batch.delete(d.ref));
      batch.delete(doc(db, FirestoreCollections.categories, categoryId));
      await batch.commit();

      try {
        await deleteObject(storageRef(storage, `categories/${categoryId}/image`));
      } catch {
        /* image may not exist — ignore */
      }
      return categoryId;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Could not delete category');
    }
  },
);
