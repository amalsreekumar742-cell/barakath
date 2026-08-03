import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { deriveStockStatus } from '@/features/products/utils/stock';
import { fetchInventory, isStockSort, STOCK_PAGE_ROWS } from '../api/fetchInventory';
import { fetchInventoryCounts } from '../api/fetchInventoryCounts';
import { adjustStockBatch } from '../api/adjustStockBatch';
import { exportInventoryCSV } from '../api/exportInventoryCSV';
import type { InventoryCounts, InventoryFilters, InventoryRow, InventorySort } from '../types';

/**
 * inventorySlice — variant-level inventory rows + summary counts + batch adjust/export (design §08).
 *
 * WHY changing the search resets the list: the list is a cursor-paginated view of the CURRENT filters,
 * so any change clears rows/cursor and the component refetches page one. Rows dedup by `variantId`. On
 * a successful adjust, the changed variants' stock + derived status are patched in place so the table
 * reflects the new numbers without a full refetch.
 *
 * TWO PAGINATION MODES, matching the two load strategies in `fetchInventory`:
 *  • newest — Firestore cursor pagination; each "View More" is a fetch.
 *  • stock  — the thunk returns the COMPLETE ranking (a ranking cannot be assembled page by page), so
 *    it is held in `ranked` and revealed `STOCK_PAGE_ROWS` at a time. "View More" behaves identically
 *    for the user but costs no reads.
 */
interface InventoryState {
  rows: InventoryRow[];
  /** The full stock-sorted result, source for `rows` under a stock sort. Empty in newest mode. */
  ranked: InventoryRow[];
  lastVisible: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- Firestore cursor
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  /** The stock scan hit its cap — the ranking does not cover the whole catalogue. */
  truncated: boolean;

  filters: InventoryFilters;

  counts: InventoryCounts;
  countsLoading: boolean;

  adjustLoading: boolean;
  exportLoading: boolean;
}

const initialState: InventoryState = {
  rows: [],
  ranked: [],
  lastVisible: null,
  hasMore: false,
  loading: false,
  loadingMore: false,
  error: null,
  truncated: false,
  filters: { sort: 'newest' },
  counts: { inStock: 0, lowStock: 0, outOfStock: 0, totalSkus: 0 },
  countsLoading: false,
  adjustLoading: false,
  exportLoading: false,
};

const resetList = (s: InventoryState) => {
  s.rows = [];
  s.ranked = [];
  s.lastVisible = null;
  s.hasMore = false;
  s.truncated = false;
};

const inventorySlice = createSlice({
  name: 'inventory',
  initialState,
  reducers: {
    setInventorySearch(s, a: PayloadAction<string>) {
      s.filters.searchTerm = a.payload || undefined;
      resetList(s);
    },
    /** Empty string = "All categories" — stored as undefined so no `where` clause is emitted. */
    setInventoryCategory(s, a: PayloadAction<string>) {
      s.filters.categoryId = a.payload || undefined;
      resetList(s);
    },
    setInventorySort(s, a: PayloadAction<InventorySort>) {
      s.filters.sort = a.payload;
      resetList(s);
    },
    /**
     * Clears category + sort but NOT the search term: the search box is a separate control the
     * component owns local state for, and silently emptying it from here would leave the input showing
     * text that is no longer being applied.
     */
    clearInventoryFilters(s) {
      s.filters = { ...s.filters, categoryId: undefined, sort: 'newest' };
      resetList(s);
    },
    /** "View More" under a stock sort: reveal the next slice of the already-loaded ranking. */
    showMoreRankedRows(s) {
      s.rows = s.ranked.slice(0, s.rows.length + STOCK_PAGE_ROWS);
      s.hasMore = s.rows.length < s.ranked.length;
    },
  },
  extraReducers: (builder) => {
    builder
      // --- list ---
      .addCase(fetchInventory.pending, (s, a) => {
        if (a.meta.arg.cursor) s.loadingMore = true;
        else {
          s.loading = true;
          s.error = null;
        }
      })
      .addCase(fetchInventory.fulfilled, (s, a) => {
        s.loading = false;
        s.loadingMore = false;
        s.truncated = a.payload.truncated ?? false;

        if (isStockSort(a.meta.arg.filters)) {
          // The payload IS the whole ranking — hold it and reveal the first page.
          s.ranked = a.payload.rows;
          s.rows = a.payload.rows.slice(0, STOCK_PAGE_ROWS);
          s.lastVisible = null;
          s.hasMore = a.payload.rows.length > STOCK_PAGE_ROWS;
          return;
        }

        const isFirst = !a.meta.arg.cursor;
        const seen = new Set(s.rows.map((r) => r.variantId));
        const fresh = a.payload.rows.filter((r) => !seen.has(r.variantId));
        s.ranked = [];
        s.rows = isFirst ? a.payload.rows : [...s.rows, ...fresh];
        s.lastVisible = a.payload.lastVisible;
        s.hasMore = a.payload.hasMore;
      })
      .addCase(fetchInventory.rejected, (s, a) => {
        s.loading = false;
        s.loadingMore = false;
        s.error = a.payload ?? 'Failed to load inventory';
      })

      // --- counts ---
      .addCase(fetchInventoryCounts.pending, (s) => {
        s.countsLoading = true;
      })
      .addCase(fetchInventoryCounts.fulfilled, (s, a) => {
        s.countsLoading = false;
        s.counts = a.payload;
      })
      .addCase(fetchInventoryCounts.rejected, (s) => {
        s.countsLoading = false;
      })

      // --- batch adjust ---
      .addCase(adjustStockBatch.pending, (s) => {
        s.adjustLoading = true;
      })
      .addCase(adjustStockBatch.fulfilled, (s, a) => {
        s.adjustLoading = false;
        const changed = new Map(a.payload.changed.map((c) => [c.variantId, c.newStock]));
        const patch = (r: InventoryRow) => {
          const next = changed.get(r.variantId);
          if (next === undefined) return r;
          return { ...r, stock: next, status: deriveStockStatus(next, r.lowStockThreshold) };
        };
        s.rows = s.rows.map(patch);
        // Patch the unrevealed remainder too, or a later "View More" would serve stale numbers. The
        // ranking's ORDER is deliberately left alone — rows must not jump around under the cursor;
        // re-picking the sort re-runs the scan.
        s.ranked = s.ranked.map(patch);
      })
      .addCase(adjustStockBatch.rejected, (s) => {
        s.adjustLoading = false;
      })

      // --- export ---
      .addCase(exportInventoryCSV.pending, (s) => {
        s.exportLoading = true;
      })
      .addCase(exportInventoryCSV.fulfilled, (s) => {
        s.exportLoading = false;
      })
      .addCase(exportInventoryCSV.rejected, (s) => {
        s.exportLoading = false;
      });
  },
});

export const {
  setInventorySearch,
  setInventoryCategory,
  setInventorySort,
  clearInventoryFilters,
  showMoreRankedRows,
} = inventorySlice.actions;
export default inventorySlice.reducer;
