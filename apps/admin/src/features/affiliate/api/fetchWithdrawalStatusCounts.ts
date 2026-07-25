import { createAsyncThunk } from '@reduxjs/toolkit';
import { collection, query, where, getCountFromServer } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import { AffiliateWithdrawalStatus } from '@barakath/shared/config/enums';
import { db } from '@/lib/firebaseConfig';
import type { WithdrawalStatusCounts } from '../types';

/**
 * fetchWithdrawalStatusCounts — the badge counts on the Withdrawals status pills (All / Pending /
 * Approved / Rejected).
 *
 * WHY aggregation counts (getCountFromServer): each pill needs a collection-wide count, not just the
 * loaded page — server-side counts are cheap and exact (skill: mandatory aggregation). Four counts run
 * in parallel; "All" is the unfiltered collection count.
 */
export const fetchWithdrawalStatusCounts = createAsyncThunk<
  WithdrawalStatusCounts,
  void,
  { rejectValue: string }
>('affiliate/fetchWithdrawalCounts', async (_, { rejectWithValue }) => {
  try {
    const col = collection(db, FirestoreCollections.affiliateWithdrawals);
    const byStatus = (s: string) => getCountFromServer(query(col, where('status', '==', s)));
    const [all, pending, approved, rejected] = await Promise.all([
      getCountFromServer(col),
      byStatus(AffiliateWithdrawalStatus.PENDING),
      byStatus(AffiliateWithdrawalStatus.APPROVED),
      byStatus(AffiliateWithdrawalStatus.REJECTED),
    ]);
    return {
      all: all.data().count,
      pending: pending.data().count,
      approved: approved.data().count,
      rejected: rejected.data().count,
    };
  } catch (err) {
    return rejectWithValue(
      err instanceof Error ? err.message : 'Could not load withdrawal counts',
    );
  }
});
