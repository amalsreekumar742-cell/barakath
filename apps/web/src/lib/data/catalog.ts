import 'server-only';

import {
  collection,
  collectionGroup,
  doc,
  documentId,
  endBefore,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  limitToLast,
  orderBy,
  query,
  startAfter,
  where,
  type DocumentData,
  type Query,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type QuerySnapshot,
} from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared';
import type {
  BannerProps,
  CategoryProps,
  ProductProps,
  ReviewProps,
  SubCategoryProps,
  VariantProps,
} from '@barakath/shared';
import { Constants } from '@/config/constants';
import { serverDb } from './serverFirestore';

/**
 * Server-side catalog reads — the ONLY place a Server Component touches Firestore.
 *
 * WHY this sits in `lib/data/` rather than a feature's `api/` as `createAsyncThunk`s: the web skill
 * puts client reads in thunks because they feed a Redux slice with loading/error state. A Server
 * Component has no store and no lifecycle — it awaits a value and renders. Wrapping these in thunks
 * would mean shipping the queries to the browser to run them on the server, which is the opposite of
 * the point. Client-side reads still go through feature `api/` thunks; this module is server-only,
 * enforced by `import 'server-only'`.
 *
 * Every function here obeys the same rules as a thunk would: `FirestoreCollections` instead of
 * literals, a `limit()` on every list read with no exceptions, cursor pagination rather than offset,
 * and docs mapped to typed `XxxProps` so a Server Component never sees raw `DocumentData`.
 */

/** One page of a cursor-paginated read. `cursor` is fed straight back to `startAfter`. */
export interface Page<T> {
  items: T[];
  /** The last document of this page, or null when the page is empty. */
  cursor: QueryDocumentSnapshot<DocumentData> | null;
  /** A FULL page probably has more behind it; a short page is the end. */
  hasMore: boolean;
}

/** Map a snapshot to a typed domain object. The doc id always wins over any `id` field inside. */
function mapDocs<T>(snap: { docs: QueryDocumentSnapshot<DocumentData>[] }): T[] {
  return snap.docs.map((d) => ({ ...d.data(), id: d.id })) as T[];
}

