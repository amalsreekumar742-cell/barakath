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
import { ProductStatus } from '@barakath/shared/config/enums';
import type { ProductProps, VariantProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';
import { Constants } from '@/config/constants';
import type { ProductWithVariants } from '../types';

export interface CommissionProductsResult {
  items: ProductWithVariants[];
  lastVisible: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- Firestore cursor
  hasMore: boolean;
}

/**
 * fetchProductsForCommission — one cursor-paginated page of ACTIVE products, each with its variant
 * subcollection loaded, for the Commissions tab (spec §1.14; skill: mandatory pagination). Optional
 * search runs on the product `keywords` array.
 *
 * WHY fetch variants per product here: each variant's commission is edited in place, so the expandable
 * row needs the full variant list alongside the product. Variants are read in parallel (one read per
 * product on the page) after the product page resolves — bounded because the product page itself is
 * capped at PAGE_SIZE.
 */
export const fetchProductsForCommission = createAsyncThunk<
  CommissionProductsResult,
  { searchTerm: string; cursor?: QueryDocumentSnapshot | null },
  { rejectValue: string }
>('affiliate/fetchCommissionProducts', async ({ searchTerm, cursor }, { rejectWithValue }) => {
  try {
    const term = searchTerm.trim().toLowerCase();
    const constraints: QueryConstraint[] = [where('status', '==', ProductStatus.ACTIVE)];
    if (term) constraints.push(where('keywords', 'array-contains', term));

    const prodSnap = await getDocs(
      query(
        collection(db, FirestoreCollections.products),
        ...constraints,
        orderBy('createdAt', 'desc'),
        ...(cursor ? [startAfter(cursor)] : []),
        limit(Constants.PAGE_SIZE),
      ),
    );
    const products = prodSnap.docs.map((d) => ({ ...d.data(), id: d.id }) as ProductProps);

    // Load each product's variants in parallel (variants live under products/{id}/variants).
    const items: ProductWithVariants[] = await Promise.all(
      products.map(async (p) => {
        const varSnap = await getDocs(
          query(
            collection(db, FirestoreCollections.products, p.id, FirestoreCollections.variants),
            orderBy('createdAt', 'asc'),
          ),
        );
        const variants = varSnap.docs.map((d) => ({ ...d.data(), id: d.id }) as VariantProps);
        return { ...p, variants };
      }),
    );

    return {
      items,
      lastVisible: prodSnap.docs[prodSnap.docs.length - 1] ?? null,
      hasMore: products.length === Constants.PAGE_SIZE,
    };
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not load products');
  }
});
