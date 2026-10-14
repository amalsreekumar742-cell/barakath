import { createAsyncThunk } from '@reduxjs/toolkit';
import { collection, doc, getDoc, getDocs, query, orderBy } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import { sortVariants } from '@barakath/shared/utils/sortVariants';
import type { ProductProps, VariantProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';

/**
 * fetchProductDetail — a product plus its variant documents (spec §1.5, for the edit page).
 * WHY read variants from the subcollection: variants live under `products/{id}/variants`, returned in
 * the admin's saved order (`sortOrder`) so the form opens with the rows exactly as they were left.
 *
 * WHY query by `createdAt` and sort in memory rather than `orderBy('sortOrder')`: Firestore drops
 * documents that lack the orderBy field, and variants saved before reordering existed have no
 * `sortOrder` — they would vanish from the form, and the next save would DELETE them as "removed".
 * `sortVariants` keeps those after the ordered ones, in creation order.
 */
export const fetchProductDetail = createAsyncThunk<
  { product: ProductProps; variants: VariantProps[] },
  string,
  { rejectValue: string }
>('products/fetchDetail', async (productId, { rejectWithValue }) => {
  try {
    const snap = await getDoc(doc(db, FirestoreCollections.products, productId));
    if (!snap.exists()) return rejectWithValue('Product not found');
    const product = { ...snap.data(), id: snap.id } as ProductProps;

    const varSnap = await getDocs(
      query(
        collection(db, FirestoreCollections.products, productId, FirestoreCollections.variants),
        orderBy('createdAt', 'asc'),
      ),
    );
    const variants = sortVariants(varSnap.docs.map((d) => ({ ...d.data(), id: d.id }) as VariantProps));

    return { product, variants };
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not load product');
  }
});
