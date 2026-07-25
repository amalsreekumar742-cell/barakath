import { createAsyncThunk } from '@reduxjs/toolkit';
import { collection, query, orderBy, limit, startAfter, getDocs } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { ProductProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';
import { formatShortDate } from '@/utils/format';
import { productFilterConstraints } from './fetchProducts';
import type { ProductFilters } from '../types';

/**
 * exportProductsCSV — export every product matching the current filters as a CSV download (spec §1.22:
 * CSV for all exports).
 *
 * WHY page through everything (batches of 500) rather than one unbounded read: the export must cover
 * ALL matches, but we still never issue an uncapped `getDocs` — we cursor through in bounded chunks,
 * which also keeps memory reasonable. The CSV is built in-memory and downloaded via a Blob URL.
 */
const CSV_HEADERS = [
  'Name',
  'SKU',
  'Category',
  'Sub-category',
  'Total Stock',
  'Stock Status',
  'Status',
  'Created Date',
];

const escape = (v: string | number): string => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const exportProductsCSV = createAsyncThunk<number, ProductFilters, { rejectValue: string }>(
  'products/exportCSV',
  async (filters, { rejectWithValue }) => {
    try {
      const rows: string[] = [CSV_HEADERS.join(',')];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Firestore pagination cursor
      let cursor: any = null;
      let total = 0;

      // Cursor through all matching pages (bounded 500-doc chunks — never an unbounded read).
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const snap = await getDocs(
          query(
            collection(db, FirestoreCollections.products),
            ...productFilterConstraints(filters),
            orderBy('createdAt', 'desc'),
            ...(cursor ? [startAfter(cursor)] : []),
            limit(500),
          ),
        );
        if (snap.empty) break;
        for (const d of snap.docs) {
          const p = { ...d.data(), id: d.id } as ProductProps;
          rows.push(
            [
              escape(p.name),
              escape(p.sku),
              escape(p.categoryName),
              escape(p.subCategoryName),
              escape(p.totalStock),
              escape(p.stockStatus),
              escape(p.status),
              escape(formatShortDate(p.createdAt)),
            ].join(','),
          );
        }
        total += snap.docs.length;
        cursor = snap.docs[snap.docs.length - 1] ?? null;
        if (snap.docs.length < 500) break;
      }

      // Trigger the browser download.
      const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `products-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      return total;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Could not export products');
    }
  },
);