async function runPage<T>(q: Query<DocumentData>, pageSize: number): Promise<Page<T>> {
  const snap = await getDocs(q);
  return {
    items: mapDocs<T>(snap),
    cursor: snap.docs[snap.docs.length - 1] ?? null,
    hasMore: snap.docs.length === pageSize,
  };
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

/**
 * Every category, oldest first — the order the admin created them, which is the order the app's
 * home screen and category tab already use, so the two clients list them identically.
 *
 * WHY a hard cap rather than pagination: the mega menu and the categories page both need the whole
 * list at once to render, and a store has tens of categories, not thousands. The cap is the skill's
 * "bounded lookup read" — still never an unbounded `getDocs`.
 */
export async function getCategories(max: number = Constants.MAX_CATEGORIES): Promise<CategoryProps[]> {
  const snap = await getDocs(
    query(collection(serverDb, FirestoreCollections.categories), orderBy('createdAt'), limit(max)),
  );
  return mapDocs<CategoryProps>(snap);
}

/** The two plain fields the client-side nav (mega menu, mobile drawer, search dropdown) reads. */
export interface NavCategory {
  id: string;
  name: string;
}

/**
 * Strips a category down to `NavCategory` before it crosses into a Client Component.
 *
 * WHY: `CategoryProps.createdAt`/`updatedAt` are Firestore `Timestamp` objects, which carry a
 * `toJSON` method — React rejects any prop shaped like that on a Client Component ("Only plain
 * objects can be passed to Client Components from Server Components"). The nav components only ever
 * read `id`/`name`, so this is the fix, not a workaround: stop handing the client more of the
 * document than it uses.
 */
export function toNavCategories(categories: CategoryProps[]): NavCategory[] {
  return categories.map(({ id, name }) => ({ id, name }));
}

/**
 * A category by NAME, because the route is `/category/[categoryName]` — a readable slug beats a
 * Firestore id in a URL and in a shared link.
 *
 * WHY a query rather than a doc read: `name` is what the URL carries and it is not the document id.
 * Matching is exact on the stored name; the caller decodes the URL segment first.
 */
export async function getCategoryByName(name: string): Promise<CategoryProps | null> {
  const snap = await getDocs(
    query(
      collection(serverDb, FirestoreCollections.categories),
      where('name', '==', name),
      limit(1),
    ),
  );
  const [category] = mapDocs<CategoryProps>(snap);
  return category ?? null;
}

/** The sub-categories of one category — its own subcollection, not a field (spec §1.4). */
export async function getSubCategories(categoryId: string): Promise<SubCategoryProps[]> {
  const snap = await getDocs(
    query(
      collection(
        serverDb,
        FirestoreCollections.categories,
        categoryId,
        FirestoreCollections.subCategories,
      ),
      limit(Constants.MAX_SUBCATEGORIES),
    ),
  );
  return mapDocs<SubCategoryProps>(snap);
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

/** Sort keys the listing page offers, mapped to the Firestore ordering each one needs. */
export type ProductSort = 'newest' | 'priceAsc' | 'priceDesc' | 'rating' | 'popularity';

const SORT_ORDER: Record<ProductSort, { field: string; direction: 'asc' | 'desc' }> = {
  newest: { field: 'createdAt', direction: 'desc' },
  priceAsc: { field: 'minPrice', direction: 'asc' },
  priceDesc: { field: 'maxPrice', direction: 'desc' },
  rating: { field: 'averageRating', direction: 'desc' },
  // "Popularity" has no dedicated counter in the schema; review volume is the closest honest proxy.
  popularity: { field: 'totalReviews', direction: 'desc' },
};

export interface ProductQueryOptions {
  categoryId?: string;
  subCategoryName?: string;
  sort?: ProductSort;
  cursor?: QueryDocumentSnapshot<DocumentData> | null;
  pageSize?: number;
}

/**
 * A page of ACTIVE products, filtered and sorted for the listing page.
 *
 * WHY `status == Active` is always applied: a draft or archived product must never reach the
 * storefront, and leaving that to the caller means one forgotten filter leaks the whole catalogue.
 *
 * WHY price and rating filters are NOT here: Firestore allows range filters on only one field per
 * query, and that slot is already spent by the sort. Price/rating narrowing happens over the fetched
 * page in the listing feature — which is why the sidebar's ranges are bounded by the result set.
 */
export async function getProducts({
  categoryId,
  subCategoryName,
  sort = 'newest',
  cursor = null,
  pageSize = Constants.PAGE_SIZE,
}: ProductQueryOptions = {}): Promise<Page<ProductProps>> {
  const order = SORT_ORDER[sort];
  const q = query(
    collection(serverDb, FirestoreCollections.products),
    where('status', '==', 'Active'),
    ...(categoryId ? [where('categoryId', '==', categoryId)] : []),
    ...(subCategoryName ? [where('subCategoryName', '==', subCategoryName)] : []),
    orderBy(order.field, order.direction),
    ...(cursor ? [startAfter(cursor)] : []),
    limit(pageSize),
  );
  return runPage<ProductProps>(q, pageSize);
}

export async function getProductById(productId: string): Promise<ProductProps | null> {
  const snap = await getDoc(doc(serverDb, FirestoreCollections.products, productId));
  if (!snap.exists()) return null;
  const product = { ...snap.data(), id: snap.id } as ProductProps;
  // A product the admin has taken down must 404 rather than render at a guessable URL.
  return product.status === 'Active' ? product : null;
}

/**
 * A product's variants — the subcollection `products/{id}/variants/{id}`.
 *
 * WHY it matters that this is a subcollection: price, stock and per-variant images live ONLY here,
 * and there is no top-level `variants` collection. Reading the wrong path is how the app once
 * rendered a whole category at ₹0 — the query succeeded and returned nothing.
 */
export async function getVariants(productId: string): Promise<VariantProps[]> {
  const snap = await getDocs(
    query(
      collection(
        serverDb,
        FirestoreCollections.products,
        productId,
        FirestoreCollections.variants,
      ),
      orderBy('createdAt'),
      limit(Constants.MAX_VARIANTS),
    ),
  );
  return mapDocs<VariantProps>(snap);
}

/**
 * The first variant of each product — what a product card needs to show a price.
 *
 * WHY one bounded read per product, fired in parallel: variants are a SUBCOLLECTION, so a single
 * query cannot span parents unless it is a collection-group query — and a collection-group query
 * cannot be filtered by parent id (`documentId()` there matches the variant's own path segment, not
 * the product). The honest options are N small reads or fetching every variant in the database and
 * discarding most. `Promise.all` makes the N reads one round-trip wide, which is what actually
 * matters for time-to-first-paint; each read is `limit(1)`, so the cost is one document per card.
 */
export async function getFirstVariantByProduct(
  productIds: string[],
): Promise<Record<string, VariantProps>> {
  const result: Record<string, VariantProps> = {};
  if (productIds.length === 0) return result;

  await Promise.all(
    productIds.map(async (productId) => {
      const snap = await getDocs(
        query(
          collection(
            serverDb,
            FirestoreCollections.products,
            productId,
            FirestoreCollections.variants,
          ),
          orderBy('createdAt'),
          limit(1),
        ),
      );
      const [variant] = mapDocs<VariantProps>(snap);
      if (variant) result[productId] = variant;
    }),
  );
  return result;
}

/** Products flagged into the running flash sale (spec §1.16). */
export async function getFlashSaleProducts(max: number = Constants.PAGE_SIZE): Promise<ProductProps[]> {
  const snap = await getDocs(
    query(
      collection(serverDb, FirestoreCollections.products),
      where('status', '==', 'Active'),
      where('isFlashSale', '==', true),
      orderBy('createdAt', 'desc'),
      limit(max),
    ),
  );
  return mapDocs<ProductProps>(snap);
}

export async function getNewArrivals(max: number = Constants.PAGE_SIZE): Promise<ProductProps[]> {
  const snap = await getDocs(
    query(
      collection(serverDb, FirestoreCollections.products),
      where('status', '==', 'Active'),
      where('isNewArrival', '==', true),
      orderBy('createdAt', 'desc'),
      limit(max),
    ),
  );
  return mapDocs<ProductProps>(snap);
}

/** Highest-rated active products — the design's "Best sellers" rail. */
export async function getBestSellers(max: number = Constants.PAGE_SIZE): Promise<ProductProps[]> {
  const snap = await getDocs(
    query(
      collection(serverDb, FirestoreCollections.products),
      where('status', '==', 'Active'),
      orderBy('totalReviews', 'desc'),
      limit(max),
    ),
  );
  return mapDocs<ProductProps>(snap);
}

/** Several products by id — for "frequently bought together" and banner product lists. */
export async function getProductsByIds(ids: string[]): Promise<ProductProps[]> {
  if (ids.length === 0) return [];
  // `in` caps at 30 values; chunk so a long list still resolves in a bounded number of reads.
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));

  const pages = await Promise.all(
    chunks.map((chunk) =>
      getDocs(
        query(
          collection(serverDb, FirestoreCollections.products),
          where(documentId(), 'in', chunk),
          limit(chunk.length),
        ),
      ),
    ),
  );
  return pages.flatMap((snap) => mapDocs<ProductProps>(snap)).filter((p) => p.status === 'Active');
}

