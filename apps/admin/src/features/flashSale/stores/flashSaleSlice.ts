import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { FlashSaleProps } from '@barakath/shared/types';
import { fetchFlashSales } from '../api/fetchFlashSales';
import { fetchFlashSaleCount } from '../api/fetchFlashSaleCount';
import { createFlashSale } from '../api/createFlashSale';
import { deleteFlashSale } from '../api/deleteFlashSale';
import { toggleFlashSaleActive } from '../api/toggleFlashSaleActive';
import type { FlashSaleFilters } from '../types';

/**
 * flashSaleSlice — list + search + mutation state (spec §1.16).
 *
 * WHY changing the search resets the list: the list is a cursor-paginated view of the CURRENT filters, so
 * any filter change clears the list/cursor and the component refetches page one. Mutations patch the
 * loaded list in place (prepend on create, remove on delete, flip flag on toggle) so the UI updates
 * without a full re-fetch. `toggleLoading` holds the id of the row being toggled for per-row spinners.
 */
interface FlashSaleState {
  flashSales: FlashSaleProps[];
  lastVisible: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- Firestore cursor
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;

  filters: FlashSaleFilters;
  count: number;

  createLoading: boolean;
  deleteLoading: boolean;
  toggleLoading: string | null;
}

const initialState: FlashSaleState = {
  flashSales: [],
  lastVisible: null,
  hasMore: false,
  loading: false,
  loadingMore: false,
  error: null,
  filters: { searchTerm: '' },
  count: 0,
  createLoading: false,
  deleteLoading: false,
  toggleLoading: null,
};

const resetList = (s: FlashSaleState) => {
  s.flashSales = [];
  s.lastVisible = null;
  s.hasMore = false;
};

const flashSaleSlice = createSlice({
  name: 'flashSale',
  initialState,
  reducers: {
    setFlashSearch(s, a: PayloadAction<string>) {
      s.filters.searchTerm = a.payload;
      resetList(s);
    },
  },
  extraReducers: (builder) => {
    builder
      // --- list ---
      .addCase(fetchFlashSales.pending, (s, a) => {
        if (a.meta.arg.cursor) s.loadingMore = true;
        else {
          s.loading = true;
          s.error = null;
        }
      })
      .addCase(fetchFlashSales.fulfilled, (s, a) => {
        const isFirst = !a.meta.arg.cursor;
        s.loading = false;
        s.loadingMore = false;
        // Dedup by id — StrictMode / rapid "View More" can dispatch the same page twice.
        const seen = new Set(s.flashSales.map((f) => f.id));
        const fresh = a.payload.items.filter((f) => !seen.has(f.id));
        s.flashSales = isFirst ? a.payload.items : [...s.flashSales, ...fresh];
        s.lastVisible = a.payload.lastVisible;
        s.hasMore = a.payload.hasMore;
      })
      .addCase(fetchFlashSales.rejected, (s, a) => {
        s.loading = false;
        s.loadingMore = false;
        s.error = a.payload ?? 'Failed to load flash sales';
      })

      // --- count ---
      .addCase(fetchFlashSaleCount.fulfilled, (s, a) => {
        s.count = a.payload;
      })

      // --- create (prepend) ---
      .addCase(createFlashSale.pending, (s) => {
        s.createLoading = true;
      })
      .addCase(createFlashSale.fulfilled, (s, a) => {
        s.createLoading = false;
        // Prepend so the new sale shows at the top. Guard against a dup id.
        if (!s.flashSales.some((f) => f.id === a.payload.id)) s.flashSales.unshift(a.payload);
        s.count += 1;
      })
      .addCase(createFlashSale.rejected, (s) => {
        s.createLoading = false;
      })

      // --- delete (remove) ---
      .addCase(deleteFlashSale.pending, (s) => {
        s.deleteLoading = true;
      })
      .addCase(deleteFlashSale.fulfilled, (s, a) => {
        s.deleteLoading = false;
        s.flashSales = s.flashSales.filter((f) => f.id !== a.payload);
        s.count = Math.max(0, s.count - 1);
      })
      .addCase(deleteFlashSale.rejected, (s) => {
        s.deleteLoading = false;
      })

      // --- toggle active ---
      .addCase(toggleFlashSaleActive.pending, (s, a) => {
        s.toggleLoading = a.meta.arg.flashSaleId;
      })
      .addCase(toggleFlashSaleActive.fulfilled, (s, a) => {
        s.toggleLoading = null;
        const f = s.flashSales.find((x) => x.id === a.payload.flashSaleId);
        if (f) f.isActive = a.payload.isActive;
      })
      .addCase(toggleFlashSaleActive.rejected, (s) => {
        s.toggleLoading = null;
      });
  },
});

export const { setFlashSearch } = flashSaleSlice.actions;
export default flashSaleSlice.reducer;
