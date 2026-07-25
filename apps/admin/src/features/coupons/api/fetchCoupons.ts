import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  Timestamp,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { CouponProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';
import { Constants } from '@/config/constants';
import type { CouponFilters } from '../types';

export interface CouponsPageResult {
  items: CouponProps[];
  lastVisible: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- Firestore cursor
  hasMore: boolean;
}

/**
 * couponServerConstraints — the where() clauses that run SERVER-side for the active filters (spec §1.12).
 * WHY split server vs client: "Active" and "Expired" both share `isActive == true` server-side and only
 * differ by whether `validUntil` is in the future/past — Firestore can't combine that inequality with the
 * createdAt ordering without a second range field, so the validUntil check is applied client-side below.
 * Search runs on the precomputed `keywords` array (skill: no client-side scan-and-filter for search).
 */
function couponServerConstraints(filters: CouponFilters): QueryConstraint[] {
  const c: QueryConstraint[] = [];
  if (filters.searchTerm.trim()) {
    c.push(where('keywords', 'array-contains', filters.searchTerm.trim().toLowerCase()));
  }
  if (filters.status === 'Active' || filters.status === 'Expired') c.push(where('isActive', '==', true));
  else if (filters.status === 'Inactive') c.push(where('isActive', '==', false));
  return c;
}

/**
 * fetchCoupons — one cursor-paginated page of coupons for the active filters (spec §1.12; skill mandatory
 * pagination). Newest first, PAGE_SIZE per page, `hasMore = items.length === PAGE_SIZE`.
 *
 * CAVEAT: for the "Active"/"Expired" tabs the validUntil>now / validUntil<=now split is filtered
 * client-side AFTER the page is read, so a page can return fewer than PAGE_SIZE visible rows even when
 * more matching docs exist further down. We keep this simple (filter the page, rely on "View More") rather
 * than looping pages here — the cursor is still the last RAW doc so paging stays correct. A future
 * optimisation could loop until the page fills, but View More already covers the UX.
 */
export const fetchCoupons = createAsyncThunk<
  CouponsPageResult,
  { filters: CouponFilters; cursor?: QueryDocumentSnapshot | null },
  { rejectValue: string }
>('coupons/fetchPage', async ({ filters, cursor }, { rejectWithValue }) => {
  try {
    const snap = await getDocs(
      query(
        collection(db, FirestoreCollections.coupons),
        ...couponServerConstraints(filters),
        orderBy('createdAt', 'desc'),
        ...(cursor ? [startAfter(cursor)] : []),
        limit(Constants.PAGE_SIZE),
      ),
    );
    const raw = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as CouponProps);

    // Client-side validity split for the Active/Expired tabs (see CAVEAT above).
    const now = Timestamp.now();
    const items =
      filters.status === 'Active'
        ? raw.filter((c) => c.validUntil.toMillis() > now.toMillis())
        : filters.status === 'Expired'
          ? raw.filter((c) => c.validUntil.toMillis() <= now.toMillis())
          : raw;

    return {
      items,
      // Cursor is the last RAW doc (not the last visible one) so pagination advances correctly.
      lastVisible: snap.docs[snap.docs.length - 1] ?? null,
      hasMore: raw.length === Constants.PAGE_SIZE,
    };
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not load coupons');
  }
});
