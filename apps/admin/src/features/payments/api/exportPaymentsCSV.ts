import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  startAt,
  endAt,
  getDocs,
  type QueryConstraint,
} from 'firebase/firestore';
import { format } from 'date-fns';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { PaymentProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';
import { paymentEqualityConstraints } from './fetchPayments';
import type { PaymentFilters } from '../types';

/**
 * exportPaymentsCSV — export every payment matching the current filters as CSV (spec §1.9 Export, §1.22
 * CSV). Pages through all matches in bounded 500-doc chunks (never an unbounded read), mirroring the
 * listing's two query modes (order-id prefix search vs. createdAt-desc + date range).
 */
const CSV_HEADERS = [
  'Payment ID',
  'Order ID',
  'Customer',
  'Phone',
  'Amount',
  'Method',
  'Razorpay Payment ID',
  'Wallet Used',
  'Status',
  'GST',
  'Date',
];

const escape = (v: string | number): string => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const exportPaymentsCSV = createAsyncThunk<number, PaymentFilters, { rejectValue: string }>(
  'payments/exportCSV',
  async (filters, { rejectWithValue }) => {
    try {
      const col = collection(db, FirestoreCollections.payments);
      const term = filters.searchTerm.trim();
      const rows: string[] = [CSV_HEADERS.join(',')];
      let cursor: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any -- Firestore cursor
      let total = 0;

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const constraints: QueryConstraint[] = [...paymentEqualityConstraints(filters)];
        if (term) {
          constraints.push(orderBy('orderId'));
          constraints.push(cursor ? startAfter(cursor) : startAt(term));
          constraints.push(endAt(term + ''));
        } else {
          if (filters.dateFrom) constraints.push(where('createdAt', '>=', filters.dateFrom));
          if (filters.dateTo) constraints.push(where('createdAt', '<=', filters.dateTo));
          constraints.push(orderBy('createdAt', 'desc'));
          if (cursor) constraints.push(startAfter(cursor));
        }
        constraints.push(limit(500));

        const snap = await getDocs(query(col, ...constraints));
        if (snap.empty) break;
        for (const d of snap.docs) {
          const p = { ...d.data(), id: d.id } as PaymentProps;
          rows.push(
            [
              escape(p.id),
              escape(p.orderId),
              escape(p.userName),
              escape(p.userPhone),
              escape(p.amount),
              escape(p.method),
              escape(p.razorpayPaymentId || '—'),
              escape(p.walletAmountUsed ?? 0),
              escape(p.status),
              escape(p.gstAmount ?? 0),
              escape(p.createdAt ? format(p.createdAt.toDate(), 'dd MMM yyyy, hh:mm a') : ''),
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
      a.download = `payments-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      return total;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Could not export payments');
    }
  },
);
