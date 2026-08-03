import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  collection,
  collectionGroup,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  documentId,
  getDocs,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { ProductProps, VariantProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';
import { Constants } from '@/config/constants';
import { deriveStockStatus } from '@/features/products/utils/stock';
import { variantSku, variantLabel } from '../utils/variant';
import type { InventoryFilters, InventoryRow } from '../types';

export interface InventoryPageResult {
  rows: InventoryRow[];
  lastVisible: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- Firestore cursor
  hasMore: boolean;
  /**
   * True when a stock-sorted scan hit one of the caps below, so the ranking does NOT cover the whole
   * catalogue. The page says so rather than quietly presenting a partial ranking as complete.
   */
  truncated?: boolean;
}

/** Chunk size for the bounded full scans a stock sort performs. */
const SCAN_CHUNK = 500;
/** Hard ceilings on a stock-sorted scan, so it can never become an unbounded read. */
const MAX_SCANNED_PRODUCTS = 2000;
const MAX_SCANNED_VARIANTS = 5000;

/**
 * Rows revealed per "View More" click under a stock sort.
 *
 * WHY not `Constants.PAGE_SIZE`: that is a page of 12 PRODUCTS, which flattens to roughly three times
 * as many variant rows. Matching the felt page length keeps the two orderings consistent to use.
 */
export const STOCK_PAGE_ROWS = 36;

/**
 * Product-doc constraints for the inventory search + category filter (design §08 — search by product
 * keywords). Ordered equality-first then array-contains to match the composite index field order
 * Firestore requires (see `firebase/firestore.indexes.json`).
 */
export function inventoryConstraints(filters: InventoryFilters): QueryConstraint[] {
  const c: QueryConstraint[] = [];
  if (filters.categoryId) c.push(where('categoryId', '==', filters.categoryId));
  if (filters.searchTerm?.trim())
    c.push(where('keywords', 'array-contains', filters.searchTerm.trim().toLowerCase()));
  return c;
}

/** True when the caller asked for a stock ordering rather than the default newest-first list. */
export const isStockSort = (filters: InventoryFilters) =>
  filters.sort === 'stockAsc' || filters.sort === 'stockDesc';

/** Orders two rows by the VARIANT's own stock in the requested direction, name-stable on ties. */
export function compareByStock(a: InventoryRow, b: InventoryRow, sort: InventoryFilters['sort']) {
  const delta = sort === 'stockDesc' ? b.stock - a.stock : a.stock - b.stock;
  if (delta !== 0) return delta;
  return a.productName.localeCompare(b.productName) || a.sku.localeCompare(b.sku);
}

function toRow(p: ProductProps, v: VariantProps): InventoryRow {
  return {
    productId: p.id,
    productName: p.name,
    productSku: p.sku,
    sku: variantSku(p.sku, v.color, v.name),
    variantLabel: variantLabel(v.color, v.name),
    lowStockThreshold: p.lowStockThreshold ?? 0,
    variantId: v.id,
    variantName: v.name,
    variantColor: v.color,
    colorCode: v.colorCode,
    stock: v.stock,
    status: deriveStockStatus(v.stock, p.lowStockThreshold ?? 0),
    updatedAt: p.updatedAt ?? null,
  };
}

/**
 * Every product matching the filters, in bounded `SCAN_CHUNK` pages.
 *
 * WHY it always orders by `createdAt desc` even when the caller wants a stock order: the ordering here
 * is only a pagination key — the rows are sorted in memory afterwards. Reusing the order the plain list
 * already uses means every filter combination is served by an index that exists.
 */
async function scanMatchingProducts(filters: InventoryFilters) {
  const products: ProductProps[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Firestore pagination cursor
  let cursor: any = null;
  let capped = false;

  while (products.length < MAX_SCANNED_PRODUCTS) {
    const snap = await getDocs(
      query(
        collection(db, FirestoreCollections.products),
        ...inventoryConstraints(filters),
        orderBy('createdAt', 'desc'),
        ...(cursor ? [startAfter(cursor)] : []),
        limit(SCAN_CHUNK),
      ),
    );
    products.push(...snap.docs.map((d) => ({ ...d.data(), id: d.id }) as ProductProps));
    cursor = snap.docs[snap.docs.length - 1] ?? null;
    if (snap.docs.length < SCAN_CHUNK) return { products, capped };
  }
  capped = true;
  return { products, capped };
}

/**
 * Every variant of the given products, as sortable rows.
 *
 * WHY one `variants` COLLECTION GROUP query instead of one subcollection read per product: a scan of N
 * products would otherwise be N round trips. The collection group reads the same documents in
 * `SCAN_CHUNK`-sized pages — for the whole catalogue that is typically a single query — and variants
 * whose parent product is not in `byId` (filtered out by category/search) are simply dropped.
 *
 * WHY it pages by `documentId()`: `__name__` is the one ordering guaranteed to be indexed for a
 * collection group query, so this needs no index of its own.
 */
async function scanVariantRows(byId: Map<string, ProductProps>) {
  const rows: InventoryRow[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Firestore pagination cursor
  let cursor: any = null;
  let scanned = 0;

  while (scanned < MAX_SCANNED_VARIANTS) {
    const snap = await getDocs(
      query(
        collectionGroup(db, FirestoreCollections.variants),
        orderBy(documentId()),
        ...(cursor ? [startAfter(cursor)] : []),
        limit(SCAN_CHUNK),
      ),
    );
    for (const vd of snap.docs) {
      const productId = vd.ref.parent.parent?.id ?? '';
      const p = byId.get(productId);
      if (p) rows.push(toRow(p, { ...vd.data(), id: vd.id } as VariantProps));
    }
    scanned += snap.docs.length;
    cursor = snap.docs[snap.docs.length - 1] ?? null;
    if (snap.docs.length < SCAN_CHUNK) return { rows, capped: false };
  }
  return { rows, capped: true };
}

/**
 * fetchInventory — VARIANT-level inventory rows (design §08 Inventory).
 *
 * TWO LOAD STRATEGIES, because the two orderings need different things:
 *
 * • Newest first (the default) — cursor-paginated on the PRODUCT documents, then each page-product's
 *   variants are read and flattened. `hasMore` tracks the PRODUCT cursor, so a page yields all variants
 *   of up to PAGE_SIZE products. This is the original behaviour and is unchanged.
 *
 * • Stock: Low/High — a bounded full scan, sorted in memory by each VARIANT's own `stock`.
 *   WHY not a Firestore `orderBy`: the rows are variants, but the query has to page product documents
 *   (variants live in a subcollection and carry no product name/SKU/category to filter on). Ordering
 *   the product query by the denormalized `totalStock` sorts PRODUCTS, which shows up on screen as a
 *   column that jumps — 178, 85, 40, 25, 12, 40, 25, 12 — because each product's variants stay grouped.
 *   The only ordering that is actually correct for a variant table is one computed over the variants
 *   themselves, and Firestore cannot do that across a filtered product set. So the scan is capped
 *   (MAX_SCANNED_*) and the result is capped (MAX_STOCK_SORTED_ROWS) rather than paginated: sorting by
 *   stock is a "which SKUs are at the extremes" question, and `truncated` tells the page to say so.
 */
export const fetchInventory = createAsyncThunk<
  InventoryPageResult,
  { filters: InventoryFilters; cursor?: QueryDocumentSnapshot | null },
  { rejectValue: string }
>('inventory/fetchPage', async ({ filters, cursor }, { rejectWithValue }) => {
  try {
    if (isStockSort(filters)) {
      const { products, capped: productsCapped } = await scanMatchingProducts(filters);
      const byId = new Map(products.map((p) => [p.id, p]));
      const { rows, capped: variantsCapped } = await scanVariantRows(byId);

      rows.sort((a, b) => compareByStock(a, b, filters.sort));
      // The whole ranking is returned; the slice hands it to the table `STOCK_PAGE_ROWS` at a time so
      // "View More" still lazy-loads. WHY page in the slice rather than here: a correct ranking cannot
      // be built one page at a time (page 2 could contain a row that belongs at the very top), so the
      // scan happens once per filter change and every later page is served from it — no re-reads.
      return { rows, lastVisible: null, hasMore: false, truncated: productsCapped || variantsCapped };
    }

    const snap = await getDocs(
      query(
        collection(db, FirestoreCollections.products),
        ...inventoryConstraints(filters),
        orderBy('createdAt', 'desc'),
        ...(cursor ? [startAfter(cursor)] : []),
        limit(Constants.PAGE_SIZE),
      ),
    );
    const products = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as ProductProps);

    const rows: InventoryRow[] = [];
    await Promise.all(
      products.map(async (p) => {
        const varSnap = await getDocs(
          query(
            collection(db, FirestoreCollections.products, p.id, FirestoreCollections.variants),
            orderBy('createdAt', 'asc'),
          ),
        );
        for (const vd of varSnap.docs) {
          rows.push(toRow(p, { ...vd.data(), id: vd.id } as VariantProps));
        }
      }),
    );

    // Promise.all can resolve out of order — restore the product page order.
    const order = new Map(products.map((p, i) => [p.id, i]));
    rows.sort((a, b) => (order.get(a.productId) ?? 0) - (order.get(b.productId) ?? 0));

    return {
      rows,
      lastVisible: snap.docs[snap.docs.length - 1] ?? null,
      hasMore: products.length === Constants.PAGE_SIZE,
    };
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not load inventory');
  }
});
