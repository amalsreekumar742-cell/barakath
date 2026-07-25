import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
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
}

/** Product-doc constraints for the inventory search (design §08 — search by product keywords). */
export function inventoryConstraints(filters: InventoryFilters): QueryConstraint[] {
  const c: QueryConstraint[] = [];
  if (filters.searchTerm?.trim())
    c.push(where('keywords', 'array-contains', filters.searchTerm.trim().toLowerCase()));
  return c;
}

/**
 * fetchInventory — one cursor-paginated page of VARIANT-level inventory rows (design §08 Inventory).
 *
 * WHY paginate on PRODUCTS but render VARIANTS: variants live in a subcollection and carry no product
 * name/SKU, and can't be searched by product fields. So we page the product documents (search runs
 * server-side, newest first), then read each page-product's variants and flatten them into variant
 * rows with a per-variant status derived from stock vs the product threshold. `hasMore` tracks the
 * PRODUCT cursor, so a page yields all variants of up to PAGE_SIZE products.
 */
export const fetchInventory = createAsyncThunk<
  InventoryPageResult,
  { filters: InventoryFilters; cursor?: QueryDocumentSnapshot | null },
  { rejectValue: string }
>('inventory/fetchPage', async ({ filters, cursor }, { rejectWithValue }) => {
  try {
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
          const v = { ...vd.data(), id: vd.id } as VariantProps;
          rows.push({
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
          });
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
