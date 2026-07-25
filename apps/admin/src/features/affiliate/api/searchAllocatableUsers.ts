import { createAsyncThunk } from '@reduxjs/toolkit';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { UserProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';
import { Constants } from '@/config/constants';

/**
 * searchAllocatableUsers — debounced customer search for the Allocate Affiliate modal (spec §1.14
 * "Search customer by name/phone"). Returns only users who do NOT already have an affiliate code, since
 * allocation is a one-time action.
 *
 * WHY keywords + client filter: Firestore has no case-insensitive contains, so we match the precomputed
 * `keywords` array (name / email / phone). We cannot ALSO add `where('affiliateCode','==','')` in the
 * same query without an extra composite index and it would still return already-allocated users if the
 * empty-string sentinel drifts — so we filter out users with a non-empty `affiliateCode` client-side on
 * the small (capped) result set. Bounded by `limit(PAGE_SIZE)`: a dropdown never needs more than a page,
 * and the admin refines the term to narrow results.
 */
export const searchAllocatableUsers = createAsyncThunk<UserProps[], string, { rejectValue: string }>(
  'affiliate/searchAllocatableUsers',
  async (term, { rejectWithValue }) => {
    try {
      const t = term.trim().toLowerCase();
      if (!t) return [];
      const snap = await getDocs(
        query(
          collection(db, FirestoreCollections.users),
          where('keywords', 'array-contains', t),
          orderBy('createdAt', 'desc'),
          limit(Constants.PAGE_SIZE),
        ),
      );
      return snap.docs
        .map((d) => ({ ...d.data(), id: d.id }) as UserProps)
        .filter((u) => (u.affiliateCode ?? '') === '');
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Could not search customers');
    }
  },
);
