import { createAsyncThunk } from '@reduxjs/toolkit';
import { collection, query, orderBy, limit, startAfter, getDocs } from 'firebase/firestore';
import { format } from 'date-fns';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { UserProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';
import { customerFilterConstraints } from './fetchCustomers';
import type { CustomerFilters } from '../types';

/**
 * exportCustomersCSV — export every customer matching the current filters as CSV (spec §1.8 Export,
 * §1.22 CSV). Pages through all matches in bounded 500-doc chunks (never an unbounded read); the CSV is
 * built in memory and downloaded via a Blob URL. Returns the row count for the success toast.
 */
const CSV_HEADERS = [
  'Name',
  'Email',
  'Phone',
  'Status',
  'Wallet Balance',
  'Total Orders',
  'Total Spent',
  'Joined Date',
];

const escape = (v: string | number): string => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const exportCustomersCSV = createAsyncThunk<number, CustomerFilters, { rejectValue: string }>(
  'customers/exportCSV',
  async (filters, { rejectWithValue }) => {
    try {
      const rows: string[] = [CSV_HEADERS.join(',')];
      let cursor: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any -- Firestore cursor
      let total = 0;

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const snap = await getDocs(
          query(
            collection(db, FirestoreCollections.users),
            ...customerFilterConstraints(filters),
            orderBy('createdAt', 'desc'),
            ...(cursor ? [startAfter(cursor)] : []),
            limit(500),
          ),
        );
        if (snap.empty) break;
        for (const d of snap.docs) {
          const u = { ...d.data(), id: d.id } as UserProps;
          rows.push(
            [
              escape(u.fullName),
              escape(u.email),
              escape(u.phone),
              escape(u.status),
              escape(u.walletBalance ?? 0),
              escape(u.totalOrders ?? 0),
              escape(u.totalSpent ?? 0),
              escape(u.createdAt ? format(u.createdAt.toDate(), 'dd MMM yyyy') : ''),
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
      a.download = `customers-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      return total;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Could not export customers');
    }
  },
);
