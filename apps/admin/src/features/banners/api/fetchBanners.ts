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
import type { BannerProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';
import { Constants } from '@/config/constants';
import type { BannerFilters } from '../types';

export interface BannersPageResult {
  items: BannerProps[];
  lastVisible: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- Firestore cursor
  hasMore: boolean;
}

/**
 * bannerServerConstraints — the where() clauses applied SERVER-side for the active filters (spec §1.15).
 * WHY server-side (not client filtering): placement/status are exact-match equalities Firestore can combine
 * with the `position` ordering via a composite index — so we never over-read and filter in the browser.
 */
function bannerServerConstraints(filters: BannerFilters): QueryConstraint[] {
  const c: QueryConstraint[] = [];
  if (filters.placement !== 'All') c.push(where('placement', '==', filters.placement));
  if (filters.status === 'Active') c.push(where('isActive', '==', true));
  else if (filters.status === 'Inactive') c.push(where('isActive', '==', false));
  return c;
}

/**
 * fetchBanners — one cursor-paginated page of banners for the active filters, ordered by `position` asc
 * (spec §1.15 manual order; skill mandatory pagination). PAGE_SIZE per page, `hasMore = len === PAGE_SIZE`.
 *
 * WHY orderBy('position') (not createdAt): banners are manually reorderable, so `position` is the
 * authoritative display order — the same order the storefront carousels render.
 * WHY `lastVisible: any`: the cursor is a QueryDocumentSnapshot fed straight back into startAfter; typing
 * it `any` here is the one accepted `any` (skill) — it never leaves the store.
 */
export const fetchBanners = createAsyncThunk<
  BannersPageResult,
  { filters: BannerFilters; cursor?: QueryDocumentSnapshot | null },
  { rejectValue: string }
>('banners/fetchPage', async ({ filters, cursor }, { rejectWithValue }) => {
  try {
    const snap = await getDocs(
      query(
        collection(db, FirestoreCollections.banners),
        ...bannerServerConstraints(filters),
        orderBy('position', 'asc'),
        ...(cursor ? [startAfter(cursor)] : []),
        limit(Constants.PAGE_SIZE),
      ),
    );
    const items = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as BannerProps);
    return {
      items,
      lastVisible: snap.docs[snap.docs.length - 1] ?? null,
      hasMore: items.length === Constants.PAGE_SIZE,
    };
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not load banners');
  }
});
