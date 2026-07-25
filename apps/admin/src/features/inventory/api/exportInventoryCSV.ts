import { createAsyncThunk } from '@reduxjs/toolkit';
import { collection, query, orderBy, limit, startAfter, getDocs } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { ProductProps, VariantProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';
import { deriveStockStatus } from '@/features/products/utils/stock';
import { inventoryConstraints } from './fetchInventory';
import { variantSku, variantLabel } from '../utils/variant';
import type { InventoryFilters } from '../types';

/**
 * exportInventoryCSV — export every inventory row (one per variant) matching the current search
 * (design §08 Export, §1.22 CSV). Pages products in bounded 500-doc chunks (never an unbounded read),
 * reads each product's variants, and streams variant rows into an in-memory CSV downloaded via a Blob.
 */
const CSV_HEADERS = ['Product', 'SKU', 'Variant', 'In Stock', 'Status'];

const escape = (v: string | number): string => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const exportInventoryCSV = createAsyncThunk<number, InventoryFilters, { rejectValue: string }>(
  'inventory/exportCSV',
  async (filters, { rejectWithValue }) => {
    try {
      const rows: string[] = [CSV_HEADERS.join(',')];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Firestore pagination cursor
      let cursor: any = null;
      let total = 0;

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const snap = await getDocs(
          query(
            collection(db, FirestoreCollections.products),
            ...inventoryConstraints(filters),
            orderBy('createdAt', 'desc'),
            ...(cursor ? [startAfter(cursor)] : []),
            limit(500),
          ),
        );
        if (snap.empty) break;
        for (const pd of snap.docs) {
          const p = { ...pd.data(), id: pd.id } as ProductProps;
          const varSnap = await getDocs(
            collection(db, FirestoreCollections.products, p.id, FirestoreCollections.variants),
          );
          for (const vd of varSnap.docs) {
            const v = { ...vd.data(), id: vd.id } as VariantProps;
            rows.push(
              [
                escape(p.name),
                escape(variantSku(p.sku, v.color, v.name)),
                escape(variantLabel(v.color, v.name)),
                escape(v.stock),
                escape(deriveStockStatus(v.stock, p.lowStockThreshold ?? 0)),
              ].join(','),
            );
            total += 1;
          }
        }
        cursor = snap.docs[snap.docs.length - 1] ?? null;
        if (snap.docs.length < 500) break;
      }

      const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inventory-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      return total;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Could not export inventory');
    }
  },
);
