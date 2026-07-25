import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { UserProps, AffiliateWithdrawalProps } from '@barakath/shared/types';
import { fetchAffiliateStats } from '../api/fetchAffiliateStats';
import { fetchAffiliateUsers } from '../api/fetchAffiliateUsers';
import { searchAllocatableUsers } from '../api/searchAllocatableUsers';
import { allocateAffiliate } from '../api/allocateAffiliate';
import { fetchWithdrawals } from '../api/fetchWithdrawals';
import { fetchWithdrawalStatusCounts } from '../api/fetchWithdrawalStatusCounts';
import { approveWithdrawal } from '../api/approveWithdrawal';
import { rejectWithdrawal } from '../api/rejectWithdrawal';
import { fetchProductsForCommission } from '../api/fetchProductsForCommission';
import { saveProductCommissions } from '../api/saveProductCommissions';
import type { AffiliateMainTab, AffiliateStats, ProductWithVariants, WithdrawalStatusCounts } from '../types';

/* eslint-disable @typescript-eslint/no-explicit-any -- Firestore cursors are opaque QueryDocumentSnapshots */

/**
 * affiliateSlice — the Affiliate Program page (spec §1.14): four summary stats, and three independently
 * paginated tabs (Affiliates / Withdrawals / Commissions) plus the allocate / approve / reject / save
 * actions.
 *
 * WHY each tab keeps its own items/cursor/loading: the tabs load independently on first activation and
 * paginate separately, exactly like the customer detail tabs. WHY changing a filter (affiliate search /
 * withdrawal status / commission search) resets that tab's list: the list is a cursor view of the CURRENT
 * filter, so any change clears its rows/cursor and the component refetches page one. On allocate/approve/
 * reject we patch the loaded rows locally so the UI stays correct without a refetch.
 */
interface AffiliateState {
  activeTab: AffiliateMainTab;

  // --- summary stats ---
  stats: AffiliateStats | null;
  statsLoading: boolean;

  // --- Affiliates tab ---
  affiliates: UserProps[];
  affiliatesLastVisible: any;
  affiliatesHasMore: boolean;
  affiliatesLoading: boolean;
  affiliatesLoadingMore: boolean;
  affiliatesError: string | null;
  affiliateSearch: string;
  // Allocate modal search + action.
  allocateSearchResults: UserProps[];
  allocateSearchLoading: boolean;
  allocateLoading: boolean;

  // --- Withdrawals tab ---
  withdrawals: AffiliateWithdrawalProps[];
  withdrawalsLastVisible: any;
  withdrawalsHasMore: boolean;
  withdrawalsLoading: boolean;
  withdrawalsLoadingMore: boolean;
  withdrawalsError: string | null;
  withdrawalStatusFilter: string; // '' = All
  withdrawalCounts: WithdrawalStatusCounts;
  approveLoading: boolean;
  rejectLoading: boolean;

  // --- Commissions tab ---
  commissionProducts: ProductWithVariants[];
  commissionsLastVisible: any;
  commissionsHasMore: boolean;
  commissionsLoading: boolean;
  commissionsLoadingMore: boolean;
  commissionsError: string | null;
  commissionSearch: string;
  saveCommissionsLoading: boolean;
}

const initialState: AffiliateState = {
  activeTab: 'withdrawals',
  stats: null,
  statsLoading: false,
  affiliates: [],
  affiliatesLastVisible: null,
  affiliatesHasMore: false,
  affiliatesLoading: false,
  affiliatesLoadingMore: false,
  affiliatesError: null,
  affiliateSearch: '',
  allocateSearchResults: [],
  allocateSearchLoading: false,
  allocateLoading: false,
  withdrawals: [],
  withdrawalsLastVisible: null,
  withdrawalsHasMore: false,
  withdrawalsLoading: false,
  withdrawalsLoadingMore: false,
  withdrawalsError: null,
  withdrawalStatusFilter: '',
  withdrawalCounts: { all: 0, pending: 0, approved: 0, rejected: 0 },
  approveLoading: false,
  rejectLoading: false,
  commissionProducts: [],
  commissionsLastVisible: null,
  commissionsHasMore: false,
  commissionsLoading: false,
  commissionsLoadingMore: false,
  commissionsError: null,
  commissionSearch: '',
  saveCommissionsLoading: false,
};

/** Dedup helper: append only ids not already present (StrictMode / rapid scroll can double-dispatch). */
const appendDedup = <T extends { id: string }>(existing: T[], incoming: T[]): T[] => {
  const seen = new Set(existing.map((x) => x.id));
  return [...existing, ...incoming.filter((x) => !seen.has(x.id))];
};

