import { createAsyncThunk } from '@reduxjs/toolkit';
import { collection, collectionGroup, query, where, getCountFromServer } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import { StockStatus } from '@barakath/shared/config/enums';
import { db } from '@/lib/firebaseConfig';
import type { InventoryCounts } from '../types';

/**
 * fetchInventoryCounts — the four summary-card figures (design §08): product counts by stock status
 * (In stock / Low / Out) plus the total SKU (variant) count.
 *
 * WHY aggregation queries (getCountFromServer): counts must reflect the WHOLE catalogue, not the loaded
 * page. Stock-status counts run on the product docs' denormalized `stockStatus`; the SKU total is a
 * `variants` collection-group count.
 */
export const fetchInventoryCounts = createAsyncThunk<InventoryCounts, void, { rejectValue: string }>(
  'inventory/fetchCounts',
  async (_, { rejectWithValue }) => {
    try {
      const products = collection(db, FirestoreCollections.products);
      const byStatus = (s: StockStatus) =>
        getCountFromServer(query(products, where('stockStatus', '==', s)));

      const [inStock, lowStock, outOfStock, skus] = await Promise.all([
        byStatus(StockStatus.IN_STOCK),
        byStatus(StockStatus.LOW_STOCK),
        byStatus(StockStatus.OUT_OF_STOCK),
        getCountFromServer(collectionGroup(db, FirestoreCollections.variants)),
      ]);

      return {
        inStock: inStock.data().count,
        lowStock: lowStock.data().count,
        outOfStock: outOfStock.data().count,
        totalSkus: skus.data().count,
      };
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Could not load inventory counts');
    }
  },
);
