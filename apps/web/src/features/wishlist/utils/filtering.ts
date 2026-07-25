import { StockStatus, type ProductProps } from '@barakath/shared';
import type { SubCategoryFacet, ProductSort } from '@/lib/data/products';

/**
 * filtering — the wishlist page's in-memory equivalent of `src/lib/data/products.ts`'s server-side
 * query builder + `getFilterFacets`. There is no Firestore query that can filter/sort/paginate an
 * arbitrary customer-chosen id set (an `in` query caps at a bounded list of ids and cannot combine
 * with a range filter or a second sort), so the wishlist page fetches the full hydrated set ONCE and
 * does every filter/sort/paginate step here instead. Every rule mirrors the server builder's exactly
 * (same field names, same "0 rating means unrated" / "totalStock > 0 means in stock" semantics) so a
 * product behaves identically whether it is being filtered on `/category/x` or `/wishlist`.
 */

/**
 * A local copy of `features/listing/types/listing.ts`'s `QuickFilterValue` union — NOT imported from
 * there. `import/no-restricted-paths` (`eslint.config.mjs`) forbids `features/wishlist` importing
 * ANYTHING from `features/listing` (feature-to-feature imports are a hard lint error in this repo, no
 * exception is carved out for wishlist↔listing the way there is for checkout↔address); reusing
 * `FilterSidebar`/`QuickFilters`/`SortDropdown` themselves therefore happens at the app/route layer
 * (`src/app/(checkout)/wishlist/page.tsx`, per the rule's own suggested fix), which passes already-
 * parsed primitives down here. Three identical string literals is a smaller price than a lint
 * exception this repo deliberately does not otherwise grant.
 */
export type WishlistQuickFilter = 'all' | 'inStock' | 'onSale';

export interface WishlistFilterSelection {
  subCategoryNames: string[];
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  quickFilter: WishlistQuickFilter;
}

/** Sub-category counts across the WHOLE wishlist — mirrors `getFilterFacets`: never narrowed by any
 *  currently-active filter, so a customer can always see what else is available to filter TO. */
export function computeSubCategoryFacets(items: ProductProps[]): SubCategoryFacet[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const name = item.subCategoryName?.trim();
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return Array.from(counts, ([name, count]) => ({ name, count })).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

/** Price bounds across the WHOLE wishlist (same "never narrowed by active filters" rule as above). */
export function computePriceBounds(items: ProductProps[]): { min: number; max: number } | null {
  if (items.length === 0) return null;
  let min = Infinity;
  let max = -Infinity;
  for (const item of items) {
    if (item.minPrice < min) min = item.minPrice;
    if (item.maxPrice > max) max = item.maxPrice;
  }
  return { min, max };
}

/** Apply the sidebar + quick filters. Mirrors `products.ts`'s `narrow()` field-for-field. */
export function filterWishlistItems(
  items: ProductProps[],
  selection: WishlistFilterSelection,
): ProductProps[] {
  const { subCategoryNames, minPrice, maxPrice, minRating, quickFilter } = selection;

  return items.filter((p) => {
    if (subCategoryNames.length > 0 && !subCategoryNames.includes(p.subCategoryName)) return false;
    if (minPrice != null && p.minPrice < minPrice) return false;
    if (maxPrice != null && p.minPrice > maxPrice) return false;
    if (minRating != null && p.averageRating < minRating) return false;
    if (quickFilter === 'inStock' && p.stockStatus === StockStatus.OUT_OF_STOCK) return false;
    if (quickFilter === 'onSale' && !p.isFlashSale) return false;
    return true;
  });
}

/** Mirrors `products.ts`'s `SORT` map exactly — same field, same direction, same tie-break intent. */
export function sortWishlistItems(items: ProductProps[], sort: ProductSort): ProductProps[] {
  const sorted = [...items];
  switch (sort) {
    case 'popularity':
      return sorted.sort((a, b) => b.totalReviews - a.totalReviews);
    case 'newest':
      return sorted.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
    case 'priceAsc':
      return sorted.sort((a, b) => a.minPrice - b.minPrice);
    case 'priceDesc':
      return sorted.sort((a, b) => b.minPrice - a.minPrice);
    case 'rating':
      return sorted.sort((a, b) => b.averageRating - a.averageRating);
    default:
      return sorted;
  }
}
