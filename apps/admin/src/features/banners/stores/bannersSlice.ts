import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { BannerProps } from '@barakath/shared/types';
import { fetchBanners } from '../api/fetchBanners';
import { fetchBannerCount } from '../api/fetchBannerCount';
import { fetchBannerDetail } from '../api/fetchBannerDetail';
import { createBanner } from '../api/createBanner';
import { updateBanner } from '../api/updateBanner';
import { deleteBanner } from '../api/deleteBanner';
import { toggleBannerActive } from '../api/toggleBannerActive';
import { reorderBanners } from '../api/reorderBanners';
import type { BannerFilters, BannerPlacementFilter, BannerStatusFilter } from '../types';

/**
 * bannersSlice — list + placement/status filter pills + detail + mutation state (spec §1.15).
 *
 * WHY changing a filter resets the list: the list is a cursor-paginated view of the CURRENT filters, so any
 * filter change clears banners/cursor and the component refetches page one. Mutations patch the loaded list
 * in place (append on create, remove on delete, flip flag on toggle, resequence on reorder) so the UI
 * updates without a full re-fetch. `toggleLoading` holds the id of the card being toggled for a per-card
 * spinner. `reorderLoading` is a single boolean because a reorder rewrites the whole visible order at once.
 */
interface BannersState {
  banners: BannerProps[];
  lastVisible: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- Firestore cursor
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;

  filters: BannerFilters;
  count: number;

  bannerDetail: BannerProps | null;
  detailLoading: boolean;
  detailError: string | null;

  createLoading: boolean;
  updateLoading: boolean;
  deleteLoading: boolean;
  toggleLoading: string | null;
  reorderLoading: boolean;
}

const initialState: BannersState = {
  banners: [],
  lastVisible: null,
  hasMore: false,
  loading: false,
  loadingMore: false,
  error: null,
  filters: { placement: 'All', status: 'All' },
  count: 0,
  bannerDetail: null,
  detailLoading: false,
  detailError: null,
  createLoading: false,
  updateLoading: false,
  deleteLoading: false,
  toggleLoading: null,
  reorderLoading: false,
};

const resetList = (s: BannersState) => {
  s.banners = [];
  s.lastVisible = null;
  s.hasMore = false;
};

const bannersSlice = createSlice({
  name: 'banners',
  initialState,
  reducers: {
    setBannerPlacementFilter(s, a: PayloadAction<BannerPlacementFilter>) {
      s.filters.placement = a.payload;
      resetList(s);
    },
    setBannerStatusFilter(s, a: PayloadAction<BannerStatusFilter>) {
      s.filters.status = a.payload;
      resetList(s);
    },
    resetBannerDetail(s) {
      s.bannerDetail = null;
      s.detailError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // --- list ---
      .addCase(fetchBanners.pending, (s, a) => {
        if (a.meta.arg.cursor) s.loadingMore = true;
        else {
          s.loading = true;
          s.error = null;
        }
      })
      .addCase(fetchBanners.fulfilled, (s, a) => {
        const isFirst = !a.meta.arg.cursor;
        s.loading = false;
        s.loadingMore = false;
        // Dedup by id — StrictMode / rapid "View More" can dispatch the same page twice.
        const seen = new Set(s.banners.map((b) => b.id));
        const fresh = a.payload.items.filter((b) => !seen.has(b.id));
        s.banners = isFirst ? a.payload.items : [...s.banners, ...fresh];
        s.lastVisible = a.payload.lastVisible;
        s.hasMore = a.payload.hasMore;
      })
      .addCase(fetchBanners.rejected, (s, a) => {
        s.loading = false;
        s.loadingMore = false;
        s.error = a.payload ?? 'Failed to load banners';
      })

      // --- count ---
      .addCase(fetchBannerCount.fulfilled, (s, a) => {
        s.count = a.payload;
      })

      // --- detail ---
      .addCase(fetchBannerDetail.pending, (s) => {
        s.detailLoading = true;
        s.detailError = null;
      })
      .addCase(fetchBannerDetail.fulfilled, (s, a) => {
        s.detailLoading = false;
        s.bannerDetail = a.payload;
      })
      .addCase(fetchBannerDetail.rejected, (s, a) => {
        s.detailLoading = false;
        s.detailError = a.payload ?? 'Failed to load banner';
      })

      // --- create (append — new banner takes the last position) ---
      .addCase(createBanner.pending, (s) => {
        s.createLoading = true;
      })
      .addCase(createBanner.fulfilled, (s, a) => {
        s.createLoading = false;
        if (!s.banners.some((b) => b.id === a.payload.id)) s.banners.push(a.payload);
        s.count += 1;
      })
      .addCase(createBanner.rejected, (s) => {
        s.createLoading = false;
      })

      // --- update ---
      .addCase(updateBanner.pending, (s) => {
        s.updateLoading = true;
      })
      .addCase(updateBanner.fulfilled, (s, a) => {
        s.updateLoading = false;
        const i = s.banners.findIndex((b) => b.id === a.payload.id);
        if (i !== -1) s.banners[i] = a.payload;
        if (s.bannerDetail?.id === a.payload.id) s.bannerDetail = a.payload;
      })
      .addCase(updateBanner.rejected, (s) => {
        s.updateLoading = false;
      })

      // --- delete (remove) ---
      .addCase(deleteBanner.pending, (s) => {
        s.deleteLoading = true;
      })
      .addCase(deleteBanner.fulfilled, (s, a) => {
        s.deleteLoading = false;
        s.banners = s.banners.filter((b) => b.id !== a.payload);
        s.count = Math.max(0, s.count - 1);
      })
      .addCase(deleteBanner.rejected, (s) => {
        s.deleteLoading = false;
      })

      // --- toggle active ---
      .addCase(toggleBannerActive.pending, (s, a) => {
        s.toggleLoading = a.meta.arg.bannerId;
      })
      .addCase(toggleBannerActive.fulfilled, (s, a) => {
        s.toggleLoading = null;
        const b = s.banners.find((x) => x.id === a.payload.bannerId);
        if (b) b.isActive = a.payload.isActive;
      })
      .addCase(toggleBannerActive.rejected, (s) => {
        s.toggleLoading = null;
      })

      // --- reorder (resequence the visible list + rewrite positions to match) ---
      .addCase(reorderBanners.pending, (s) => {
        s.reorderLoading = true;
      })
      .addCase(reorderBanners.fulfilled, (s, a) => {
        s.reorderLoading = false;
        const byId = new Map(s.banners.map((b) => [b.id, b]));
        const next: BannerProps[] = [];
        a.payload.bannerIds.forEach((id, index) => {
          const b = byId.get(id);
          if (b) {
            b.position = index + 1; // keep positions in lockstep with the persisted order
            next.push(b);
          }
        });
        // Preserve any loaded banners not part of the reordered set (defensive; normally all are present).
        for (const b of s.banners) if (!a.payload.bannerIds.includes(b.id)) next.push(b);
        s.banners = next;
      })
      .addCase(reorderBanners.rejected, (s) => {
        s.reorderLoading = false;
      });
  },
});

export const { setBannerPlacementFilter, setBannerStatusFilter, resetBannerDetail } = bannersSlice.actions;
export default bannersSlice.reducer;
