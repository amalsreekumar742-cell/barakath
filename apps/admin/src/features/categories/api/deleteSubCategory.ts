import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  collection,
  doc,
  query,
  where,
  getCountFromServer,
  writeBatch,
  arrayRemove,
  serverTimestamp,
} from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import { db } from '@/lib/firebaseConfig';

/**
 * deleteSubCategory — delete a sub-category document, guarded by its product count (spec §1.4).
 *
 * WHY count by `subCategoryId` (the doc id, not the name): rename-safe and exact. A sub-category with
 * products can't be deleted ("Delete products in this sub-category first"). WHY a batch: the doc delete
 * and the category's `subCategoryNames` arrayRemove land atomically.
 */
export const deleteSubCategory = createAsyncThunk<
  { categoryId: string; subCategoryId: string; subCategoryName: string },
  { categoryId: string; subCategoryId: string; subCategoryName: string },
  { rejectValue: string }
>('categories/deleteSubCategory', async ({ categoryId, subCategoryId, subCategoryName }, { rejectWithValue }) => {
  try {
    const countSnap = await getCountFromServer(
      query(collection(db, FirestoreCollections.products), where('subCategoryId', '==', subCategoryId)),
    );
    if (countSnap.data().count > 0) {
      return rejectWithValue('Delete products in this sub-category first');
    }

    const categoryRef = doc(db, FirestoreCollections.categories, categoryId);
    const subRef = doc(
      db,
      FirestoreCollections.categories,
      categoryId,
      FirestoreCollections.subCategories,
      subCategoryId,
    );

    const batch = writeBatch(db);
    batch.delete(subRef);
    batch.update(categoryRef, {
      subCategoryNames: arrayRemove(subCategoryName),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();

    return { categoryId, subCategoryId, subCategoryName };
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not delete sub-category');
  }
});
