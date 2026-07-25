import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { ProductProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';
import { Constants } from '@/config/constants';
import type { ProductFilters } from '../types';

export interface ProductsPageResult {
  items: ProductProps[];
  lastVisible: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- Firestore cursor
  hasMore: boolean;
}

/**
 * Builds the shared `where` constraints for a filter set (used by the list AND the CSV export so both
 * apply identical filtering). A search term uses the precomputed `keywords` array (skill: Firestore has
 * no case-insensitive contains — query the keyword field). `totalStock` range powers the price... no:
 * price lives on variants, so priceMin/priceMax are applied client-side by the caller if needed — here
 * we only constrain fields that live on the product doc.
 */
export function productFilterConstraints(filters: ProductFilters): QueryConstraint[] {
  const c: QueryConstraint[] = [];
  if (filters.searchTerm?.trim()) {
    c.push(where('keywords', 'array-contains', filters.searchTerm.trim().toLowerCase()));
  }
  if (filters.categoryId) c.push(where('categoryId', '==', filters.categoryId));
  if (filters.subCategoryId) c.push(where('subCategoryId', '==', filters.subCategoryId));
  if (filters.stockStatus) c.push(where('stockStatus', '==', filters.stockStatus));
  if (filters.productStatus) c.push(where('status', '==', filters.productStatus));
  return c;
}

/**
 * fetchProducts — one cursor-paginated page of products with the active filters (spec §1.5; skill
 * mandatory pagination). WHY startAfter + limit(PAGE_SIZE): reads only the next page (no offset). The
 * slice appends and dedups by id. `hasMore = items.length === PAGE_SIZE`.
 */
export const fetchProducts = createAsyncThunk<
  ProductsPageResult,
  { filters: ProductFilters; cursor?: QueryDocumentSnapshot | null },
  { rejectValue: string }
>('products/fetchPage', async ({ filters, cursor }, { rejectWithValue }) => {
  try {
    const q = query(
      collection(db, FirestoreCollections.products),
      ...productFilterConstraints(filters),
      orderBy('createdAt', 'desc'),
      ...(cursor ? [startAfter(cursor)] : []),
      limit(Constants.PAGE_SIZE),
    );
    const snap = await getDocs(q);
    const items = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as ProductProps);
    return {
      items,
      lastVisible: snap.docs[snap.docs.length - 1] ?? null,
      hasMore: items.length === Constants.PAGE_SIZE,
    };
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not load products');
  }
});
