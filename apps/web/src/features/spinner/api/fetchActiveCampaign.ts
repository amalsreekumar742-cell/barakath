import { createAsyncThunk } from '@reduxjs/toolkit';
import { Timestamp, collection, getDocs, limit, query, where } from 'firebase/firestore';
import { FirestoreCollections, type SpinnerCampaignProps } from '@barakath/shared';
import { db } from '@/lib/firebaseConfig';

/**
 * Bounded cap on how many `isActive: true` campaigns this reads before picking the live one client-side.
 *
 * WHY a bounded read + client-side date filter, not a composite query: Firestore range/inequality
 * filters are limited to ONE field per query without a matching composite index, and this needs BOTH
 * `startDate <= now` and `now <= endDate`. Admin practice keeps very few campaigns marked active at
 * once (this is a promotional feature, not a growing catalog), so a small, deliberate bound — same
 * pattern as `Constants.MAX_CATEGORIES`/`MAX_BANNERS` — is honest here rather than an unbounded
 * `getDocs`, which the web skill forbids outright.
 */
const MAX_ACTIVE_CAMPAIGNS_SCANNED = 10;

/**
 * Fetches the one spinner campaign that is genuinely live right now (spec §3.14 empty-state gate):
 * `isActive === true` AND `startDate <= now <= endDate` (`SpinnerCampaignProps`, verified directly
 * against `packages/shared/src/types/spinnerCampaign.ts` and `functions/src/growth/spinWheel.ts`'s own
 * identical gate — WEB_BATCH4_NOTES.md §8). Returns `null` when nothing qualifies, which the UI renders
 * as a message-only empty state (spec §3.25) with the wheel hidden — never a 404 or a thrown error.
 */
export const fetchActiveCampaign = createAsyncThunk<SpinnerCampaignProps | null, void>(
  'spinner/fetchActiveCampaign',
  async () => {
    const nowMs = Date.now();
    const snap = await getDocs(
      query(
        collection(db, FirestoreCollections.spinnerCampaigns),
        where('isActive', '==', true),
        limit(MAX_ACTIVE_CAMPAIGNS_SCANNED),
      ),
    );
    const candidates = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as SpinnerCampaignProps);
    const live = candidates.find(
      (c) => c.startDate.toMillis() <= nowMs && nowMs <= (c.endDate as Timestamp).toMillis(),
    );
    return live ?? null;
  },
);
