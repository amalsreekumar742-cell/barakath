import { createAsyncThunk } from '@reduxjs/toolkit';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import { POLICY_LIST_LIMIT } from '@barakath/shared/config/policies';
import type { PolicyProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';

/**
 * fetchPolicies — every policy (enabled AND disabled) in display order, for Settings › Policies.
 *
 * WHY one bounded read instead of cursor pagination: the store may hold at most POLICY_LIST_LIMIT
 * policies (savePolicy enforces the cap), and the list is reordered by swapping neighbours — paging it
 * would hide the neighbour a ▲/▼ needs. `limit(POLICY_LIST_LIMIT)` is the skill's "bounded config
 * read" exception, so the read can never grow unbounded even if the cap were bypassed.
 *
 * WHY no `status` filter: the admin manages hidden policies too (rules let an admin read every doc).
 * The slice re-sorts with a name tie-break; Firestore orders ties by doc id.
 */
export const fetchPolicies = createAsyncThunk<PolicyProps[], void, { rejectValue: string }>(
  'settings/fetchPolicies',
  async (_, { rejectWithValue }) => {
    try {
      const snap = await getDocs(
        query(collection(db, FirestoreCollections.policies), orderBy('order'), limit(POLICY_LIST_LIMIT)),
      );
      return snap.docs.map((d) => ({ ...d.data(), id: d.id }) as PolicyProps);
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Could not load policies');
    }
  },
);
