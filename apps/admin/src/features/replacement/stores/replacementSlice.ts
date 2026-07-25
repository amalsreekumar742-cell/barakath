import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { ReplacementProps } from '@barakath/shared/types';
import { ReplacementStatus } from '@barakath/shared/config/enums';
import { fetchReplacements } from '../api/fetchReplacements';
import { fetchReplacementStatusCounts } from '../api/fetchReplacementStatusCounts';
import { fetchReplacementDetail } from '../api/fetchReplacementDetail';
import { approveReplacement } from '../api/approveReplacement';
import { rejectReplacement } from '../api/rejectReplacement';
import { exportReplacementsCSV } from '../api/exportReplacementsCSV';
import type {
  ReplacementDetailBundle,
  ReplacementFilters,
  ReplacementStatusCounts,
} from '../types';

/**
 * replacementSlice — list + status tabs + detail + approve/reject state (spec §1.10).
 *
 * WHY changing the status tab resets the list: the list is a cursor-paginated view of the CURRENT tab
 * (Pending / Approved / Rejected), so switching tabs clears rows/cursor and the component refetches
 * page one. On a successful approve/reject the processed row LEAVES the active tab (it was Pending and
 * became Approved/Rejected), so we drop it from the current list and shift the tab counts (−pending,
 * +approved/+rejected) so the badges stay correct without a full re-count.
 */
type ReplacementTab = 'Pending' | 'Approved' | 'Rejected';

interface ReplacementState {
  replacements: ReplacementProps[];
  lastVisible: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- Firestore cursor
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;

  filters: ReplacementFilters;
  activeTab: ReplacementTab;

  statusCounts: ReplacementStatusCounts;
  statusCountsLoading: boolean;

  replacementDetail: ReplacementDetailBundle | null;
  detailLoading: boolean;
  detailError: string | null;

  approveLoading: boolean;
  rejectLoading: boolean;
  exportLoading: boolean;
}

const initialState: ReplacementState = {
  replacements: [],
  lastVisible: null,
  hasMore: false,
  loading: false,
  loadingMore: false,
  error: null,
  filters: { status: ReplacementStatus.PENDING, searchTerm: '' },
  activeTab: 'Pending',
  statusCounts: { all: 0, pending: 0, approved: 0, rejected: 0 },
  statusCountsLoading: false,
  replacementDetail: null,
  detailLoading: false,
  detailError: null,
  approveLoading: false,
  rejectLoading: false,
  exportLoading: false,
};

const resetList = (s: ReplacementState) => {
  s.replacements = [];
  s.lastVisible = null;
  s.hasMore = false;
};

const replacementSlice = createSlice({
  name: 'replacement',
  initialState,
  reducers: {
    // Switch the active status tab: sets the tab + its status filter and resets the paginated list.
    setReplacementTab(s, a: PayloadAction<ReplacementTab>) {
      s.activeTab = a.payload;
      s.filters.status = a.payload;
      resetList(s);
    },
    // Debounced search input (matches the doc `keywords`); resets the list so page one reflects it.
    setReplacementSearch(s, a: PayloadAction<string>) {
      s.filters.searchTerm = a.payload;
      resetList(s);
    },
    // Clear the open detail bundle on unmount so a stale request never flashes on the next open.
    resetReplacementDetail(s) {
      s.replacementDetail = null;
      s.detailError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // --- list ---
      .addCase(fetchReplacements.pending, (s, a) => {
        if (a.meta.arg.cursor) s.loadingMore = true;
        else {
          s.loading = true;
          s.error = null;
        }
      })
      .addCase(fetchReplacements.fulfilled, (s, a) => {
        const isFirst = !a.meta.arg.cursor;
        s.loading = false;
        s.loadingMore = false;
        const seen = new Set(s.replacements.map((r) => r.id));
        const fresh = a.payload.items.filter((r) => !seen.has(r.id));
        s.replacements = isFirst ? a.payload.items : [...s.replacements, ...fresh];
        s.lastVisible = a.payload.lastVisible;
        s.hasMore = a.payload.hasMore;
      })
      .addCase(fetchReplacements.rejected, (s, a) => {
        s.loading = false;
        s.loadingMore = false;
        s.error = a.payload ?? 'Failed to load replacement requests';
      })

      // --- status counts ---
      .addCase(fetchReplacementStatusCounts.pending, (s) => {
        s.statusCountsLoading = true;
      })
      .addCase(fetchReplacementStatusCounts.fulfilled, (s, a) => {
        s.statusCountsLoading = false;
        s.statusCounts = a.payload;
      })
      .addCase(fetchReplacementStatusCounts.rejected, (s) => {
        s.statusCountsLoading = false;
      })

      // --- detail ---
      .addCase(fetchReplacementDetail.pending, (s) => {
        s.detailLoading = true;
        s.detailError = null;
      })
      .addCase(fetchReplacementDetail.fulfilled, (s, a) => {
        s.detailLoading = false;
        s.replacementDetail = a.payload;
      })
      .addCase(fetchReplacementDetail.rejected, (s, a) => {
        s.detailLoading = false;
        s.detailError = a.payload ?? 'Failed to load the replacement request';
      })

      // --- approve ---
      .addCase(approveReplacement.pending, (s) => {
        s.approveLoading = true;
      })
      .addCase(approveReplacement.fulfilled, (s, a) => {
        s.approveLoading = false;
        resolveRequest(s, a.payload, 'approved');
      })
      .addCase(approveReplacement.rejected, (s) => {
        s.approveLoading = false;
      })

      // --- reject ---
      .addCase(rejectReplacement.pending, (s) => {
        s.rejectLoading = true;
      })
      .addCase(rejectReplacement.fulfilled, (s, a) => {
        s.rejectLoading = false;
        resolveRequest(s, a.payload, 'rejected');
      })
      .addCase(rejectReplacement.rejected, (s) => {
        s.rejectLoading = false;
      })

      // --- export ---
      .addCase(exportReplacementsCSV.pending, (s) => {
        s.exportLoading = true;
      })
      .addCase(exportReplacementsCSV.fulfilled, (s) => {
        s.exportLoading = false;
      })
      .addCase(exportReplacementsCSV.rejected, (s) => {
        s.exportLoading = false;
      });
  },
});

/**
 * resolveRequest — shared post-approve/reject state patch: the request just left the Pending tab, so
 * drop it from the current list (if that tab is showing), patch the open detail bundle, and shift the
 * tab counts (−1 pending, +1 approved/rejected) so the badges stay correct without a re-count.
 */
function resolveRequest(
  s: ReplacementState,
  updated: ReplacementProps,
  outcome: 'approved' | 'rejected',
) {
  s.replacements = s.replacements.filter((r) => r.id !== updated.id);
  if (s.replacementDetail?.replacement.id === updated.id)
    s.replacementDetail = { ...s.replacementDetail, replacement: updated };
  s.statusCounts.pending = Math.max(0, s.statusCounts.pending - 1);
  if (outcome === 'approved') s.statusCounts.approved += 1;
  else s.statusCounts.rejected += 1;
}

export const { setReplacementTab, setReplacementSearch, resetReplacementDetail } =
  replacementSlice.actions;
export default replacementSlice.reducer;
