import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  collection,
  collectionGroup,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  getCountFromServer,
} from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import { StockStatus } from '@barakath/shared/config/enums';
import type { ProductProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';
import type { InventoryReportData, InventoryLowStockItem } from '../types';

/**
 * fetchInventoryReport — stock-status product counts, total SKU count, an estimated catalogue value and
 * the low/out-of-stock list (spec §1.19 inventory status / §1.6 inventory).
 *
 * WHY status counts + SKU count use aggregation queries: they reflect the WHOLE catalogue, computed
 * server-side on the denormalized `stockStatus` and a `variants` collection-group count — never a
 * client loop. The low/out list is a single bounded `in` read (limit 20).
 */

const CHUNK = 500;
const VALUE_SCAN_CAP = 3000;

/**
 * Estimated catalogue value = Σ (product.totalStock × product.minPrice).
 *
 * TODO: move to Cloud Function — this scans product docs to approximate value and, more accurately,
 * value should sum each VARIANT's stock × its own offerPrice (variants price independently). A nightly
 * inventory-valuation rollup should replace this bounded client scan; `minPrice` is a per-product
 * lower-bound approximation used here to avoid reading every variant subcollection.
 */
async function estimateCatalogueValue(): Promise<number> {
  const col = collection(db, FirestoreCollections.products);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Firestore pagination cursor
  let cursor: any = null;
  let value = 0;
  let read = 0;

  while (read < VALUE_SCAN_CAP) {
    const snap = await getDocs(
      query(col, orderBy('name'), ...(cursor ? [startAfter(cursor)] : []), limit(CHUNK)),
    );
    if (snap.empty) break;
    for (const d of snap.docs) {
      const p = { ...d.data(), id: d.id } as ProductProps;
      value += (p.totalStock ?? 0) * (p.minPrice ?? 0);
    }
    read += snap.docs.length;
    cursor = snap.docs[snap.docs.length - 1] ?? null;
    if (snap.docs.length < CHUNK) break;
  }
  return value;
}

export const fetchInventoryReport = createAsyncThunk<
  InventoryReportData,
  void,
  { rejectValue: string }
>('reports/fetchInventory', async (_, { rejectWithValue }) => {
  try {
    const products = collection(db, FirestoreCollections.products);
    const byStatus = (s: StockStatus) =>
      getCountFromServer(query(products, where('stockStatus', '==', s)));

    const [inStock, lowStock, outOfStock, skus, lowSnap, estimatedValue] = await Promise.all([
      byStatus(StockStatus.IN_STOCK),
      byStatus(StockStatus.LOW_STOCK),
      byStatus(StockStatus.OUT_OF_STOCK),
      getCountFromServer(collectionGroup(db, FirestoreCollections.variants)),
      getDocs(
        query(
          products,
          where('stockStatus', 'in', [StockStatus.LOW_STOCK, StockStatus.OUT_OF_STOCK]),
          limit(20),
        ),
      ),
      estimateCatalogueValue(),
    ]);

    const lowStockItems: InventoryLowStockItem[] = lowSnap.docs
      .map((d) => {
        const p = { ...d.data(), id: d.id } as ProductProps;
        return {
          productId: p.id,
          productName: p.name,
          sku: p.sku,
          totalStock: p.totalStock ?? 0,
          stockStatus: p.stockStatus,
        };
      })
      .sort((a, b) => a.totalStock - b.totalStock);

    const inStockCount = inStock.data().count;
    const lowStockCount = lowStock.data().count;
    const outCount = outOfStock.data().count;

    return {
      inStock: inStockCount,
      lowStock: lowStockCount,
      outOfStock: outCount,
      totalProducts: inStockCount + lowStockCount + outCount,
      totalSkus: skus.data().count,
      estimatedValue,
      lowStockItems,
    };
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not load inventory report');
  }
});
