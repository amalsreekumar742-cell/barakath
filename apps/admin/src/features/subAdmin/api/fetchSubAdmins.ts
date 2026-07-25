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
import type { SubAdminProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';
import { Constants } from '@/config/constants';
import type { SubAdminFilters } from '../types';

export interface SubAdminsPageResult {
  items: SubAdminProps[];
  lastVisible: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- Firestore cursor
  hasMore: boolean;
}

/**
 * subAdminConstraints — the where() clauses that run SERVER-side for the active filters (spec §1.20).
 * Role and status are single equality filters; search runs on the precomputed `keywords` array
 * (skill: no client-side scan-and-filter for search). All three combine with the createdAt ordering,
 * so a composite index is needed for role+createdAt and status+createdAt (see the wiring report).
 */
function subAdminConstraints(filters: SubAdminFilters): QueryConstraint[] {
  const c: QueryConstraint[] = [];
  if (filters.searchTerm.trim()) {
    c.push(where('keywords', 'array-contains', filters.searchTerm.trim().toLowerCase()));
  }
  if (filters.role !== 'All') c.push(where('role', '==', filters.role));
  if (filters.status !== 'All') c.push(where('status', '==', filters.status));
  return c;
}

/**
 * fetchSubAdmins — one cursor-paginated page of sub-admins for the active filters (spec §1.20 listing;
 * skill mandatory pagination). Newest first, PAGE_SIZE per page, `hasMore = items.length === PAGE_SIZE`.
 *
 * WHY the query lives here: keeps Firestore access with the state that owns it. WHY startAfter(cursor):
 * Firestore has no offset — this reads only the next PAGE_SIZE docs instead of re-reading skipped ones.
 */
export const fetchSubAdmins = createAsyncThunk<
  SubAdminsPageResult,
  { filters: SubAdminFilters; cursor?: QueryDocumentSnapshot | null },
  { rejectValue: string }
>('subAdmin/fetchPage', async ({ filters, cursor }, { rejectWithValue }) => {
  try {
    const snap = await getDocs(
      query(
        collection(db, FirestoreCollections.subAdmins),
        ...subAdminConstraints(filters),
        orderBy('createdAt', 'desc'),
        ...(cursor ? [startAfter(cursor)] : []),
        limit(Constants.PAGE_SIZE),
      ),
    );
    const items = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as SubAdminProps);
    return {
      items,
      lastVisible: snap.docs[snap.docs.length - 1] ?? null,
      hasMore: items.length === Constants.PAGE_SIZE,
    };
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not load sub-admins');
  }
});
