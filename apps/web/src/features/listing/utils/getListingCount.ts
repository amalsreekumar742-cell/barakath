import 'server-only';

import {
  collection,
  getCountFromServer,
  query,
  where,
  type QueryConstraint,
} from 'firebase/firestore';
import { FirestoreCollections, ProductStatus } from '@barakath/shared';
import { serverDb } from '@/lib/data/serverFirestore';

/**
 * getListingCount — the category header's "N products" figure, via `getCountFromServer` (never
 * `items.length`, per the skill's mandatory-aggregation rule).
 *
 * WHY this is a NEW function here rather than an edit to `lib/data/products.ts`: that file is B0's
 * shared, exact-signature infrastructure that every Batch 2 session imports as-is; this task's scope is
 * `src/features/listing/` + the category route, so a new aggregation lives beside its one caller.
 *
 * WHY it only ever pushes ONE range filter (price, else rating) instead of the whole filter set:
 * Firestore allows exactly one inequality field per query, and stacking one needs the matching
 * composite index — `buildProductQuery` (B0) hits the identical wall and resolves it by narrowing
 * whichever range does NOT match the sort field in memory over the fetched page. An aggregation has no
 * "fetched page" to narrow in memory (that would mean reading the whole matched set just to count it,
 * which is the unbounded read the skill forbids), so this count is exact for the equality filters
 * (category / sub-category / on-sale) plus AT MOST one range, and never reflects `stockFilter` — the
 * same limitation `buildProductQuery` already documents (stock is always narrowed in memory, never
 * pushed server-side). Price wins when both price and rating are set, since the slider is this page's
 * primary numeric filter.
 */
export interface ListingCountParams {
  categoryId?: string;
  subCategoryNames?: string[];
  isNewArrival?: boolean;
  saleFilter?: 'onSale' | 'all';
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
}

export async function getListingCount(params: ListingCountParams): Promise<number> {
  const { categoryId, subCategoryNames, isNewArrival, saleFilter, minPrice, maxPrice, minRating } =
    params;

  const constraints: QueryConstraint[] = [where('status', '==', ProductStatus.ACTIVE)];
  if (categoryId) constraints.push(where('categoryId', '==', categoryId));
  if (subCategoryNames && subCategoryNames.length === 1) {
    constraints.push(where('subCategoryName', '==', subCategoryNames[0]));
  } else if (subCategoryNames && subCategoryNames.length > 1) {
    constraints.push(where('subCategoryName', 'in', subCategoryNames.slice(0, 30)));
  }
  if (isNewArrival) constraints.push(where('isNewArrival', '==', true));
  if (saleFilter === 'onSale') constraints.push(where('isFlashSale', '==', true));

  if (minPrice != null || maxPrice != null) {
    if (minPrice != null) constraints.push(where('minPrice', '>=', minPrice));
    if (maxPrice != null) constraints.push(where('minPrice', '<=', maxPrice));
  } else if (minRating != null) {
    constraints.push(where('averageRating', '>=', minRating));
  }

  const snap = await getCountFromServer(
    query(collection(serverDb, FirestoreCollections.products), ...constraints),
  );
  return snap.data().count;
}