const affiliateSlice = createSlice({
  name: 'affiliate',
  initialState,
  reducers: {
    setAffiliateTab(s, a: PayloadAction<AffiliateMainTab>) {
      s.activeTab = a.payload;
    },
    setAffiliateSearch(s, a: PayloadAction<string>) {
      s.affiliateSearch = a.payload;
      s.affiliates = [];
      s.affiliatesLastVisible = null;
      s.affiliatesHasMore = false;
    },
    setWithdrawalStatusFilter(s, a: PayloadAction<string>) {
      s.withdrawalStatusFilter = a.payload;
      s.withdrawals = [];
      s.withdrawalsLastVisible = null;
      s.withdrawalsHasMore = false;
    },
    setCommissionSearch(s, a: PayloadAction<string>) {
      s.commissionSearch = a.payload;
      s.commissionProducts = [];
      s.commissionsLastVisible = null;
      s.commissionsHasMore = false;
    },
    clearAllocateSearch(s) {
      s.allocateSearchResults = [];
      s.allocateSearchLoading = false;
    },
  },
  extraReducers: (builder) => {
    builder
      // --- stats ---
      .addCase(fetchAffiliateStats.pending, (s) => {
        s.statsLoading = true;
      })
      .addCase(fetchAffiliateStats.fulfilled, (s, a) => {
        s.statsLoading = false;
        s.stats = a.payload;
      })
      .addCase(fetchAffiliateStats.rejected, (s) => {
        s.statsLoading = false;
      })

      // --- affiliates list ---
      .addCase(fetchAffiliateUsers.pending, (s, a) => {
        if (a.meta.arg.cursor) s.affiliatesLoadingMore = true;
        else {
          s.affiliatesLoading = true;
          s.affiliatesError = null;
        }
      })
      .addCase(fetchAffiliateUsers.fulfilled, (s, a) => {
        const isFirst = !a.meta.arg.cursor;
        s.affiliatesLoading = false;
        s.affiliatesLoadingMore = false;
        s.affiliates = isFirst ? a.payload.items : appendDedup(s.affiliates, a.payload.items);
        s.affiliatesLastVisible = a.payload.lastVisible;
        s.affiliatesHasMore = a.payload.hasMore;
      })
      .addCase(fetchAffiliateUsers.rejected, (s, a) => {
        s.affiliatesLoading = false;
        s.affiliatesLoadingMore = false;
        s.affiliatesError = a.payload ?? 'Failed to load affiliates';
      })

      // --- allocate modal search ---
      .addCase(searchAllocatableUsers.pending, (s) => {
        s.allocateSearchLoading = true;
      })
      .addCase(searchAllocatableUsers.fulfilled, (s, a) => {
        s.allocateSearchLoading = false;
        s.allocateSearchResults = a.payload;
      })
      .addCase(searchAllocatableUsers.rejected, (s) => {
        s.allocateSearchLoading = false;
        s.allocateSearchResults = [];
      })

      // --- allocate action ---
      .addCase(allocateAffiliate.pending, (s) => {
        s.allocateLoading = true;
      })
      .addCase(allocateAffiliate.fulfilled, (s, a) => {
        s.allocateLoading = false;
        // Prepend the newly-minted affiliate so it appears at the top without a refetch.
        s.affiliates = [a.payload.user, ...s.affiliates.filter((u) => u.id !== a.payload.user.id)];
        if (s.stats) s.stats.totalAffiliates += 1;
      })
      .addCase(allocateAffiliate.rejected, (s) => {
        s.allocateLoading = false;
      })

      // --- withdrawals list ---
      .addCase(fetchWithdrawals.pending, (s, a) => {
        if (a.meta.arg.cursor) s.withdrawalsLoadingMore = true;
        else {
          s.withdrawalsLoading = true;
          s.withdrawalsError = null;
        }
      })
      .addCase(fetchWithdrawals.fulfilled, (s, a) => {
        const isFirst = !a.meta.arg.cursor;
        s.withdrawalsLoading = false;
        s.withdrawalsLoadingMore = false;
        s.withdrawals = isFirst ? a.payload.items : appendDedup(s.withdrawals, a.payload.items);
        s.withdrawalsLastVisible = a.payload.lastVisible;
        s.withdrawalsHasMore = a.payload.hasMore;
      })
      .addCase(fetchWithdrawals.rejected, (s, a) => {
        s.withdrawalsLoading = false;
        s.withdrawalsLoadingMore = false;
        s.withdrawalsError = a.payload ?? 'Failed to load withdrawals';
      })

      // --- withdrawal status counts ---
      .addCase(fetchWithdrawalStatusCounts.fulfilled, (s, a) => {
        s.withdrawalCounts = a.payload;
      })

      // --- approve withdrawal ---
      .addCase(approveWithdrawal.pending, (s) => {
        s.approveLoading = true;
      })
      .addCase(approveWithdrawal.fulfilled, (s, a) => {
        s.approveLoading = false;
        patchWithdrawalRow(s, a.payload.withdrawal);
        moveCount(s, 'approved', a.payload.withdrawal.amount);
      })
      .addCase(approveWithdrawal.rejected, (s) => {
        s.approveLoading = false;
      })

      // --- reject withdrawal ---
      .addCase(rejectWithdrawal.pending, (s) => {
        s.rejectLoading = true;
      })
      .addCase(rejectWithdrawal.fulfilled, (s, a) => {
        s.rejectLoading = false;
        patchWithdrawalRow(s, a.payload);
        moveCount(s, 'rejected', a.payload.amount);
      })
      .addCase(rejectWithdrawal.rejected, (s) => {
        s.rejectLoading = false;
      })

      // --- commission products list ---
      .addCase(fetchProductsForCommission.pending, (s, a) => {
        if (a.meta.arg.cursor) s.commissionsLoadingMore = true;
        else {
          s.commissionsLoading = true;
          s.commissionsError = null;
        }
      })
      .addCase(fetchProductsForCommission.fulfilled, (s, a) => {
        const isFirst = !a.meta.arg.cursor;
        s.commissionsLoading = false;
        s.commissionsLoadingMore = false;
        s.commissionProducts = isFirst
          ? a.payload.items
          : appendDedup(s.commissionProducts, a.payload.items);
        s.commissionsLastVisible = a.payload.lastVisible;
        s.commissionsHasMore = a.payload.hasMore;
      })
      .addCase(fetchProductsForCommission.rejected, (s, a) => {
        s.commissionsLoading = false;
        s.commissionsLoadingMore = false;
        s.commissionsError = a.payload ?? 'Failed to load products';
      })

      // --- save commissions ---
      .addCase(saveProductCommissions.pending, (s) => {
        s.saveCommissionsLoading = true;
      })
      .addCase(saveProductCommissions.fulfilled, (s, a) => {
        s.saveCommissionsLoading = false;
        // Reconcile the loaded rows' baseline to the saved values so re-expanding shows saved defaults.
        for (const saved of a.payload) {
          const product = s.commissionProducts.find((p) => p.id === saved.productId);
          const variant = product?.variants.find((v) => v.id === saved.variantId);
          if (variant) variant.commission = saved.commission;
        }
      })
      .addCase(saveProductCommissions.rejected, (s) => {
        s.saveCommissionsLoading = false;
      });
  },
});

