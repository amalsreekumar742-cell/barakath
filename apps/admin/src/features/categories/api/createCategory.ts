import { createAsyncThunk } from '@reduxjs/toolkit';
import { collection, doc, getDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import keywordsBuilder from '@barakath/shared/utils/keywordsBuilder';
import type { CategoryProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';
import { uploadImage } from '@/utils/imageUpload';

/**
 * createCategory — creates a category doc plus a document per sub-category (spec §1.4).
 *
 * WHY a writeBatch: the category doc and its initial sub-category docs are written atomically — either
 * all land or none, so we never leave a category with a partial/inconsistent sub-category set.
 * WHY sub-categories are their own docs (subcollection `categories/{id}/subCategories`): each needs a
 * stable id (products reference `subCategoryId`) and its own searchable `keywords`. The category doc
 * also stores a denormalized `subCategoryNames` for fast list rendering.
 * WHY direct client write (not a Cloud Function): categories are admin-only, non-financial catalogue
 * data fully constrained by Security Rules (admin claim) — the skill permits direct writes here.
 */
export const createCategory = createAsyncThunk<
  CategoryProps,
  { name: string; subCategoryNames: string[]; imageFile: File | Blob },
  { rejectValue: string }
>('categories/create', async ({ name, subCategoryNames, imageFile }, { rejectWithValue }) => {
  try {
    const categoryRef = doc(collection(db, FirestoreCollections.categories));
    const image = await uploadImage(imageFile, `categories/${categoryRef.id}/image`);

    const batch = writeBatch(db);
    batch.set(categoryRef, {
      name: name.trim(),
      image,
      subCategoryNames,
      productCount: 0,
      keywords: keywordsBuilder(name),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    for (const subName of subCategoryNames) {
      const subRef = doc(
        collection(db, FirestoreCollections.categories, categoryRef.id, FirestoreCollections.subCategories),
      );
      batch.set(subRef, {
        mainCategoryId: categoryRef.id,
        name: subName,
        keywords: keywordsBuilder(subName),
        createdAt: serverTimestamp(),
      });
    }
    await batch.commit();

    const snap = await getDoc(categoryRef);
    return { ...snap.data(), id: categoryRef.id } as CategoryProps;
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not create category');
  }
});
