import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  getCountFromServer,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import keywordsBuilder from '@barakath/shared/utils/keywordsBuilder';
import type { CategoryProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';
import { uploadImage } from '@/utils/imageUpload';

/**
 * updateCategory — edit name/image and reconcile the sub-category documents to match the edited list.
 *
 * WHY diff-then-batch: the edit form hands us the desired sub-category NAMES; we compare against the
 * existing sub-category docs and create the added ones + delete the removed ones in one atomic batch
 * (with the category doc's denormalized `subCategoryNames`). WHY guard removals: a sub-category that
 * still has products can't be removed (spec §1.4) — we count by `subCategoryId` and reject the whole
 * save if any removed sub-category is non-empty, so the category never drifts out of sync.
 */
export const updateCategory = createAsyncThunk<
  CategoryProps,
  { id: string; name: string; subCategoryNames: string[]; imageFile?: File | Blob | null },
  { rejectValue: string }
>('categories/update', async ({ id, name, subCategoryNames, imageFile }, { rejectWithValue }) => {
  try {
    const categoryRef = doc(db, FirestoreCollections.categories, id);
    const subColRef = collection(
      db,
      FirestoreCollections.categories,
      id,
      FirestoreCollections.subCategories,
    );

    const existingSnap = await getDocs(subColRef);
    const existing = existingSnap.docs.map((d) => ({ id: d.id, name: (d.data().name as string) ?? '' }));

    const desired = subCategoryNames.map((n) => n.trim()).filter(Boolean);
    const lower = (s: string) => s.toLowerCase();
    const toAdd = desired.filter((n) => !existing.some((e) => lower(e.name) === lower(n)));
    const toRemove = existing.filter((e) => !desired.some((n) => lower(n) === lower(e.name)));

    // Guard: a removed sub-category with products blocks the save.
    for (const rem of toRemove) {
      const countSnap = await getCountFromServer(
        query(collection(db, FirestoreCollections.products), where('subCategoryId', '==', rem.id)),
      );
      if (countSnap.data().count > 0) {
        return rejectWithValue(`Delete products in "${rem.name}" first`);
      }
    }

    const image = imageFile ? await uploadImage(imageFile, `categories/${id}/image`) : undefined;

    const batch = writeBatch(db);
    batch.update(categoryRef, {
      name: name.trim(),
      subCategoryNames: desired,
      keywords: keywordsBuilder(name),
      updatedAt: serverTimestamp(),
      ...(image ? { image } : {}),
    });
    for (const n of toAdd) {
      batch.set(doc(subColRef), {
        mainCategoryId: id,
        name: n,
        keywords: keywordsBuilder(n),
        createdAt: serverTimestamp(),
      });
    }
    for (const rem of toRemove) {
      batch.delete(doc(subColRef, rem.id));
    }
    await batch.commit();

    const snap = await getDoc(categoryRef);
    return { ...snap.data(), id } as CategoryProps;
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not update category');
  }
});
