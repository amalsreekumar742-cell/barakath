import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  startAt,
  endAt,
  getDocs,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { PaymentProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';
import { Constants } from '@/config/constants';
import type { PaymentFilters } from '../types';

export interface PaymentsPageResult {
  items: PaymentProps[];
  lastVisible: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- Firestore cursor
  hasMore: boolean;
}

/** Equality constraints (status / method) applied in every mode; shared with the CSV export. */
export function paymentEqualityConstraints(filters: PaymentFilters): QueryConstraint[] {
  const c: QueryConstraint[] = [];
  if (filters.status) c.push(where('status', '==', filters.status));
  if (filters.method) c.push(where('method', '==', filters.method));
  return c;
}

/**
 * fetchPayments — one cursor-paginated page of payments with the active filters (spec §1.9; skill
 * mandatory pagination). Two modes:
 *  - Default: newest first (`orderBy createdAt desc`) with optional status/method + `createdAt` date range.
 *  - Search: an order-id PREFIX match (`orderBy orderId` + startAt/endAt on the term) with status/method.
 *
 * WHY search switches the ordering: Firestore has no case-insensitive "contains", and PaymentProps has
 * no precomputed `keywords` array, so the affordable server-side option is an order-id prefix range —
 * which requires ordering by that same field. The date range (a second inequality) is dropped in search
 * mode because Firestore allows an inequality on only one field at a time.
 */
export const fetchPayments = createAsyncThunk<
  PaymentsPageResult,
  { filters: PaymentFilters; cursor?: QueryDocumentSnapshot | null },
  { rejectValue: string }
>('payments/fetchPage', async ({ filters, cursor }, { rejectWithValue }) => {
  try {
    const col = collection(db, FirestoreCollections.payments);
    const term = filters.searchTerm.trim();

    const constraints: QueryConstraint[] = [...paymentEqualityConstraints(filters)];
    if (term) {
      // Order-id prefix search: [term, term+]; cursor advances the lower bound on later pages.
      constraints.push(orderBy('orderId'));
      constraints.push(cursor ? startAfter(cursor) : startAt(term));
      constraints.push(endAt(term + ''));
    } else {
      if (filters.dateFrom) constraints.push(where('createdAt', '>=', filters.dateFrom));
      if (filters.dateTo) constraints.push(where('createdAt', '<=', filters.dateTo));
      constraints.push(orderBy('createdAt', 'desc'));
      if (cursor) constraints.push(startAfter(cursor));
    }
    constraints.push(limit(Constants.PAGE_SIZE));

    const snap = await getDocs(query(col, ...constraints));
    const items = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as PaymentProps);
    return {
      items,
      lastVisible: snap.docs[snap.docs.length - 1] ?? null,
      hasMore: items.length === Constants.PAGE_SIZE,
    };
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not load payments');
  }
});
