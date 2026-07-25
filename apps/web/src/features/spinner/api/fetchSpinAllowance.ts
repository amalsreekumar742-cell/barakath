import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  Timestamp,
  collection,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared';
import { db } from '@/lib/firebaseConfig';

export interface SpinAllowanceArgs {
  campaignId: string;
  uid: string;
  /** `campaign.maxSpinsPerUser` — a LIFETIME cap, not a daily one (WEB_BATCH4_NOTES.md §8, confirmed
   *  directly against `spinWheel.ts`: there is no `spinUsage` sub-collection or date-string keying). */
  maxSpinsPerUser: number;
  /** `campaign.spinCooldownHours` — 0 means no cooldown between spins. */
  cooldownHours: number;
}

export interface SpinAllowanceResult {
  spinsRemaining: number;
  /** Epoch millis when the next spin becomes available, or null when one is available right now. */
  nextSpinAt: number | null;
}

/**
 * Computes "spins remaining" the exact same way `spinWheel.ts` itself does, so the button's disabled
 * state agrees with what the callable will actually accept:
 *   spinsRemaining = maxSpinsPerUser - count(spinHistory where campaignId==X and userId==uid)
 * plus, when a cooldown applies, the timestamp of the user's own last spin (only reachable per
 * `firestore.rules`'s `spinHistory` rule, which scopes reads to `resource.data.userId == request.auth.uid`).
 *
 * WHY this is a client-side UX hint, not the real gate: `spinWheel` re-derives both numbers itself
 * from the Admin SDK before minting anything, and throws a human-readable `failed-precondition`
 * ("Maximum spins reached" / "Please wait N hours") if this client-side read is ever stale. A miscount
 * here only affects how the button LOOKS, never whether an unearned spin can actually happen.
 *
 * WHY `getCountFromServer` and not fetch-all-and-count: the web skill mandates aggregation queries for
 * any count — this reads one summary value, not one document per historical spin.
 */
export const fetchSpinAllowance = createAsyncThunk<SpinAllowanceResult, SpinAllowanceArgs>(
  'spinner/fetchSpinAllowance',
  async ({ campaignId, uid, maxSpinsPerUser, cooldownHours }) => {
    const userSpins = query(
      collection(db, FirestoreCollections.spinHistory),
      where('campaignId', '==', campaignId),
      where('userId', '==', uid),
    );

    const countSnap = await getCountFromServer(userSpins);
    const spinCount = countSnap.data().count;
    const spinsRemaining = Math.max(0, maxSpinsPerUser - spinCount);

    let nextSpinAt: number | null = null;
    if (cooldownHours > 0 && spinCount > 0 && spinsRemaining > 0) {
      const lastSnap = await getDocs(query(userSpins, orderBy('createdAt', 'desc'), limit(1)));
      const lastAt = lastSnap.docs[0]?.get('createdAt') as Timestamp | undefined;
      if (lastAt) {
        const readyAt = lastAt.toMillis() + cooldownHours * 3_600_000;
        if (readyAt > Date.now()) nextSpinAt = readyAt;
      }
    }

    return { spinsRemaining, nextSpinAt };
  },
);
