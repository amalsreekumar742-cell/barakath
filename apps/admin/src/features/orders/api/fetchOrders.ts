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
import type { OrderProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';
import { Constants } from '@/config/constants';
import type { OrderFilters } from '../types';

export interface OrdersPageResult {
  items: OrderProps[];
  lastVisible: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- Firestore cursor
  hasMore: boolean;
}

/** Order-doc constraints for the active filters (spec §1.7). */
export function orderFilterConstraints(filters: OrderFilters): QueryConstraint[] {
  const c: QueryConstraint[] = [];
  if (filters.status) c.push(where('status', '==', filters.status));
  if (filters.searchTerm.trim())
    c.push(where('keywords', 'array-contains', filters.searchTerm.trim().toLowerCase()));
  if (filters.dateFrom) c.push(where('createdAt', '>=', filters.dateFrom));
  if (filters.dateTo) c.push(where('createdAt', '<=', filters.dateTo));
  return c;
}

/**
 * fetchOrders — one cursor-paginated page of orders with the active filters (spec §1.7; skill mandatory
 * pagination). Newest first. Search runs on the order `keywords` (order id / customer / phone); status
 * tab + date range run server-side. `hasMore = items.length === PAGE_SIZE`.
 */
export const fetchOrders = createAsyncThunk<
  OrdersPageResult,
  { filters: OrderFilters; cursor?: QueryDocumentSnapshot | null },
  { rejectValue: string }
>('orders/fetchPage', async ({ filters, cursor }, { rejectWithValue }) => {
  try {
    const snap = await getDocs(
      query(
        collection(db, FirestoreCollections.orders),
        ...orderFilterConstraints(filters),
        orderBy('createdAt', 'desc'),
        ...(cursor ? [startAfter(cursor)] : []),
        limit(Constants.PAGE_SIZE),
      ),
    );
    const items = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as OrderProps);
    return {
      items,
      lastVisible: snap.docs[snap.docs.length - 1] ?? null,
      hasMore: items.length === Constants.PAGE_SIZE,
    };
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not load orders');
  }
});
