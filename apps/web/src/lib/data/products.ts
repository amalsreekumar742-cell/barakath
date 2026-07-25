import 'server-only';

import {
  collection,
  doc,
  endBefore,
  getCountFromServer,
  getDoc,
  getDocs,
  limit as fsLimit,
  limitToLast,
  orderBy,
  query,
  startAfter,
  where,
  type DocumentData,
  type QueryConstraint,
  type QuerySnapshot,
} from 'firebase/firestore';
import { FirestoreCollections, ProductStatus } from '@barakath/shared';
import type { ProductProps } from '@barakath/shared';
import { Constants } from '@/config/constants';
import { serverDb } from './serverFirestore';
import { getProductsByIds, getSubCategories } from './catalog';

/**
 * products — the ONE product-query builder the Listing, Search-results and Banner (category) pages
 * share (spec §3.6, §3.20, §3.22). Like `catalog.ts` it is `server-only` and reads the public
 * `products` collection with `serverDb`; every list read is capped and cursor-paginated.
 *
 * WHY one builder rather than a query per screen: the three screens differ only in which filters are
 * set, and duplicating the "always `status == Active`, one sort, cursor paginate" skeleton three times
 * is three chances to forget the status filter (which silently leaks archived products) or mis-order a
 * range against its sort (which throws `FAILED_PRECONDITION` and renders empty). Deciding it once here
 * keeps the index requirements in `firestore.indexes.json` bounded and predictable.
 */

// ---------------------------------------------------------------------------
// Sort
// ---------------------------------------------------------------------------

/** The sort keys the listing/search UIs offer. */
export type ProductSort = 'popularity' | 'newest' | 'priceAsc' | 'priceDesc' | 'rating';

/**
 * Each sort key mapped to the Firestore ordering it needs.
 *
 * WHY `popularity` → `totalReviews desc`: there is NO `ordersCount`/sales counter anywhere in the
 * schema, so review volume is the only honest, already-denormalised popularity proxy (the same one
 * W0's `getBestSellers` uses). Sorting by a non-existent field would silently return nothing.
 *
 * WHY `priceDesc` also orders by `minPrice` (not `maxPrice`): a query with an equality-pinned prefix
 * (`status == Active`, plus any category/flag equalities) can traverse the `minPrice` index in EITHER
 * direction, so one `minPrice` index serves both `priceAsc` and `priceDesc` — no separate `maxPrice`
 * desc index is needed, and the "from" price the card shows is the field being ordered.
 */
const SORT: Record<ProductSort, { field: string; direction: 'asc' | 'desc' }> = {
  popularity: { field: 'totalReviews', direction: 'desc' },
  newest: { field: 'createdAt', direction: 'desc' },
  priceAsc: { field: 'minPrice', direction: 'asc' },
  priceDesc: { field: 'minPrice', direction: 'desc' },
  rating: { field: 'averageRating', direction: 'desc' },
};

// ---------------------------------------------------------------------------
// buildProductQuery
// ---------------------------------------------------------------------------

export interface BuildProductQueryParams {
  categoryId?: string;
  /** Sub-category NAMES (products denormalise `subCategoryName`). Use together with `categoryId`. */
  subCategoryNames?: string[];
  /** A caller-supplied, finite set (e.g. frequently-bought-together). Bypasses cursor pagination. */
  productIds?: string[];
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  stockFilter?: 'inStock' | 'all';
  /** `'onSale'` means FLASH sale only (`isFlashSale == true`) — not any product with a discount. */
  saleFilter?: 'onSale' | 'all';
  isNewArrival?: boolean;
  sort?: ProductSort;
  /** Document id to page forward from (`?after=`). */
  after?: string;
  /** Document id to page backward from (`?before=`). */
  before?: string;
  limit?: number;
}

/** One page of products, plus the cursor ids and Next/Prev availability the UI needs. */
export interface PageResult {
  items: ProductProps[];
  /** First document id of the RAW Firestore page — the cursor for paging backward (`before=`). */
  firstDocId: string | null;
  /** Last document id of the RAW Firestore page — the cursor for paging forward (`after=`). */
  lastDocId: string | null;
  hasNext: boolean;
  hasPrev: boolean;
}

/** Context `toPageResult` needs beyond the snapshot itself. */
export interface ToPageResultContext {
  /** The page size the query asked for — a full page implies there is more to fetch. */
  limit: number;
  /** `'backward'` when reached via `before=` (endBefore + limitToLast); default `'forward'`. */
  direction?: 'forward' | 'backward';
  /** Whether a forward cursor (`after=`) was used to reach this page — i.e. not page 1. */
  hasCursor?: boolean;
}

/** Map a snapshot to a typed domain object; the doc id always wins over any `id` field inside. */
function mapDocs(snap: QuerySnapshot<DocumentData>): ProductProps[] {
  return snap.docs.map((d) => ({ ...d.data(), id: d.id }) as ProductProps);
}

