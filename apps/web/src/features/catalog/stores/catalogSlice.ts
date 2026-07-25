import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

/**
 * Listing-page filters, sort and where the cursor stack currently stands.
 *
 * WHY only the SELECTION lives here and not the products: on this site the listing page is a Server
 * Component that receives its products already fetched (see src/app/README.md). What the client owns
 * is what the visitor chose — and that has to survive a filter drawer opening, a sort changing and
 * the back button.
 *
 * WHY the state mirrors the URL query string: a filtered listing must be shareable and the browser's
 * back button must undo a filter, not leave the page. The URL is the source of truth on load; this
 * slice is the working copy that writes back to it.
 *
 * WHY price and rating are applied over the fetched page rather than in the query: Firestore permits
 * a range filter on only one field per query and the sort has already spent that slot. This is also
 * why the price slider is bounded by the CURRENT result set — it is narrowing what was returned, not
 * asking the server for a different set.
 */
export type ProductSortKey = 'popularity' | 'newest' | 'priceAsc' | 'priceDesc' | 'rating';
export type StockQuickFilter = 'all' | 'inStock' | 'onSale';

export interface CatalogState {
  /** Sub-category names selected in the sidebar (multi-select). */
  subCategoryNames: string[];
  /** Null means "no bound set" — distinct from 0, which is a real minimum. */
  minPrice: number | null;
  maxPrice: number | null;
  /** "4★ & up" is `4`. Null means no rating filter. */
  minRating: number | null;
  /** "On sale" means an ACTIVE FLASH SALE, not merely a discount off MRP. */
  quickFilter: StockQuickFilter;
  sort: ProductSortKey;
  /**
   * Page numbers the visitor has already reached, so Prev can step back through them.
   * The cursors themselves are Firestore snapshots and are NOT serialisable, so they never enter
   * Redux — the Pagination component holds them in a ref. This is only the visible page number.
   */
  pageNumber: number;
}

const initialState: CatalogState = {
  subCategoryNames: [],
  minPrice: null,
  maxPrice: null,
  minRating: null,
  quickFilter: 'all',
  sort: 'newest',
  pageNumber: 1,
};

const catalogSlice = createSlice({
  name: 'catalog',
  initialState,
  reducers: {
    toggleSubCategory(state, action: PayloadAction<string>) {
      const name = action.payload;
      state.subCategoryNames = state.subCategoryNames.includes(name)
        ? state.subCategoryNames.filter((n) => n !== name)
        : [...state.subCategoryNames, name];
      // Any filter change invalidates the page position — page 3 of the old result set is meaningless.
      state.pageNumber = 1;
    },
    setPriceRange(state, action: PayloadAction<{ min: number | null; max: number | null }>) {
      state.minPrice = action.payload.min;
      state.maxPrice = action.payload.max;
      state.pageNumber = 1;
    },
    setMinRating(state, action: PayloadAction<number | null>) {
      state.minRating = action.payload;
      state.pageNumber = 1;
    },
    setQuickFilter(state, action: PayloadAction<StockQuickFilter>) {
      state.quickFilter = action.payload;
      state.pageNumber = 1;
    },
    setSort(state, action: PayloadAction<ProductSortKey>) {
      state.sort = action.payload;
      state.pageNumber = 1;
    },
    setPageNumber(state, action: PayloadAction<number>) {
      state.pageNumber = Math.max(1, action.payload);
    },
    /** "Clear all" — every section, including the sort back to its default. */
    clearFilters() {
      return initialState;
    },
    /** Rehydrate from the URL on first load, so a shared link opens already filtered. */
    hydrateFromQuery(state, action: PayloadAction<Partial<CatalogState>>) {
      return { ...state, ...action.payload };
    },
  },
});

export const {
  toggleSubCategory,
  setPriceRange,
  setMinRating,
  setQuickFilter,
  setSort,
  setPageNumber,
  clearFilters,
  hydrateFromQuery,
} = catalogSlice.actions;

export default catalogSlice.reducer;
