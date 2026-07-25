import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { SpinnerCampaignProps, SpinHistoryProps } from '@barakath/shared/types';
import { fetchCampaigns } from '../api/fetchCampaigns';
import { fetchCampaignCount } from '../api/fetchCampaignCount';
import { fetchCampaignDetail } from '../api/fetchCampaignDetail';
import { fetchCampaignSpinHistory } from '../api/fetchCampaignSpinHistory';
import { createCampaign } from '../api/createCampaign';
import { updateCampaign } from '../api/updateCampaign';
import { deleteCampaign } from '../api/deleteCampaign';
import { toggleCampaignActive } from '../api/toggleCampaignActive';
import type { CampaignFilters, CampaignStatusFilter } from '../types';

/**
 * spinnerCampaignsSlice — list + status pills + search + detail + spin-history + mutation state (spec F13).
 *
 * WHY changing the status pill / search resets the list: the list is a cursor-paginated view of the
 * CURRENT filters, so any filter change clears campaigns/cursor and the component refetches page one.
 * Mutations patch the loaded list in place (prepend on create, remove on delete, flip flag on toggle) so
 * the UI updates without a full re-fetch. `toggleLoading` holds the id of the row being toggled (per-row
 * spinner). Spin history has its own independent cursor/loading state (a sub-list on the detail page).
 */
interface SpinnerCampaignsState {
  campaigns: SpinnerCampaignProps[];
  lastVisible: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- Firestore cursor
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;

  filters: CampaignFilters;
  count: number;

  campaignDetail: SpinnerCampaignProps | null;
  detailLoading: boolean;
  detailError: string | null;

  spinHistory: SpinHistoryProps[];
  historyLastVisible: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- Firestore cursor
  historyHasMore: boolean;
  historyLoading: boolean;
  historyLoadingMore: boolean;

  createLoading: boolean;
  updateLoading: boolean;
  deleteLoading: boolean;
  toggleLoading: string | null;
}

const initialState: SpinnerCampaignsState = {
  campaigns: [],
  lastVisible: null,
  hasMore: false,
  loading: false,
  loadingMore: false,
  error: null,
  filters: { status: 'All', searchTerm: '' },
  count: 0,
  campaignDetail: null,
  detailLoading: false,
  detailError: null,
  spinHistory: [],
  historyLastVisible: null,
  historyHasMore: false,
  historyLoading: false,
  historyLoadingMore: false,
  createLoading: false,
  updateLoading: false,
  deleteLoading: false,
  toggleLoading: null,
};

const resetList = (s: SpinnerCampaignsState) => {
  s.campaigns = [];
  s.lastVisible = null;
  s.hasMore = false;
};

