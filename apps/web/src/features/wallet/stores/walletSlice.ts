import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { WalletTransactionProps } from '@barakath/shared';
import { fetchWalletBreakdown, fetchWalletSettings, topUpWallet } from '../api/walletThunks';

/**
 * Wallet balance, ledger and the Rewards/Refunds figures.
 *
 * WHY the balance is not derived from the ledger: the balance is a field on `users/{uid}` written by
 * Cloud Functions, and it arrives on the live user-document subscription (`AuthListener` ->
 * `state.auth.user.walletBalance`). Summing the loaded page would be wrong the moment the ledger
 * paginates, and would put the client in charge of a number that is money. This slice deliberately
 * does NOT duplicate that field — `balance`/`setWalletBalance` below predate this pass and are left in
 * place unused rather than deleted (nothing else in the codebase dispatches them yet), per the Batch 4
 * convention of not fighting a pre-existing slice shape without checking nothing depends on it.
 *
 * WHY `transactions`/`loading`/`loadingMore`/`hasMore`/`setWalletPage`/`setWalletLoading`/
 * `setWalletLoadingMore` are ALSO left unused: the wallet page (Batch 4 / D2) pages the ledger with
 * `usePaginatedCollection` directly in the component — the same "use the hook standalone" choice D0's
 * own `CouponWallet` made — rather than adapting the hook's output into this slice's bespoke
 * pagination shape. Same reasoning: kept, not deleted, in case a later screen wants the slice-backed
 * shape instead.
 *
 * WHY `rewardsTotal` sums `Reward` + `Admin` credits: see `api/walletThunks.ts`'s `fetchWalletBreakdown`
 * for the full reasoning (mirrors the Flutter app's own choice). `refundsTotal` is the `Refund` source
 * alone — spec §3.13 draws Rewards and Refunds as two separate tiles on the WEBSITE specifically (the
 * Flutter tab dropped its own Refunds tile as redundant with the ledger below it; the website brief
 * asks for both, so both are computed).
 */
export interface WalletState {
  /** Mirrored from the live `users/{uid}` document — never computed here. Currently unused; see header. */
  balance: number;
  transactions: WalletTransactionProps[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  /** Lifetime `Reward` + `Admin` credits. */
  rewardsTotal: number;
  /** Lifetime `Refund` credits. */
  refundsTotal: number;
  breakdownLoading: boolean;
  /** `general/config.payment.walletPaymentsEnabled` — null while still loading/unknown. */
  walletPaymentsEnabled: boolean | null;
  settingsLoading: boolean;
  /** A Razorpay top-up is in flight — drives the "Add money" button + the modal's submit button. */
  toppingUp: boolean;
  error: string | null;
}

const initialState: WalletState = {
  balance: 0,
  transactions: [],
  loading: false,
  loadingMore: false,
  hasMore: false,
  rewardsTotal: 0,
  refundsTotal: 0,
  breakdownLoading: false,
  walletPaymentsEnabled: null,
  settingsLoading: false,
  toppingUp: false,
  error: null,
};

const walletSlice = createSlice({
  name: 'wallet',
  initialState,
  reducers: {
    setWalletBalance(state, action: PayloadAction<number>) {
      state.balance = action.payload;
    },
    setWalletPage(
      state,
      action: PayloadAction<{
        items: WalletTransactionProps[];
        hasMore: boolean;
        append: boolean;
      }>,
    ) {
      const { items, hasMore, append } = action.payload;
      if (append) {
        const seen = new Set(state.transactions.map((t) => t.id));
        state.transactions = [...state.transactions, ...items.filter((t) => !seen.has(t.id))];
      } else {
        state.transactions = items;
      }
      state.hasMore = hasMore;
    },
    setWalletLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setWalletLoadingMore(state, action: PayloadAction<boolean>) {
      state.loadingMore = action.payload;
    },
    setRewardsTotal(state, action: PayloadAction<number>) {
      state.rewardsTotal = action.payload;
    },
    setToppingUp(state, action: PayloadAction<boolean>) {
      state.toppingUp = action.payload;
    },
    setWalletError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
    /** Clears the error banner once a toast has shown it — same shape as other slices' `clearError`. */
    clearWalletError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchWalletSettings.pending, (state) => {
        state.settingsLoading = true;
      })
      .addCase(fetchWalletSettings.fulfilled, (state, action) => {
        state.settingsLoading = false;
        state.walletPaymentsEnabled = action.payload;
      })
      .addCase(fetchWalletSettings.rejected, (state) => {
        state.settingsLoading = false;
        // Unknown on failure, not "enabled" — the "Add money" button stays gated shut rather than
        // risking an unattempted top-up because the flag couldn't be read.
        state.walletPaymentsEnabled = null;
      })

      .addCase(fetchWalletBreakdown.pending, (state) => {
        state.breakdownLoading = true;
      })
      .addCase(fetchWalletBreakdown.fulfilled, (state, action) => {
        state.breakdownLoading = false;
        state.rewardsTotal = action.payload.rewardsTotal;
        state.refundsTotal = action.payload.refundsTotal;
      })
      .addCase(fetchWalletBreakdown.rejected, (state) => {
        // A failed aggregate must not blank the tiles — keep the last good figures (mirrors the
        // Flutter provider's identical `_refreshBreakdown` reasoning) rather than flashing ₹0.
        state.breakdownLoading = false;
      })

      .addCase(topUpWallet.pending, (state) => {
        state.toppingUp = true;
        state.error = null;
      })
      .addCase(topUpWallet.fulfilled, (state) => {
        state.toppingUp = false;
        // Deliberately does NOT touch `balance` — see header. `AuthListener`'s users/{uid} subscription
        // reports the credit on its own the moment the Cloud Function commits it.
      })
      .addCase(topUpWallet.rejected, (state, action) => {
        state.toppingUp = false;
        state.error = action.payload?.message ?? 'Could not start the top-up. Please try again.';
      });
  },
});

export const {
  setWalletBalance,
  setWalletPage,
  setWalletLoading,
  setWalletLoadingMore,
  setRewardsTotal,
  setToppingUp,
  setWalletError,
  clearWalletError,
} = walletSlice.actions;

export default walletSlice.reducer;
