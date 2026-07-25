import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  collection,
  query,
  where,
  getCountFromServer,
  getAggregateFromServer,
  sum,
} from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import {
  AffiliateWithdrawalStatus,
  AffiliateTransactionSource,
  // The affiliate ledger's `type` field shares the Credit/Debit vocabulary with the wallet ledger
  // ('Credit'); reusing this enum avoids inlining the literal and keeps the value single-sourced.
  WalletTransactionType,
} from '@barakath/shared/config/enums';
import { db } from '@/lib/firebaseConfig';
import type { AffiliateStats } from '../types';

/**
 * fetchAffiliateStats — the four summary cards on the Affiliate page (spec §1.14 listing).
 *
 * WHY aggregation queries (getCountFromServer / getAggregateFromServer): counts and sums are computed
 * server-side and only the single figure is transmitted — never fetch-and-total client-side (skill:
 * mandatory aggregation). Four independent aggregates run in parallel:
 *  - Total affiliates = users with a non-empty `affiliateCode` (`!= ''`).
 *  - Total commission paid = sum of `amount` over affiliateTransactions that are referral CREDITS.
 *  - Pending withdrawals = count of affiliateWithdrawals with status Pending.
 *  - Pending amount = sum of `amount` over those same Pending withdrawals.
 */
export const fetchAffiliateStats = createAsyncThunk<AffiliateStats, void, { rejectValue: string }>(
  'affiliate/fetchStats',
  async (_, { rejectWithValue }) => {
    try {
      const users = collection(db, FirestoreCollections.users);
      const txns = collection(db, FirestoreCollections.affiliateTransactions);
      const withdrawals = collection(db, FirestoreCollections.affiliateWithdrawals);

      const [affiliates, commissionPaid, pendingCount, pendingSum] = await Promise.all([
        getCountFromServer(query(users, where('affiliateCode', '!=', ''))),
        getAggregateFromServer(
          query(
            txns,
            where('type', '==', WalletTransactionType.CREDIT),
            where('source', '==', AffiliateTransactionSource.REFERRAL),
          ),
          { total: sum('amount') },
        ),
        getCountFromServer(
          query(withdrawals, where('status', '==', AffiliateWithdrawalStatus.PENDING)),
        ),
        getAggregateFromServer(
          query(withdrawals, where('status', '==', AffiliateWithdrawalStatus.PENDING)),
          { total: sum('amount') },
        ),
      ]);

      return {
        totalAffiliates: affiliates.data().count,
        totalCommissionPaid: commissionPaid.data().total ?? 0,
        pendingWithdrawals: pendingCount.data().count,
        pendingAmount: pendingSum.data().total ?? 0,
      };
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Could not load affiliate stats');
    }
  },
);
