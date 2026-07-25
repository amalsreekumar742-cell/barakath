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
import type { ReviewProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';
import { Constants } from '@/config/constants';
import type { ReviewFilters } from '../types';

export interface ReviewsPageResult {
  items: ReviewProps[];
  lastVisible: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- Firestore cursor
  hasMore: boolean;
}

/**
 * reviewFilterConstraints — the Firestore constraints for the active review filters (spec §1.11).
 * WHY server-side: publish/rating/search all narrow the query on the server so we never over-fetch.
 * 'Published'→isPublished==true, 'Hidden'→isPublished==false, 'All'→no publish constraint. Search runs
 * on the lowercased `keywords` array (single array-contains — no full-text service in the stack).
 */
export function reviewFilterConstraints(filters: ReviewFilters): QueryConstraint[] {
  const c: QueryConstraint[] = [];
  if (filters.publishStatus === 'Published') c.push(where('isPublished', '==', true));
  else if (filters.publishStatus === 'Hidden') c.push(where('isPublished', '==', false));
  if (typeof filters.rating === 'number') c.push(where('rating', '==', filters.rating));
  if (filters.searchTerm.trim())
    c.push(where('keywords', 'array-contains', filters.searchTerm.trim().toLowerCase()));
  return c;
}

/**
 * fetchReviews — one cursor-paginated page of reviews for the active filters (spec §1.11; skill mandatory
 * pagination). Newest first (`createdAt` desc), PAGE_SIZE per page. `hasMore` is true when a full page
 * came back, meaning another page may exist.
 */
export const fetchReviews = createAsyncThunk<
  ReviewsPageResult,
  { filters: ReviewFilters; cursor?: QueryDocumentSnapshot | null },
  { rejectValue: string }
>('reviews/fetchPage', async ({ filters, cursor }, { rejectWithValue }) => {
  try {
    const snap = await getDocs(
      query(
        collection(db, FirestoreCollections.reviews),
        ...reviewFilterConstraints(filters),
        orderBy('createdAt', 'desc'),
        ...(cursor ? [startAfter(cursor)] : []),
        limit(Constants.PAGE_SIZE),
      ),
    );
    const items = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as ReviewProps);
    return {
      items,
      lastVisible: snap.docs[snap.docs.length - 1] ?? null,
      hasMore: items.length === Constants.PAGE_SIZE,
    };
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not load reviews');
  }
});