// ---------------------------------------------------------------------------
// Banners & reviews
// ---------------------------------------------------------------------------

/**
 * Active banners for a placement, in the admin's chosen order.
 *
 * WHY the date window is filtered in code rather than in the query: a scheduled banner needs both
 * `startDate <= now` and `endDate >= now`, and Firestore permits range filters on only one field per
 * query. The list is already capped, so the second comparison costs nothing.
 */
export async function getBanners(
  placement: 'Website' | 'Both' = 'Both',
  max: number = Constants.MAX_BANNERS,
): Promise<BannerProps[]> {
  const snap = await getDocs(
    query(
      collection(serverDb, FirestoreCollections.banners),
      where('isActive', '==', true),
      where('placement', 'in', [placement, 'Both']),
      orderBy('position'),
      limit(max),
    ),
  );
  const now = Date.now();
  return mapDocs<BannerProps>(snap).filter((b) => {
    const startsBy = b.startDate ? b.startDate.toMillis() <= now : true;
    const endsAfter = b.endDate ? b.endDate.toMillis() >= now : true;
    return startsBy && endsAfter;
  });
}

/** One page of a product's PUBLISHED reviews, newest first. */
export async function getProductReviews(
  productId: string,
  cursor: QueryDocumentSnapshot<DocumentData> | null = null,
  pageSize: number = Constants.PAGE_SIZE,
): Promise<Page<ReviewProps>> {
  const q = query(
    collection(serverDb, FirestoreCollections.reviews),
    where('productId', '==', productId),
    where('isPublished', '==', true),
    orderBy('createdAt', 'desc'),
    ...(cursor ? [startAfter(cursor)] : []),
    limit(pageSize),
  );
  return runPage<ReviewProps>(q, pageSize);
}

// ---------------------------------------------------------------------------
// Search — /search results page (spec 3.20)
// ---------------------------------------------------------------------------

