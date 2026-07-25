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
import type { UserProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';
import { Constants } from '@/config/constants';
import type { CustomerFilters } from '../types';

export interface CustomersPageResult {
  items: UserProps[];
  lastVisible: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- Firestore cursor
  hasMore: boolean;
}

/** User-doc constraints for the active filters (spec §1.8). Shared with the CSV export. */
export function customerFilterConstraints(filters: CustomerFilters): QueryConstraint[] {
  const c: QueryConstraint[] = [];
  if (filters.status) c.push(where('status', '==', filters.status));
  if (filters.searchTerm.trim())
    c.push(where('keywords', 'array-contains', filters.searchTerm.trim().toLowerCase()));
  return c;
}

/**
 * fetchCustomers — one cursor-paginated page of customers with the active filters (spec §1.8; skill
 * mandatory pagination). Newest-registered first. Search runs on the precomputed `keywords` field
 * (name / email / phone); the status pill runs server-side. `hasMore = items.length === PAGE_SIZE`.
 */
export const fetchCustomers = createAsyncThunk<
  CustomersPageResult,
  { filters: CustomerFilters; cursor?: QueryDocumentSnapshot | null },
  { rejectValue: string }
>('customers/fetchPage', async ({ filters, cursor }, { rejectWithValue }) => {
  try {
    const snap = await getDocs(
      query(
        collection(db, FirestoreCollections.users),
        ...customerFilterConstraints(filters),
        orderBy('createdAt', 'desc'),
        ...(cursor ? [startAfter(cursor)] : []),
        limit(Constants.PAGE_SIZE),
      ),
    );
    const items = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as UserProps);
    return {
      items,
      lastVisible: snap.docs[snap.docs.length - 1] ?? null,
      hasMore: items.length === Constants.PAGE_SIZE,
    };
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not load customers');
  }
});
