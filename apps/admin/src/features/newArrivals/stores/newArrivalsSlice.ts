import { createSlice } from '@reduxjs/toolkit';
import type { ProductProps } from '@barakath/shared/types';
import { fetchNewArrivals } from '../api/fetchNewArrivals';
import { fetchNewArrivalsCount } from '../api/fetchNewArrivalsCount';
import { addNewArrival } from '../api/addNewArrival';
import { removeNewArrival } from '../api/removeNewArrival';

/**
 * newArrivalsSlice — the curated list of products flagged `isNewArrival` + count + mutation state (spec §1.17).
 *
 * WHY mutations patch in place: adding prepends the returned product (newest-first list) and bumps the
 * count; removing filters the row out and decrements the count — neither needs a full re-fetch.
 * `removeLoading` holds the productId of the row being removed for a per-row spinner; `addLoading` guards
 * the modal's submit button.
 */
interface NewArrivalsState {
  newArrivals: ProductProps[];
  lastVisible: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- Firestore cursor
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;

  count: number;
  countLoading: boolean;

  addLoading: boolean;
  removeLoading: string | null;
}

const initialState: NewArrivalsState = {
  newArrivals: [],
  lastVisible: null,
  hasMore: false,
  loading: false,
  loadingMore: false,
  error: null,
  count: 0,
  countLoading: false,
  addLoading: false,
  removeLoading: null,
};

const newArrivalsSlice = createSlice({
  name: 'newArrivals',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      // --- list ---
      .addCase(fetchNewArrivals.pending, (s, a) => {
        if (a.meta.arg.cursor) s.loadingMore = true;
        else {
          s.loading = true;
          s.error = null;
        }
      })
      .addCase(fetchNewArrivals.fulfilled, (s, a) => {
        const isFirst = !a.meta.arg.cursor;
        s.loading = false;
        s.loadingMore = false;
        // Dedup by id — StrictMode / rapid "View More" can dispatch the same page twice.
        const seen = new Set(s.newArrivals.map((p) => p.id));
        const fresh = a.payload.items.filter((p) => !seen.has(p.id));
        s.newArrivals = isFirst ? a.payload.items : [...s.newArrivals, ...fresh];
        s.lastVisible = a.payload.lastVisible;
        s.hasMore = a.payload.hasMore;
      })
      .addCase(fetchNewArrivals.rejected, (s, a) => {
        s.loading = false;
        s.loadingMore = false;
        s.error = a.payload ?? 'Failed to load new arrivals';
      })

      // --- count ---
      .addCase(fetchNewArrivalsCount.pending, (s) => {
        s.countLoading = true;
      })
      .addCase(fetchNewArrivalsCount.fulfilled, (s, a) => {
        s.countLoading = false;
        s.count = a.payload;
      })
      .addCase(fetchNewArrivalsCount.rejected, (s) => {
        s.countLoading = false;
      })

      // --- add (prepend) ---
      .addCase(addNewArrival.pending, (s) => {
        s.addLoading = true;
      })
      .addCase(addNewArrival.fulfilled, (s, a) => {
        s.addLoading = false;
        // Prepend so the newly-added product shows at the top. Guard against a dup id.
        if (!s.newArrivals.some((p) => p.id === a.payload.id)) {
          s.newArrivals.unshift(a.payload);
          s.count += 1;
        }
      })
      .addCase(addNewArrival.rejected, (s) => {
        s.addLoading = false;
      })

      // --- remove ---
      .addCase(removeNewArrival.pending, (s, a) => {
        s.removeLoading = a.meta.arg;
      })
      .addCase(removeNewArrival.fulfilled, (s, a) => {
        s.removeLoading = null;
        s.newArrivals = s.newArrivals.filter((p) => p.id !== a.payload);
        s.count = Math.max(0, s.count - 1);
      })
      .addCase(removeNewArrival.rejected, (s) => {
        s.removeLoading = null;
      });
  },
});

export default newArrivalsSlice.reducer;
