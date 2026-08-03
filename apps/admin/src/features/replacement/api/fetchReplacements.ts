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
import type { ReplacementProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';
import { Constants } from '@/config/constants';
import type { ReplacementFilters } from '../types';

export interface ReplacementsPageResult {
  items: ReplacementProps[];
  lastVisible: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- Firestore cursor
  hasMore: boolean;
}

/**
 * replacementFilterConstraints — the `where(...)` clauses for the active filters (spec §1.10). Exported
 * so the counts query (or any future reuse) applies the SAME status/search logic as the list, keeping
 * the two in lockstep. Status maps to an equality; search runs on the precomputed `keywords` field.
 */
export function replacementFilterConstraints(filters: ReplacementFilters): QueryConstraint[] {
  const c: QueryConstraint[] = [];
  if (filters.status) c.push(where('status', '==', filters.status));
  if (filters.searchTerm.trim())
    c.push(where('keywords', 'array-contains', filters.searchTerm.trim().toLowerCase()));
  return c;
}

/**
 * fetchReplacements — one cursor-paginated page of replacement requests for the active filters (spec
 * §1.10; skill mandatory pagination). Newest first. The status tab + search run server-side; the search
 * matches the `keywords` array (customer name / phone). `hasMore = items.length === PAGE_SIZE`.
 */
export const fetchReplacements = createAsyncThunk<
  ReplacementsPageResult,
  { filters: ReplacementFilters; cursor?: QueryDocumentSnapshot | null },
  { rejectValue: string }
>('replacement/fetchPage', async ({ filters, cursor }, { rejectWithValue }) => {
  try {
    const snap = await getDocs(
      query(
        collection(db, FirestoreCollections.replacements),
        ...replacementFilterConstraints(filters),
        orderBy('createdAt', 'desc'),
        ...(cursor ? [startAfter(cursor)] : []),
        limit(Constants.PAGE_SIZE),
      ),
    );
    const items = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as ReplacementProps);
    return {
      items,
      lastVisible: snap.docs[snap.docs.length - 1] ?? null,
      hasMore: items.length === Constants.PAGE_SIZE,
    };
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not load return requests');
  }
});
