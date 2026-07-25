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
import type { FlashSaleProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';
import { Constants } from '@/config/constants';
import type { FlashSaleFilters } from '../types';

export interface FlashSalesPageResult {
  items: FlashSaleProps[];
  lastVisible: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- Firestore cursor
  hasMore: boolean;
}

/**
 * flashSaleServerConstraints — the where() clauses that run SERVER-side for the active filters (spec §1.16).
 * Search runs on the precomputed `keywords` array (skill: no client-side scan-and-filter for search).
 */
function flashSaleServerConstraints(filters: FlashSaleFilters): QueryConstraint[] {
  const c: QueryConstraint[] = [];
  if (filters.searchTerm.trim()) {
    c.push(where('keywords', 'array-contains', filters.searchTerm.trim().toLowerCase()));
  }
  return c;
}

/**
 * fetchFlashSales — one cursor-paginated page of flash sales for the active filters (spec §1.16; skill
 * mandatory pagination). Ordered by startDate desc, PAGE_SIZE per page.
 */
export const fetchFlashSales = createAsyncThunk<
  FlashSalesPageResult,
  { filters: FlashSaleFilters; cursor?: QueryDocumentSnapshot | null },
  { rejectValue: string }
>('flashSale/fetchPage', async ({ filters, cursor }, { rejectWithValue }) => {
  try {
    const snap = await getDocs(
      query(
        collection(db, FirestoreCollections.flashSales),
        ...flashSaleServerConstraints(filters),
        orderBy('startDate', 'desc'),
        ...(cursor ? [startAfter(cursor)] : []),
        limit(Constants.PAGE_SIZE),
      ),
    );
    const items = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as FlashSaleProps);

    return {
      items,
      lastVisible: snap.docs[snap.docs.length - 1] ?? null,
      hasMore: items.length === Constants.PAGE_SIZE,
    };
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not load flash sales');
  }
});
