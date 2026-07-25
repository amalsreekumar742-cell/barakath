import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { AffiliateTransactionProps, AffiliateWithdrawalProps } from '@barakath/shared';

/**
 * Referral earnings, the commission ledger and withdrawals.
 *
 * WHY the three money figures are separate fields rather than one balance: they are three different
 * states of the same rupee and the customer needs to see all three at once. A commission is created
 * PENDING when a referred order is placed, and only moves to CLEARED (shown as "Confirmed") once the
 * clearing job runs after delivery. Collapsing them would tell someone their money is available when
 * it is not.
 *
 * WHY they mirror `users/{uid}` rather than being summed from `commissions`: they are written by
 * Cloud Functions with `FieldValue.increment` inside a transaction, and they arrive on the live user
 * document. Summing a page of the ledger would be both wrong and client-computed money.
 *
 * Commission is a fixed ₹ amount per product, never a percentage.
 */
export interface AffiliateState {
  /** Withdrawable now. */
  affiliateBalance: number;
  /** Earned but not yet cleared. */
  pendingCommission: number;
  /** Lifetime cleared. */
  confirmedCommission: number;
  totalReferrals: number;
  /** The customer's own code, from their user document. */
  affiliateCode: string;

  commissions: AffiliateTransactionProps[];
  commissionsLoading: boolean;
  commissionsHasMore: boolean;

  withdrawals: AffiliateWithdrawalProps[];
  withdrawalsLoading: boolean;
  withdrawalsHasMore: boolean;

  /** A withdrawal request is being submitted. */
  submitting: boolean;
  error: string | null;
}

const initialState: AffiliateState = {
  affiliateBalance: 0,
  pendingCommission: 0,
  confirmedCommission: 0,
  totalReferrals: 0,
  affiliateCode: '',
  commissions: [],
  commissionsLoading: false,
  commissionsHasMore: false,
  withdrawals: [],
  withdrawalsLoading: false,
  withdrawalsHasMore: false,
  submitting: false,
  error: null,
};

const affiliateSlice = createSlice({
  name: 'affiliate',
  initialState,
  reducers: {
    /** Mirrored from the live user document — never computed from the ledger. */
    setAffiliateStats(
      state,
      action: PayloadAction<{
        affiliateBalance: number;
        pendingCommission: number;
        confirmedCommission: number;
        totalReferrals: number;
        affiliateCode: string;
      }>,
    ) {
      Object.assign(state, action.payload);
    },
    setCommissionsPage(
      state,
      action: PayloadAction<{
        items: AffiliateTransactionProps[];
        hasMore: boolean;
        append: boolean;
      }>,
    ) {
      const { items, hasMore, append } = action.payload;
      if (append) {
        const seen = new Set(state.commissions.map((c) => c.id));
        state.commissions = [...state.commissions, ...items.filter((c) => !seen.has(c.id))];
      } else {
        state.commissions = items;
      }
      state.commissionsHasMore = hasMore;
    },
    setCommissionsLoading(state, action: PayloadAction<boolean>) {
      state.commissionsLoading = action.payload;
    },
    setWithdrawalsPage(
      state,
      action: PayloadAction<{
        items: AffiliateWithdrawalProps[];
        hasMore: boolean;
        append: boolean;
      }>,
    ) {
      const { items, hasMore, append } = action.payload;
      if (append) {
        const seen = new Set(state.withdrawals.map((w) => w.id));
        state.withdrawals = [...state.withdrawals, ...items.filter((w) => !seen.has(w.id))];
      } else {
        state.withdrawals = items;
      }
      state.withdrawalsHasMore = hasMore;
    },
    setWithdrawalsLoading(state, action: PayloadAction<boolean>) {
      state.withdrawalsLoading = action.payload;
    },
    setAffiliateSubmitting(state, action: PayloadAction<boolean>) {
      state.submitting = action.payload;
    },
    setAffiliateError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
  },
});

export const {
  setAffiliateStats,
  setCommissionsPage,
  setCommissionsLoading,
  setWithdrawalsPage,
  setWithdrawalsLoading,
  setAffiliateSubmitting,
  setAffiliateError,
} = affiliateSlice.actions;

export default affiliateSlice.reducer;