/**
 * Turn a raw product snapshot into a `PageResult`.
 *
 * WHY `firstDocId`/`lastDocId` come from the RAW snapshot (before any in-memory narrowing): the cursors
 * must track the true Firestore page boundary, or Next/Prev would skip or repeat rows. In-memory
 * range-narrowing (below) only trims what is DISPLAYED, never the cursor.
 *
 * WHY the `hasNext`/`hasPrev` heuristics: with cursor pagination you cannot know there is a next page
 * without over-fetching, so a FULL page (`size === limit`) is taken to imply "probably more" — the same
 * `hasMore = length === pageSize` rule the rest of `catalog.ts` uses. Backward pages always have a
 * forward neighbour (the page you came from), so `hasNext` is forced true there.
 */
export function toPageResult(
  snap: QuerySnapshot<DocumentData>,
  ctx: ToPageResultContext,
): PageResult {
  const items = mapDocs(snap);
  const firstDocId = snap.docs[0]?.id ?? null;
  const lastDocId = snap.docs[snap.docs.length - 1]?.id ?? null;
  const full = snap.size === ctx.limit;

  if (ctx.direction === 'backward') {
    // Reached by paging back: there is a page ahead of us; a full page means more still exist behind.
    return { items, firstDocId, lastDocId, hasNext: true, hasPrev: full };
  }
  return { items, firstDocId, lastDocId, hasNext: full, hasPrev: Boolean(ctx.hasCursor) };
}

/**
 * Narrow a fetched page in memory by the range filters that could not ride the query's single orderBy
 * slot. WHY in memory: Firestore allows a range/inequality on only ONE field and it must be the first
 * orderBy (the prompt's stated rule). The sort already owns that slot, so `totalStock > 0`, and price/
 * rating ranges when they do NOT match the sort field, are applied here. Consequence: a page may show
 * fewer than `limit` items, but the cursor still advances by the true Firestore boundary.
 */
function narrow(
  items: ProductProps[],
  f: { minPrice?: number; maxPrice?: number; minRating?: number; stockFilter?: 'inStock' | 'all' },
): ProductProps[] {
  return items.filter((p) => {
    if (f.stockFilter === 'inStock' && !(p.totalStock > 0)) return false;
    if (f.minPrice != null && p.minPrice < f.minPrice) return false;
    if (f.maxPrice != null && p.minPrice > f.maxPrice) return false;
    if (f.minRating != null && p.averageRating < f.minRating) return false;
    return true;
  });
}

/**
 * Build and run one product-listing query.
 *
 * Server-side (drives the composite indexes): `status == Active` (always) + optional equalities
 * (`categoryId`, `subCategoryName` ==/in, `isNewArrival`, `isFlashSale`) + one sort + cursor + limit.
 * The ONE range that can ride the sort's orderBy field is pushed server-side and stays precise: price
 * bounds when sorting by price, `minRating` when sorting by rating. Every OTHER range (stock always;
 * price/rating when the sort is on a different field) is narrowed in memory over the fetched page.
 */
