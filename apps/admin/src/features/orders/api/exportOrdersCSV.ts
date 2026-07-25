import { createAsyncThunk } from '@reduxjs/toolkit';
import { collection, query, orderBy, limit, startAfter, getDocs } from 'firebase/firestore';
import { format } from 'date-fns';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { OrderProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';
import { orderFilterConstraints } from './fetchOrders';
import type { OrderFilters } from '../types';

/**
 * exportOrdersCSV — export every order matching the current filters as CSV (spec §1.7 Export, §1.22
 * CSV). Pages through all matches in bounded 500-doc chunks (never an unbounded read); the CSV is built
 * in memory and downloaded via a Blob URL.
 */
const CSV_HEADERS = [
  'Order ID',
  'Customer',
  'Phone',
  'Items Count',
  'Subtotal',
  'Discount',
  'Delivery',
  'GST',
  'Grand Total',
  'Payment Method',
  'Payment Status',
  'Order Status',
  'Date',
];

const escape = (v: string | number): string => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const exportOrdersCSV = createAsyncThunk<number, OrderFilters, { rejectValue: string }>(
  'orders/exportCSV',
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
            collection(db, FirestoreCollections.orders),
            ...orderFilterConstraints(filters),
            orderBy('createdAt', 'desc'),
            ...(cursor ? [startAfter(cursor)] : []),
            limit(500),
          ),
        );
        if (snap.empty) break;
        for (const d of snap.docs) {
          const o = { ...d.data(), id: d.id } as OrderProps;
          rows.push(
            [
              escape(o.id),
              escape(o.userName),
              escape(o.userPhone),
              escape(o.items?.length ?? 0),
              escape(o.subtotal),
              escape(o.couponDiscount),
              escape(o.deliveryCharge),
              escape(o.gstAmount),
              escape(o.grandTotal),
              escape(o.paymentMethod),
              escape(o.paymentStatus),
              escape(o.status),
              escape(o.createdAt ? format(o.createdAt.toDate(), 'dd MMM yyyy, hh:mm a') : ''),
            ].join(','),
          );
        }
        total += snap.docs.length;
        cursor = snap.docs[snap.docs.length - 1] ?? null;
        if (snap.docs.length < 500) break;
      }

      const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orders-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      return total;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Could not export orders');
    }
  },
);
