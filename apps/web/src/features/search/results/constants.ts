/**
 * The 5-col-desktop / 3-tablet / 2-mobile grid density spec 3.20 calls for on the /search RESULTS
 * page — wider than the standard listing/category grid (`PRODUCT_GRID_CLASS`, 4-up desktop, defined
 * in `@/components/catalog/ProductGrid`). `ProductGrid` already accepts a `className` override for
 * exactly this case, so this constant is the one place both the real grid and its `loading.tsx`
 * skeleton pull the override from — sharing it is what keeps them from silently drifting apart and
 * reflowing when the skeleton hands off to real cards.
 */
export const SEARCH_RESULTS_GRID_CLASS = 'grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5';