const spinnerCampaignsSlice = createSlice({
  name: 'spinnerCampaigns',
  initialState,
  reducers: {
    setCampaignStatusFilter(s, a: PayloadAction<CampaignStatusFilter>) {
      s.filters.status = a.payload;
      resetList(s);
    },
    setCampaignSearch(s, a: PayloadAction<string>) {
      s.filters.searchTerm = a.payload;
      resetList(s);
    },
    resetCampaignDetail(s) {
      s.campaignDetail = null;
      s.detailError = null;
      // Clear the spin-history sub-list too so a different campaign never shows stale spins.
      s.spinHistory = [];
      s.historyLastVisible = null;
      s.historyHasMore = false;
    },
  },
  extraReducers: (builder) => {
    builder
      // --- list ---
      .addCase(fetchCampaigns.pending, (s, a) => {
        if (a.meta.arg.cursor) s.loadingMore = true;
        else {
          s.loading = true;
          s.error = null;
        }
      })
      .addCase(fetchCampaigns.fulfilled, (s, a) => {
        const isFirst = !a.meta.arg.cursor;
        s.loading = false;
        s.loadingMore = false;
        // Dedup by id — StrictMode / rapid "View More" can dispatch the same page twice.
        const seen = new Set(s.campaigns.map((c) => c.id));
        const fresh = a.payload.items.filter((c) => !seen.has(c.id));
        s.campaigns = isFirst ? a.payload.items : [...s.campaigns, ...fresh];
        s.lastVisible = a.payload.lastVisible;
        s.hasMore = a.payload.hasMore;
      })
      .addCase(fetchCampaigns.rejected, (s, a) => {
        s.loading = false;
        s.loadingMore = false;
        s.error = a.payload ?? 'Failed to load campaigns';
      })

      // --- count ---
      .addCase(fetchCampaignCount.fulfilled, (s, a) => {
        s.count = a.payload;
      })

      // --- detail ---
      .addCase(fetchCampaignDetail.pending, (s) => {
        s.detailLoading = true;
        s.detailError = null;
      })
      .addCase(fetchCampaignDetail.fulfilled, (s, a) => {
        s.detailLoading = false;
        s.campaignDetail = a.payload;
      })
      .addCase(fetchCampaignDetail.rejected, (s, a) => {
        s.detailLoading = false;
        s.detailError = a.payload ?? 'Failed to load campaign';
      })

      // --- spin history (independent cursor sub-list) ---
      .addCase(fetchCampaignSpinHistory.pending, (s, a) => {
        if (a.meta.arg.cursor) s.historyLoadingMore = true;
        else s.historyLoading = true;
      })
      .addCase(fetchCampaignSpinHistory.fulfilled, (s, a) => {
        const isFirst = !a.meta.arg.cursor;
        s.historyLoading = false;
        s.historyLoadingMore = false;
        const seen = new Set(s.spinHistory.map((h) => h.id));
        const fresh = a.payload.items.filter((h) => !seen.has(h.id));
        s.spinHistory = isFirst ? a.payload.items : [...s.spinHistory, ...fresh];
        s.historyLastVisible = a.payload.lastVisible;
        s.historyHasMore = a.payload.hasMore;
      })
      .addCase(fetchCampaignSpinHistory.rejected, (s) => {
        s.historyLoading = false;
        s.historyLoadingMore = false;
      })

      // --- create (prepend) ---
      .addCase(createCampaign.pending, (s) => {
        s.createLoading = true;
      })
      .addCase(createCampaign.fulfilled, (s, a) => {
        s.createLoading = false;
        // Prepend so the new campaign shows at the top (list is newest-first). Guard against a dup id.
        if (!s.campaigns.some((c) => c.id === a.payload.id)) s.campaigns.unshift(a.payload);
        s.count += 1;
      })
      .addCase(createCampaign.rejected, (s) => {
        s.createLoading = false;
      })

      // --- update ---
      .addCase(updateCampaign.pending, (s) => {
        s.updateLoading = true;
      })
      .addCase(updateCampaign.fulfilled, (s, a) => {
        s.updateLoading = false;
        const i = s.campaigns.findIndex((c) => c.id === a.payload.id);
        if (i !== -1) s.campaigns[i] = a.payload;
        if (s.campaignDetail?.id === a.payload.id) s.campaignDetail = a.payload;
      })
      .addCase(updateCampaign.rejected, (s) => {
        s.updateLoading = false;
      })

      // --- delete (remove) ---
      .addCase(deleteCampaign.pending, (s) => {
        s.deleteLoading = true;
      })
      .addCase(deleteCampaign.fulfilled, (s, a) => {
        s.deleteLoading = false;
        s.campaigns = s.campaigns.filter((c) => c.id !== a.payload);
        s.count = Math.max(0, s.count - 1);
      })
      .addCase(deleteCampaign.rejected, (s) => {
        s.deleteLoading = false;
      })

      // --- toggle active ---
      .addCase(toggleCampaignActive.pending, (s, a) => {
        s.toggleLoading = a.meta.arg.campaignId;
      })
      .addCase(toggleCampaignActive.fulfilled, (s, a) => {
        s.toggleLoading = null;
        const c = s.campaigns.find((x) => x.id === a.payload.campaignId);
        if (c) c.isActive = a.payload.isActive;
        if (s.campaignDetail?.id === a.payload.campaignId) s.campaignDetail.isActive = a.payload.isActive;
      })
      .addCase(toggleCampaignActive.rejected, (s) => {
        s.toggleLoading = null;
      });
  },
});

export const { setCampaignStatusFilter, setCampaignSearch, resetCampaignDetail } =
  spinnerCampaignsSlice.actions;
export default spinnerCampaignsSlice.reducer;
