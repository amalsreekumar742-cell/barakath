import { createAsyncThunk } from '@reduxjs/toolkit';
import { collection, query, where, getCountFromServer } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import { ReplacementStatus } from '@barakath/shared/config/enums';
import { db } from '@/lib/firebaseConfig';
import type { ReplacementStatusCounts } from '../types';

/**
 * fetchReplacementStatusCounts — the numbers on the Replacement status tabs (spec §1.10): one
 * aggregation query per status plus a total.
 *
 * WHY getCountFromServer (not reading docs): the tab badges need collection-wide counts, not just the
 * loaded page — server-side counts are cheap, exact, and bill a fraction of a full read.
 */
export const fetchReplacementStatusCounts = createAsyncThunk<
  ReplacementStatusCounts,
  void,
  { rejectValue: string }
>('replacement/fetchStatusCounts', async (_, { rejectWithValue }) => {
  try {
    const replacements = collection(db, FirestoreCollections.replacements);
    const byStatus = (s: string) => getCountFromServer(query(replacements, where('status', '==', s)));

    const [all, pending, approved, rejected] = await Promise.all([
      getCountFromServer(replacements),
      byStatus(ReplacementStatus.PENDING),
      byStatus(ReplacementStatus.APPROVED),
      byStatus(ReplacementStatus.REJECTED),
    ]);

    return {
      all: all.data().count,
      pending: pending.data().count,
      approved: approved.data().count,
      rejected: rejected.data().count,
    };
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not load replacement counts');
  }
});
