import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { UserProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';
import { Constants } from '@/config/constants';

export interface AffiliateUsersResult {
  items: UserProps[];
  lastVisible: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- Firestore cursor
  hasMore: boolean;
}

/**
 * fetchAffiliateUsers — one cursor-paginated page of affiliate users for the Affiliates tab (spec §1.14;
 * skill: mandatory pagination). An affiliate is a user with a non-empty `affiliateCode`.
 *
 * WHY two query shapes:
 *  - No search term: `where('affiliateCode', '!=', '')` selects affiliates directly. Firestore requires
 *    the first `orderBy` to be on the inequality field, so we order by `affiliateCode` then `createdAt`
 *    desc (newest-allocated first within the code ordering) — needs a composite index.
 *  - With a search term: Firestore CANNOT combine a `!=` inequality with an `array-contains` in one
 *    query. So we query the precomputed `keywords` array (`array-contains`) ordered by `createdAt` desc,
 *    then CLIENT-FILTER the page down to users whose `affiliateCode` is non-empty. This is a deliberate,
 *    documented trade-off: a searched page may return fewer than PAGE_SIZE affiliate rows even when more
 *    exist, but it avoids an impossible compound query and keeps search working. `hasMore` still tracks
 *    the raw page length so "View More" keeps paging the underlying keyword result set.
 */
export const fetchAffiliateUsers = createAsyncThunk<
  AffiliateUsersResult,
  { searchTerm: string; cursor?: QueryDocumentSnapshot | null },
  { rejectValue: string }
>('affiliate/fetchUsers', async ({ searchTerm, cursor }, { rejectWithValue }) => {
  try {
    const users = collection(db, FirestoreCollections.users);
    const term = searchTerm.trim().toLowerCase();

    if (term) {
      // Search path: keyword match ordered by recency; affiliate-gate applied client-side.
      const snap = await getDocs(
        query(
          users,
          where('keywords', 'array-contains', term),
          orderBy('createdAt', 'desc'),
          ...(cursor ? [startAfter(cursor)] : []),
          limit(Constants.PAGE_SIZE),
        ),
      );
      const raw = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as UserProps);
      const items = raw.filter((u) => (u.affiliateCode ?? '') !== '');
      return {
        items,
        lastVisible: snap.docs[snap.docs.length - 1] ?? null,
        // hasMore reflects the RAW page (pre-filter) so paging continues through the keyword set even
        // when this page happened to contain non-affiliate matches.
        hasMore: raw.length === Constants.PAGE_SIZE,
      };
    }

    // Default path: affiliates only, ordered by code then recency (composite index required).
    const snap = await getDocs(
      query(
        users,
        where('affiliateCode', '!=', ''),
        orderBy('affiliateCode', 'asc'),
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
    return rejectWithValue(err instanceof Error ? err.message : 'Could not load affiliates');
  }
});
