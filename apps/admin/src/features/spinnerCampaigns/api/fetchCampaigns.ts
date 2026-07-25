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
import type { SpinnerCampaignProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';
import { Constants } from '@/config/constants';
import type { CampaignFilters } from '../types';

export interface CampaignsPageResult {
  items: SpinnerCampaignProps[];
  lastVisible: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- Firestore cursor
  hasMore: boolean;
}

/**
 * campaignServerConstraints — the where() clauses that run SERVER-side for the active filters (spec F13).
 * WHY split server vs client: "Active" and "Ended" both share `isActive == true` server-side and only
 * differ by whether `endDate` is in the future/past — Firestore can't combine that inequality with the
 * createdAt ordering without a second range field, so the endDate check is applied client-side below.
 * Search runs on the precomputed `keywords` array (skill: no client-side scan-and-filter for search).
 */
function campaignServerConstraints(filters: CampaignFilters): QueryConstraint[] {
  const c: QueryConstraint[] = [];
  if (filters.searchTerm.trim()) {
    c.push(where('keywords', 'array-contains', filters.searchTerm.trim().toLowerCase()));
  }
  if (filters.status === 'Active' || filters.status === 'Ended') c.push(where('isActive', '==', true));
  else if (filters.status === 'Inactive') c.push(where('isActive', '==', false));
  return c;
}

/**
 * fetchCampaigns — one cursor-paginated page of spinner campaigns for the active filters (spec F13; skill
 * mandatory pagination). Newest first, PAGE_SIZE per page, `hasMore = items.length === PAGE_SIZE`.
 *
 * CAVEAT: for the "Active"/"Ended" pills the endDate>now / endDate<=now split is filtered client-side
 * AFTER the page is read, so a page can return fewer than PAGE_SIZE visible rows even when more matching
 * docs exist further down. We keep this simple (filter the page, rely on "View More") rather than looping
 * pages here — the cursor is still the last RAW doc so paging stays correct.
 */
export const fetchCampaigns = createAsyncThunk<
  CampaignsPageResult,
  { filters: CampaignFilters; cursor?: QueryDocumentSnapshot | null },
  { rejectValue: string }
>('spinnerCampaigns/fetchPage', async ({ filters, cursor }, { rejectWithValue }) => {
  try {
    const snap = await getDocs(
      query(
        collection(db, FirestoreCollections.spinnerCampaigns),
        ...campaignServerConstraints(filters),
        orderBy('createdAt', 'desc'),
        ...(cursor ? [startAfter(cursor)] : []),
        limit(Constants.PAGE_SIZE),
      ),
    );
    const raw = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as SpinnerCampaignProps);

    // Client-side endDate split for the Active/Ended pills (see CAVEAT above).
    const now = Timestamp.now();
    const items =
      filters.status === 'Active'
        ? raw.filter((c) => c.endDate.toMillis() > now.toMillis())
        : filters.status === 'Ended'
          ? raw.filter((c) => c.endDate.toMillis() <= now.toMillis())
          : raw;

    return {
      items,
      // Cursor is the last RAW doc (not the last visible one) so pagination advances correctly.
      lastVisible: snap.docs[snap.docs.length - 1] ?? null,
      hasMore: raw.length === Constants.PAGE_SIZE,
    };
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not load campaigns');
  }
});
