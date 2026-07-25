import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { CouponProps } from '@barakath/shared/types';
import { fetchCoupons } from '../api/fetchCoupons';
import { fetchCouponCount } from '../api/fetchCouponCount';
import { fetchCouponDetail } from '../api/fetchCouponDetail';
import { createCoupon } from '../api/createCoupon';
import { updateCoupon } from '../api/updateCoupon';
import { deleteCoupon } from '../api/deleteCoupon';
import { toggleCouponActive } from '../api/toggleCouponActive';
import type { CouponFilters, CouponStatusFilter } from '../types';

/**
 * couponsSlice — list + status tabs + search + detail + mutation state (spec §1.12).
 *
 * WHY changing the status tab / search resets the list: the list is a cursor-paginated view of the CURRENT
 * filters, so any filter change clears coupons/cursor and the component refetches page one. Mutations patch
 * the loaded list in place (prepend on create, remove on delete, flip flag on toggle) so the UI updates
 * without a full re-fetch. `toggleLoading` holds the id of the row being toggled for per-row spinners.
 */
interface CouponsState {
  coupons: CouponProps[];
  lastVisible: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- Firestore cursor
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;

  filters: CouponFilters;
  count: number;

  couponDetail: CouponProps | null;
  detailLoading: boolean;
  detailError: string | null;

  createLoading: boolean;
  updateLoading: boolean;
  deleteLoading: boolean;
  toggleLoading: string | null;
}

const initialState: CouponsState = {
  coupons: [],
  lastVisible: null,
  hasMore: false,
  loading: false,
  loadingMore: false,
  error: null,
  filters: { status: 'All', searchTerm: '' },
  count: 0,
  couponDetail: null,
  detailLoading: false,
  detailError: null,
  createLoading: false,
  updateLoading: false,
  deleteLoading: false,
  toggleLoading: null,
};

const resetList = (s: CouponsState) => {
  s.coupons = [];
  s.lastVisible = null;
  s.hasMore = false;
};

const couponsSlice = createSlice({
  name: 'coupons',
  initialState,
  reducers: {
    setCouponStatusFilter(s, a: PayloadAction<CouponStatusFilter>) {
      s.filters.status = a.payload;
      resetList(s);
    },
    setCouponSearch(s, a: PayloadAction<string>) {
      s.filters.searchTerm = a.payload;
      resetList(s);
    },
    resetCouponDetail(s) {
      s.couponDetail = null;
      s.detailError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // --- list ---
      .addCase(fetchCoupons.pending, (s, a) => {
        if (a.meta.arg.cursor) s.loadingMore = true;
        else {
          s.loading = true;
          s.error = null;
        }
      })
      .addCase(fetchCoupons.fulfilled, (s, a) => {
        const isFirst = !a.meta.arg.cursor;
        s.loading = false;
        s.loadingMore = false;
        // Dedup by id — StrictMode / rapid "View More" can dispatch the same page twice.
        const seen = new Set(s.coupons.map((c) => c.id));
        const fresh = a.payload.items.filter((c) => !seen.has(c.id));
        s.coupons = isFirst ? a.payload.items : [...s.coupons, ...fresh];
        s.lastVisible = a.payload.lastVisible;
        s.hasMore = a.payload.hasMore;
      })
      .addCase(fetchCoupons.rejected, (s, a) => {
        s.loading = false;
        s.loadingMore = false;
        s.error = a.payload ?? 'Failed to load coupons';
      })

      // --- count ---
      .addCase(fetchCouponCount.fulfilled, (s, a) => {
        s.count = a.payload;
      })

      // --- detail ---
      .addCase(fetchCouponDetail.pending, (s) => {
        s.detailLoading = true;
        s.detailError = null;
      })
      .addCase(fetchCouponDetail.fulfilled, (s, a) => {
        s.detailLoading = false;
        s.couponDetail = a.payload;
      })
      .addCase(fetchCouponDetail.rejected, (s, a) => {
        s.detailLoading = false;
        s.detailError = a.payload ?? 'Failed to load coupon';
      })

      // --- create (prepend) ---
      .addCase(createCoupon.pending, (s) => {
        s.createLoading = true;
      })
      .addCase(createCoupon.fulfilled, (s, a) => {
        s.createLoading = false;
        // Prepend so the new coupon shows at the top (list is newest-first). Guard against a dup id.
        if (!s.coupons.some((c) => c.id === a.payload.id)) s.coupons.unshift(a.payload);
        s.count += 1;
      })
      .addCase(createCoupon.rejected, (s) => {
        s.createLoading = false;
      })

      // --- update ---
      .addCase(updateCoupon.pending, (s) => {
        s.updateLoading = true;
      })
      .addCase(updateCoupon.fulfilled, (s, a) => {
        s.updateLoading = false;
        const i = s.coupons.findIndex((c) => c.id === a.payload.id);
        if (i !== -1) s.coupons[i] = a.payload;
        if (s.couponDetail?.id === a.payload.id) s.couponDetail = a.payload;
      })
      .addCase(updateCoupon.rejected, (s) => {
        s.updateLoading = false;
      })

      // --- delete (remove) ---
      .addCase(deleteCoupon.pending, (s) => {
        s.deleteLoading = true;
      })
      .addCase(deleteCoupon.fulfilled, (s, a) => {
        s.deleteLoading = false;
        s.coupons = s.coupons.filter((c) => c.id !== a.payload);
        s.count = Math.max(0, s.count - 1);
      })
      .addCase(deleteCoupon.rejected, (s) => {
        s.deleteLoading = false;
      })

      // --- toggle active ---
      .addCase(toggleCouponActive.pending, (s, a) => {
        s.toggleLoading = a.meta.arg.couponId;
      })
      .addCase(toggleCouponActive.fulfilled, (s, a) => {
        s.toggleLoading = null;
        const c = s.coupons.find((x) => x.id === a.payload.couponId);
        if (c) c.isActive = a.payload.isActive;
      })
      .addCase(toggleCouponActive.rejected, (s) => {
        s.toggleLoading = null;
      });
  },
});

export const { setCouponStatusFilter, setCouponSearch, resetCouponDetail } = couponsSlice.actions;
export default couponsSlice.reducer;
