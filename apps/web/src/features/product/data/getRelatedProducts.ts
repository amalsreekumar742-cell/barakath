import 'server-only';

import { StockStatus, type ProductProps } from '@barakath/shared';
import { buildProductQuery } from '@/lib/data/products';

/**
 * getRelatedProducts — the product detail page's "Related products" rail (spec §3.7).
 *
 * SPEC GAP, flagged for the record: nothing in the schema backs a curated "related products" list —
 * there is no `relatedProductIds` field anywhere on `ProductProps`. This is a DERIVED rule, confirmed
 * with the project owner: same sub-category, excluding the current product, in-stock items first,
 * ordered by `averageRating` desc, capped at 8, falling back to the same CATEGORY when the
 * sub-category alone yields fewer than 4. Kept in this one function so a future curated field (e.g. an
 * admin-picked `relatedProductIds` array) can replace the body without touching the page that calls it.
 *
 * WHY it composes `buildProductQuery` rather than a hand-rolled query: B0's builder already has the
 * exact `status + categoryId + subCategoryName + averageRating` composite index this needs (see
 * WEB_BATCH2_NOTES.md §7), already excludes non-Active products, and already exposes `sort: 'rating'`.
 * Writing a second query here would be a second place that index requirement could drift.
 *
 * WHY a padded pool (`RELATED_LIMIT + 4`) rather than fetching exactly 8: the current product has to be
 * filtered out of the pool AFTER the read (an equality on `documentId() != x` cannot combine with the
 * other equalities Firestore already spends on `status`/`categoryId`/`subCategoryName`), and the
 * in-stock-first re-sort can reorder within the pool — padding keeps the final slice at a full 8 in the
 * common case instead of silently coming back with 7.
 */
const RELATED_LIMIT = 8;
const MIN_SUBCATEGORY_RESULTS = 4;
const POOL_LIMIT = RELATED_LIMIT + 4;

/** In-stock products first; within each group, highest-rated first (the pool is already rating-sorted, so this only needs to re-group it). */
function byInStockThenRating(a: ProductProps, b: ProductProps): number {
  const aInStock = a.stockStatus !== StockStatus.OUT_OF_STOCK;
  const bInStock = b.stockStatus !== StockStatus.OUT_OF_STOCK;
  if (aInStock !== bInStock) return aInStock ? -1 : 1;
  return b.averageRating - a.averageRating;
}

export async function getRelatedProducts(product: ProductProps): Promise<ProductProps[]> {
  const subCategoryName = product.subCategoryName?.trim();

  const subPool = subCategoryName
    ? (
        await buildProductQuery({
          categoryId: product.categoryId,
          subCategoryNames: [subCategoryName],
          sort: 'rating',
          limit: POOL_LIMIT,
        })
      ).items.filter((p) => p.id !== product.id)
    : [];

  const pool = subPool;

  // Fallback: the sub-category alone didn't yield enough — widen to the whole category and top up,
  // de-duping against what the sub-category pool already found.
  if (pool.length < MIN_SUBCATEGORY_RESULTS) {
    const categoryPool = (
      await buildProductQuery({
        categoryId: product.categoryId,
        sort: 'rating',
        limit: POOL_LIMIT,
      })
    ).items.filter((p) => p.id !== product.id);

    const seen = new Set(pool.map((p) => p.id));
    for (const p of categoryPool) {
      if (!seen.has(p.id)) {
        pool.push(p);
        seen.add(p.id);
      }
    }
  }

  return pool.sort(byInStockThenRating).slice(0, RELATED_LIMIT);
}