export async function buildProductQuery(params: BuildProductQueryParams): Promise<PageResult> {
  const {
    categoryId,
    subCategoryNames,
    productIds,
    minPrice,
    maxPrice,
    minRating,
    stockFilter,
    saleFilter,
    isNewArrival,
    sort = 'newest',
    after,
    before,
    limit: pageSize = Constants.PAGE_SIZE,
  } = params;

  // --- productIds mode: a finite, caller-supplied set (frequently-bought-together, curated rows). ---
  // WHY it bypasses cursor pagination: the id set is bounded and supplied whole, so there is nothing to
  // page; `getProductsByIds` already chunks the `documentId() in` query by 30 and drops inactive ones.
  // Results are re-sorted to the REQUESTED id order (the order the caller intends), then range-narrowed.
  if (productIds && productIds.length > 0) {
    const fetched = await getProductsByIds(productIds);
    const rank = new Map(productIds.map((id, i) => [id, i]));
    const ordered = fetched
      .filter((p) => rank.has(p.id))
      .sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
    const items = narrow(ordered, { minPrice, maxPrice, minRating, stockFilter });
    return {
      items,
      firstDocId: items[0]?.id ?? null,
      lastDocId: items[items.length - 1]?.id ?? null,
      hasNext: false,
      hasPrev: false,
    };
  }

  const order = SORT[sort];

  // The single range allowed server-side is the one whose field IS the sort field.
  const priceServerSide = sort === 'priceAsc' || sort === 'priceDesc';
  const ratingServerSide = sort === 'rating';

  const constraints: QueryConstraint[] = [where('status', '==', ProductStatus.ACTIVE)];
  if (categoryId) constraints.push(where('categoryId', '==', categoryId));
  if (subCategoryNames && subCategoryNames.length === 1) {
    constraints.push(where('subCategoryName', '==', subCategoryNames[0]));
  } else if (subCategoryNames && subCategoryNames.length > 1) {
    // `in` is an equality-class filter (caps at 30 values) — same index as `==`.
    constraints.push(where('subCategoryName', 'in', subCategoryNames.slice(0, 30)));
  }
  if (isNewArrival) constraints.push(where('isNewArrival', '==', true));
  if (saleFilter === 'onSale') constraints.push(where('isFlashSale', '==', true));
  if (priceServerSide) {
    if (minPrice != null) constraints.push(where('minPrice', '>=', minPrice));
    if (maxPrice != null) constraints.push(where('minPrice', '<=', maxPrice));
  }
  if (ratingServerSide && minRating != null) {
    constraints.push(where('averageRating', '>=', minRating));
  }

  constraints.push(orderBy(order.field, order.direction));

  const direction: 'forward' | 'backward' = before ? 'backward' : 'forward';
  if (after) {
    const cursor = await getDoc(doc(serverDb, FirestoreCollections.products, after));
    if (cursor.exists()) constraints.push(startAfter(cursor));
    constraints.push(fsLimit(pageSize));
  } else if (before) {
    const cursor = await getDoc(doc(serverDb, FirestoreCollections.products, before));
    if (cursor.exists()) constraints.push(endBefore(cursor));
    constraints.push(limitToLast(pageSize));
  } else {
    constraints.push(fsLimit(pageSize));
  }

  const snap = await getDocs(query(collection(serverDb, FirestoreCollections.products), ...constraints));
  const result = toPageResult(snap, {
    limit: pageSize,
    direction,
    hasCursor: Boolean(after),
  });

  // Narrow only the DISPLAYED items; cursors keep the raw Firestore boundary (see toPageResult).
  result.items = narrow(result.items, {
    minPrice: priceServerSide ? undefined : minPrice,
    maxPrice: priceServerSide ? undefined : maxPrice,
    minRating: ratingServerSide ? undefined : minRating,
    stockFilter,
  });
  return result;
}

// ---------------------------------------------------------------------------
// Facets (filter sidebar)
// ---------------------------------------------------------------------------

/** One sub-category with its active-product count, for the listing filter sidebar. */
export interface SubCategoryFacet {
  name: string;
  count: number;
}

export interface FilterFacets {
  subCategories: SubCategoryFacet[];
  /** The price range of the active products in scope; null when the scope is empty. */
  priceBounds: { min: number; max: number } | null;
}

/**
 * Facets for the filter sidebar: a count per sub-category and the price bounds of the scope.
 *
 * WHY `getCountFromServer` per sub-category rather than a client-side tally: an aggregation is computed
 * server-side and billed as a few index entries scanned, not one document read per product — so counting
 * a category's sub-categories costs a handful of aggregations, not a full scan of the catalogue. The
 * `(status, categoryId, subCategoryName, …)` composite indexes already cover the equality-only counts.
 *
 * WHY the price bounds are two `limit(1)` reads (cheapest ascending, dearest descending) rather than a
 * `min()`/`max()` aggregation: Firestore has no min/max aggregate, and the ordered `limit(1)` reads a
 * single document each on indexes that already exist (`(status[, categoryId], minPrice|maxPrice)`).
 */
export async function getFilterFacets({
  categoryId,
}: {
  categoryId?: string;
}): Promise<FilterFacets> {
  const productsRef = collection(serverDb, FirestoreCollections.products);
  const scope: QueryConstraint[] = [where('status', '==', ProductStatus.ACTIVE)];
  if (categoryId) scope.push(where('categoryId', '==', categoryId));

  // Sub-category counts — only meaningful within a category, so skip the reads when unscoped.
  const subCategoryNames = categoryId
    ? (await getSubCategories(categoryId)).map((s) => s.name)
    : [];

  const [counts, lowSnap, highSnap] = await Promise.all([
    Promise.all(
      subCategoryNames.map(async (name) => {
        const countSnap = await getCountFromServer(
          query(productsRef, ...scope, where('subCategoryName', '==', name)),
        );
        return { name, count: countSnap.data().count } satisfies SubCategoryFacet;
      }),
    ),
    getDocs(query(productsRef, ...scope, orderBy('minPrice', 'asc'), fsLimit(1))),
    getDocs(query(productsRef, ...scope, orderBy('maxPrice', 'desc'), fsLimit(1))),
  ]);

  const low = lowSnap.docs[0]?.data() as ProductProps | undefined;
  const high = highSnap.docs[0]?.data() as ProductProps | undefined;
  const priceBounds =
    low && high ? { min: low.minPrice, max: high.maxPrice } : null;

  return { subCategories: counts, priceBounds };
}