/**
 * Split a raw search query into the lowercased word tokens Firestore can actually match against
 * `keywords`.
 *
 * WHY tokenize instead of matching the raw string: the shared `keywordsBuilder` strips ALL whitespace
 * from every prefix it stores (see `packages/shared/src/utils/keywordsBuilder.ts`), so the `keywords`
 * array never contains an entry with an embedded space — a two-word query passed through whole (e.g.
 * `"royal oud"`) can never `array-contains` match anything. It DOES store each word's own prefixes
 * standalone (both "royal" and "oud" appear, because `keywordsBuilder` restarts its prefix loop at
 * every word boundary), so splitting the query on whitespace and matching ANY token via
 * `array-contains-any` finds what the visitor actually typed — this mirrors `keywordsBuilder`'s own
 * per-word-start loop rather than inventing a different matching scheme.
 *
 * WHY capped at `SEARCH_QUERY_MAX_LENGTH` chars before splitting and 30 tokens after: an unbounded
 * `?q=` is a cheap way to build a pathological Firestore call — `array-contains-any` itself errors
 * past 30 values, so the cap keeps the query always valid instead of throwing.
 */
function tokenizeSearchTerm(raw: string, maxTokens = 30): string[] {
  const capped = raw.trim().slice(0, Constants.SEARCH_QUERY_MAX_LENGTH).toLowerCase();
  return Array.from(new Set(capped.split(/\s+/).filter(Boolean))).slice(0, maxTokens);
}

/**
 * One page of a doc-id, cursor-paginated read — the same shape `buildProductQuery` returns as
 * `PageResult` (`src/lib/data/products.ts`), so `/search` can use the identical `Pagination` +
 * `hrefBuilder` + `?after=`/`?before=` convention the listing/category pages use. Declared locally
 * rather than imported: `products.ts` imports FROM this file (`getProductsByIds`, `getSubCategories`),
 * so importing its type back here would be a circular module edge.
 */
export interface SearchPageResult {
  items: ProductProps[];
  /** First document id of this page — the cursor for paging backward (`before=`). */
  firstDocId: string | null;
  /** Last document id of this page — the cursor for paging forward (`after=`). */
  lastDocId: string | null;
  hasNext: boolean;
  hasPrev: boolean;
}

/** Map a raw products snapshot + paging context into a `SearchPageResult`. */
function toSearchPageResult(
  snap: QuerySnapshot<DocumentData>,
  pageSize: number,
  direction: 'forward' | 'backward',
  hasCursor: boolean,
): SearchPageResult {
  const items = mapDocs<ProductProps>(snap);
  const firstDocId = snap.docs[0]?.id ?? null;
  const lastDocId = snap.docs[snap.docs.length - 1]?.id ?? null;
  const full = snap.docs.length === pageSize;
  if (direction === 'backward') {
    // Reached by paging back: a page ahead of us is guaranteed; a full page means more lie behind too.
    return { items, firstDocId, lastDocId, hasNext: true, hasPrev: full };
  }
  return { items, firstDocId, lastDocId, hasNext: full, hasPrev: hasCursor };
}

/**
 * One page of ACTIVE products whose search keywords match `term` — the /search results page.
 *
 * WHY it lives here and not in a feature `api/` thunk: the results page is a Server Component in the
 * (shop) group, so — like every other catalog read — it awaits a value and renders, with no store to
 * feed. The live SUGGESTIONS dropdown in the header IS client-side (it reacts to keystrokes), and
 * queries Firestore directly from a hook; this is its server-rendered twin for the full page.
 *
 * WHY the same three-part shape as `getProducts` (`status == Active` + a keywords array match + a
 * `createdAt` sort): the composite index `status ASC · keywords CONTAINS · createdAt DESC` already
 * exists in firestore.indexes.json ("APP search (spec §2.6)") and serves `array-contains-any` on the
 * same field just as it serves `array-contains`, so this reuses it rather than asking for a new one.
 *
 * WHY doc-id `after`/`before` cursors (not a `QueryDocumentSnapshot`): a Server Component reads
 * `searchParams` from the URL, and a snapshot cannot be serialised into one — see `buildProductQuery`
 * in `products.ts`, which established this exact convention for the listing/category pages.
 */
