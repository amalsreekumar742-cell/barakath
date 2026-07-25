import { createAsyncThunk } from '@reduxjs/toolkit';
import { collection, query, where, orderBy, limit, startAfter, getDocs } from 'firebase/firestore';
import { format } from 'date-fns';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { OrderProps, WalletTransactionProps, AffiliateTransactionProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';
import { formatINR } from '@/utils/format';
import { downloadCSV } from '../utils/csv';
import type { CustomerTab } from '../types';

/**
 * exportCustomerTabCSV — "Export data" on the Customer detail page (design screens 12/45/46). Exports
 * whichever data tab is currently active (Orders/Wallet/Affiliate) for THIS customer, not the whole
 * collection — same bounded 500-doc-per-page pattern as `exportCustomersCSV`, scoped by `userId`.
 */
type ExportableTab = Exclude<CustomerTab, 'addresses'>;

const dateStr = (t: OrderProps['createdAt']) => (t ? format(t.toDate(), 'dd MMM yyyy, HH:mm') : '');

async function collectAll<T>(
  collectionName: string,
  userId: string,
  toRow: (d: T & { id: string }) => string[],
): Promise<string[][]> {
  const rows: string[][] = [];
  let cursor: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any -- Firestore cursor
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const snap = await getDocs(
      query(
        collection(db, collectionName),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        ...(cursor ? [startAfter(cursor)] : []),
        limit(500),
      ),
    );
    if (snap.empty) break;
    for (const d of snap.docs) rows.push(toRow({ ...d.data(), id: d.id } as T & { id: string }));
    cursor = snap.docs[snap.docs.length - 1] ?? null;
    if (snap.docs.length < 500) break;
  }
  return rows;
}

export const exportCustomerTabCSV = createAsyncThunk<
  number,
  { userId: string; customerName: string; tab: ExportableTab },
  { rejectValue: string }
>('customers/exportTabCSV', async ({ userId, customerName, tab }, { rejectWithValue }) => {
  try {
    let headers: string[];
    let rows: string[][];

    if (tab === 'orders') {
      headers = ['Order ID', 'Items', 'Total', 'Status', 'Date'];
      rows = await collectAll<OrderProps>(FirestoreCollections.orders, userId, (o) => [
        o.id,
        String(o.items?.length ?? 0),
        formatINR(o.grandTotal),
        o.status,
        dateStr(o.createdAt),
      ]);
    } else if (tab === 'wallet') {
      headers = ['Type', 'Amount', 'Source', 'Description', 'Balance After', 'Date'];
      rows = await collectAll<WalletTransactionProps>(FirestoreCollections.walletTransactions, userId, (t) => [
        t.type,
        formatINR(t.amount),
        t.source,
        t.description,
        formatINR(t.balanceAfter),
        dateStr(t.createdAt),
      ]);
    } else {
      headers = ['Type', 'Amount', 'Source', 'Description', 'Referred User', 'Status', 'Date'];
      rows = await collectAll<AffiliateTransactionProps>(FirestoreCollections.affiliateTransactions, userId, (t) => [
        t.type,
        formatINR(t.amount),
        t.source,
        t.description,
        t.referredUserName,
        t.status,
        dateStr(t.createdAt),
      ]);
    }

    const safeName = customerName.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || userId;
    downloadCSV(headers, rows, `${safeName}-${tab}-${Date.now()}.csv`);
    return rows.length;
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not export data');
  }
});
