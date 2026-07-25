import { createAsyncThunk } from '@reduxjs/toolkit';
import { collection, doc, getDoc, writeBatch, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import keywordsBuilder from '@barakath/shared/utils/keywordsBuilder';
import type { SubCategoryProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';

/**
 * addSubCategory — create a sub-category document and denormalize its name onto the category (spec §1.4).
 *
 * WHY a batch: the new sub-category doc and the category's `subCategoryNames` update land atomically,
 * so the denormalized list can't drift from the subcollection.
 * WHY arrayUnion for the name: idempotent append (a duplicate name is a no-op) with no read-modify-write
 * race on the category doc.
 */
export const addSubCategory = createAsyncThunk<
  { categoryId: string; subCategory: SubCategoryProps },
  { categoryId: string; subCategoryName: string },
  { rejectValue: string }
>('categories/addSubCategory', async ({ categoryId, subCategoryName }, { rejectWithValue }) => {
  try {
    const name = subCategoryName.trim();
    const subRef = doc(
      collection(db, FirestoreCollections.categories, categoryId, FirestoreCollections.subCategories),
    );
    const categoryRef = doc(db, FirestoreCollections.categories, categoryId);

    const batch = writeBatch(db);
    batch.set(subRef, {
      mainCategoryId: categoryId,
      name,
      keywords: keywordsBuilder(name),
      createdAt: serverTimestamp(),
    });
    batch.update(categoryRef, { subCategoryNames: arrayUnion(name), updatedAt: serverTimestamp() });
    await batch.commit();

    const snap = await getDoc(subRef);
    return { categoryId, subCategory: { ...snap.data(), id: subRef.id } as SubCategoryProps };
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not add sub-category');
  }
});