export async function searchProducts(
  term: string,
  {
    after,
    before,
    pageSize = Constants.PAGE_SIZE,
  }: { after?: string; before?: string; pageSize?: number } = {},
): Promise<SearchPageResult> {
  const tokens = tokenizeSearchTerm(term);
  // No usable token — return an empty page rather than an unfiltered (or invalid, zero-value) read.
  if (tokens.length === 0) {
    return { items: [], firstDocId: null, lastDocId: null, hasNext: false, hasPrev: false };
  }

  const constraints: QueryConstraint[] = [
    where('status', '==', 'Active'),
    where('keywords', 'array-contains-any', tokens),
    orderBy('createdAt', 'desc'),
  ];

  const direction: 'forward' | 'backward' = before ? 'backward' : 'forward';
  if (after) {
    const cursor = await getDoc(doc(serverDb, FirestoreCollections.products, after));
    if (cursor.exists()) constraints.push(startAfter(cursor));
    constraints.push(limit(pageSize));
  } else if (before) {
    const cursor = await getDoc(doc(serverDb, FirestoreCollections.products, before));
    if (cursor.exists()) constraints.push(endBefore(cursor));
    constraints.push(limitToLast(pageSize));
  } else {
    constraints.push(limit(pageSize));
  }

  const snap = await getDocs(
    query(collection(serverDb, FirestoreCollections.products), ...constraints),
  );
  return toSearchPageResult(snap, pageSize, direction, Boolean(after));
}

/**
 * The TOTAL count of active products matching `term` — spec 3.20's "24 results for …" needs the real
 * total, not the current page's length. Uses `getCountFromServer` (the skill's mandatory aggregation
 * path for any count) rather than fetching every match and counting client-side: it is computed
 * server-side and billed as a handful of index entries, not one read per matching product. Shares the
 * exact `status`/`keywords` prefix `searchProducts` queries, so no `orderBy` is needed and no
 * additional index is required beyond the one that already serves `searchProducts`.
 */
export async function countSearchResults(term: string): Promise<number> {
  const tokens = tokenizeSearchTerm(term);
  if (tokens.length === 0) return 0;
  const snap = await getCountFromServer(
    query(
      collection(serverDb, FirestoreCollections.products),
      where('status', '==', 'Active'),
      where('keywords', 'array-contains-any', tokens),
    ),
  );
  return snap.data().count;
}

/**
 * Categories whose keywords match `term` — spec 3.20 asks the results page to search categories and
 * sub-categories alongside products, rendered as a small link row above the product grid. Bounded by
 * `SEARCH_GROUP_LIMIT` (the same cap the header's live suggestions use for each group) rather than
 * paginated: a compact "did you mean this section" row, not a second listing.
 *
 * WHY no composite index is needed: with no other `where`/`orderBy`, `array-contains-any` on a single
 * field is served by Firestore's automatic single-field array index — the same reason the header's
 * `useSearchSuggestions` hook already runs this exact shape of query without one.
 */
export async function searchCategories(
  term: string,
  max = Constants.SEARCH_GROUP_LIMIT,
): Promise<CategoryProps[]> {
  const tokens = tokenizeSearchTerm(term);
  if (tokens.length === 0) return [];
  const snap = await getDocs(
    query(
      collection(serverDb, FirestoreCollections.categories),
      where('keywords', 'array-contains-any', tokens),
      limit(max),
    ),
  );
  return mapDocs<CategoryProps>(snap);
}

/**
 * Sub-categories whose keywords match `term`, via a COLLECTION-GROUP query — sub-categories are a
 * subcollection (`categories/{id}/subCategories`), so matching across every category needs
 * `collectionGroup`, not `collection`. Server-rendered twin of the header dropdown's sub-category
 * group; see `searchCategories` for why no composite index is required here either.
 */
export async function searchSubCategories(
  term: string,
  max = Constants.SEARCH_GROUP_LIMIT,
): Promise<SubCategoryProps[]> {
  const tokens = tokenizeSearchTerm(term);
  if (tokens.length === 0) return [];
  const snap = await getDocs(
    query(
      collectionGroup(serverDb, FirestoreCollections.subCategories),
      where('keywords', 'array-contains-any', tokens),
      limit(max),
    ),
  );
  return mapDocs<SubCategoryProps>(snap);
}

/**
 * Every active product id — for the sitemap only.
 *
 * WHY a dedicated function with its own cap: the sitemap is the one place that legitimately wants
 * the whole catalogue, and letting it reuse `getProducts` would encourage someone to page a listing
 * screen to exhaustion. The cap is explicit so a catalogue that outgrows it fails loudly in review
 * rather than silently truncating search coverage.
 */
export async function getAllProductIdsForSitemap(): Promise<string[]> {
  const snap = await getDocs(
    query(
      collection(serverDb, FirestoreCollections.products),
      where('status', '==', 'Active'),
      orderBy('createdAt', 'desc'),
      limit(Constants.SITEMAP_MAX_PRODUCTS),
    ),
  );
  return snap.docs.map((d) => d.id);
}
