import type { ProductSort } from '@/lib/data/products';

/**
 * listing — shared shape for the `/category/[categoryName]` URL state (spec 3.6).
 *
 * WHY every filter lives in the URL rather than component state or Redux: the prompt for this page is
 * explicit — ALL state is `searchParams`, so a shared link, a back-button press and a crawler all see
 * the exact same page a customer built with the sidebar. `catalogSlice` (cross-page cart/wishlist state)
 * is deliberately untouched here.
 */

export type QuickFilterValue = 'all' | 'inStock' | 'onSale';

/** The parsed, typed view of the page's searchParams — what the Server Component hands to every child. */
export interface ParsedListingParams {
  /** Sub-category NAMES (not ids) — `buildProductQuery` takes `subCategoryNames`, products denormalise
   *  `subCategoryName`, and there is no per-sub-category id anywhere on the product doc to filter by. */
  subCategoryNames: string[];
  minPrice?: number;
  maxPrice?: number;
  /** 1-4 ("N★ & up"). */
  minRating?: number;
  stockFilter: 'all' | 'inStock';
  saleFilter: 'all' | 'onSale';
  /** Only ever true via `/category/all?new=true` (the home page's New Arrivals "View all" link). */
  isNewArrival: boolean;
  sort: ProductSort;
  after?: string;
  before?: string;
  /** Display-only label — never used to compute an offset (Firestore has none). */
  page: number;
  /** Decoded `?trail=` — the chain of forward cursors `CategoryPagination` needs; see its doc comment. */
  trail: string[];
  /** True the instant ANY searchParam is present — drives the noindex/canonical rule (spec SEO). */
  hasAnyParam: boolean;
}
