import { createAsyncThunk } from '@reduxjs/toolkit';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import { StockStatus } from '@barakath/shared/config/enums';
import type { ProductProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';
import type { LowStockItem } from '../types';

/**
 * fetchLowStockProducts — up to 5 low/out-of-stock products for the alerts panel (spec §1.3).
 *
 * WHY `in` + limit(5): a bounded preview of the products needing attention, ordered by lowest stock
 * first. A single capped read (not pagination) — the full view lives on the Inventory screen.
 * (An `in` filter + orderBy needs a composite index; Firestore surfaces a one-click link if missing.)
 */
export const fetchLowStockProducts = createAsyncThunk<LowStockItem[], void, { rejectValue: string }>(
  'dashboard/fetchLowStockProducts',
  async (_, { rejectWithValue }) => {
    try {
      const snap = await getDocs(
        query(
          collection(db, FirestoreCollections.products),
          where('stockStatus', 'in', [StockStatus.LOW_STOCK, StockStatus.OUT_OF_STOCK]),
          orderBy('totalStock', 'asc'),
          limit(5),
        ),
      );
      return snap.docs.map((d) => {
        const p = { ...d.data(), id: d.id } as ProductProps;
        return {
          productName: p.name,
          sku: p.sku,
          totalStock: p.totalStock,
          lowStockThreshold: p.lowStockThreshold,
        };
      });
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Could not load low-stock alerts');
    }
  },
);
