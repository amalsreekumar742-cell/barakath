import { createAsyncThunk } from '@reduxjs/toolkit';
import { collection, query, orderBy, limit, startAfter, getDocs } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { ProductProps, VariantProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';
import { deriveStockStatus } from '@/features/products/utils/stock';
import { inventoryConstraints, isStockSort, compareByStock } from './fetchInventory';
import { variantSku, variantLabel } from '../utils/variant';
import type { InventoryFilters, InventoryRow } from '../types';

/**
 * exportInventoryCSV — export every inventory row (one per variant) matching the current search and
 * category (design §08 Export, §1.22 CSV). Pages products in bounded 500-doc chunks (never an unbounded
 * read), reads each product's variants, and streams variant rows into an in-memory CSV via a Blob.
 *
 * WHY the sort is applied over the WHOLE result rather than per product: unlike the on-screen list this
 * already walks every matching product, so a stock ordering here can be exact — and the export is not
 * capped, so a "Stock: Low to High" CSV is the complete ranking even when the screen shows only the
 * first page of it.
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
      const rows: InventoryRow[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Firestore pagination cursor
      let cursor: any = null;

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
        }
        cursor = snap.docs[snap.docs.length - 1] ?? null;
        if (snap.docs.length < 500) break;
      }

      if (isStockSort(filters)) rows.sort((a, b) => compareByStock(a, b, filters.sort));

      const lines = [
        CSV_HEADERS.join(','),
        ...rows.map((r) =>
          [
            escape(r.productName),
            escape(r.sku),
            escape(r.variantLabel),
            escape(r.stock),
            escape(r.status),
          ].join(','),
        ),
      ];

      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inventory-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      return rows.length;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Could not export inventory');
    }
  },
);
