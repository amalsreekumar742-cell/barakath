import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { deriveStockStatus } from '@/features/products/utils/stock';
import { fetchInventory } from '../api/fetchInventory';
import { fetchInventoryCounts } from '../api/fetchInventoryCounts';
import { adjustStockBatch } from '../api/adjustStockBatch';
import { exportInventoryCSV } from '../api/exportInventoryCSV';
import type { InventoryCounts, InventoryFilters, InventoryRow } from '../types';

/**
 * inventorySlice — variant-level inventory rows + summary counts + batch adjust/export (design §08).
 *
 * WHY changing the search resets the list: the list is a cursor-paginated view of the CURRENT filters,
 * so any change clears rows/cursor and the component refetches page one. Rows dedup by `variantId`. On
 * a successful adjust, the changed variants' stock + derived status are patched in place so the table
 * reflects the new numbers without a full refetch.
 */
interface InventoryState {
  rows: InventoryRow[];
  lastVisible: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- Firestore cursor
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;

  filters: InventoryFilters;

  counts: InventoryCounts;
  countsLoading: boolean;

  adjustLoading: boolean;
  exportLoading: boolean;
}

const initialState: InventoryState = {
  rows: [],
  lastVisible: null,
  hasMore: false,
  loading: false,
  loadingMore: false,
  error: null,
  filters: {},
  counts: { inStock: 0, lowStock: 0, outOfStock: 0, totalSkus: 0 },
  countsLoading: false,
  adjustLoading: false,
  exportLoading: false,
};

const resetList = (s: InventoryState) => {
  s.rows = [];
  s.lastVisible = null;
  s.hasMore = false;
};

const inventorySlice = createSlice({
  name: 'inventory',
  initialState,
  reducers: {
    setInventorySearch(s, a: PayloadAction<string>) {
      s.filters.searchTerm = a.payload || undefined;
      resetList(s);
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
        const isFirst = !a.meta.arg.cursor;
        s.loading = false;
        s.loadingMore = false;
        const seen = new Set(s.rows.map((r) => r.variantId));
        const fresh = a.payload.rows.filter((r) => !seen.has(r.variantId));
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
        s.rows = s.rows.map((r) => {
          const next = changed.get(r.variantId);
          if (next === undefined) return r;
          return { ...r, stock: next, status: deriveStockStatus(next, r.lowStockThreshold) };
        });
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

export const { setInventorySearch } = inventorySlice.actions;
export default inventorySlice.reducer;