/** Patch a withdrawal row in the loaded list (and drop it if the current filter no longer matches). */
function patchWithdrawalRow(s: AffiliateState, updated: AffiliateWithdrawalProps) {
  const idx = s.withdrawals.findIndex((w) => w.id === updated.id);
  if (idx === -1) return;
  // If a status filter is active and the new status no longer matches it, remove the row; else patch.
  if (s.withdrawalStatusFilter && s.withdrawalStatusFilter !== updated.status) {
    s.withdrawals.splice(idx, 1);
  } else {
    s.withdrawals[idx] = updated;
  }
}

/** Move one request out of the Pending bucket into the approved/rejected bucket in the pill counts. */
function moveCount(s: AffiliateState, to: 'approved' | 'rejected', amount: number) {
  if (s.withdrawalCounts.pending > 0) s.withdrawalCounts.pending -= 1;
  s.withdrawalCounts[to] += 1;
  // Keep the summary stats' pending figures in step so the cards match the pills after an action.
  if (s.stats) {
    if (s.stats.pendingWithdrawals > 0) s.stats.pendingWithdrawals -= 1;
    s.stats.pendingAmount = Math.max(0, s.stats.pendingAmount - amount);
  }
}

export const {
  setAffiliateTab,
  setAffiliateSearch,
  setWithdrawalStatusFilter,
  setCommissionSearch,
  clearAllocateSearch,
} = affiliateSlice.actions;
export default affiliateSlice.reducer;
