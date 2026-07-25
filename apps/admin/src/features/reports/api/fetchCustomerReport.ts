import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getCountFromServer,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { UserProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';
import type { CustomerReportData, TopCustomer } from '../types';

/**
 * fetchCustomerReport — new-customer count in range, repeat-customer count, and the top spenders
 * (spec §1.19 "New customers" summary card + customer insights).
 *
 * WHY aggregation counts + one bounded top-N read (not a scan): new customers = count of users with
 * createdAt in range; repeat customers = count of users whose denormalized `totalOrders >= 2`; top
 * customers = the 10 highest `totalSpent`. All are index-cheap server-side reads.
 * NOTE: `repeatCustomers` uses the all-time `totalOrders` field (not orders-in-range) — a true in-range
 * repeat metric would need an order scan grouped by user; the all-time flag is the cheap faithful proxy.
 */
export const fetchCustomerReport = createAsyncThunk<
  CustomerReportData,
  { from: number; to: number },
  { rejectValue: string }
>('reports/fetchCustomer', async ({ from, to }, { rejectWithValue }) => {
  try {
    const col = collection(db, FirestoreCollections.users);
    const fromTs = Timestamp.fromDate(new Date(from));
    const toTs = Timestamp.fromDate(new Date(to));

    const [newSnap, repeatSnap, totalSnap, topSnap] = await Promise.all([
      getCountFromServer(
        query(col, where('createdAt', '>=', fromTs), where('createdAt', '<=', toTs)),
      ),
      // All-time repeat customers (>= 2 orders). See NOTE above.
      getCountFromServer(query(col, where('totalOrders', '>=', 2))),
      getCountFromServer(query(col)),
      // Bounded top-N: the 10 highest lifetime spenders (single small read, not paginated).
      getDocs(query(col, orderBy('totalSpent', 'desc'), limit(10))),
    ]);

    const topCustomers: TopCustomer[] = topSnap.docs.map((d) => {
      const u = { ...d.data(), id: d.id } as UserProps;
      return {
        id: u.id,
        fullName: u.fullName || '—',
        totalOrders: u.totalOrders ?? 0,
        totalSpent: u.totalSpent ?? 0,
      };
    });

    return {
      newCustomers: newSnap.data().count,
      repeatCustomers: repeatSnap.data().count,
      totalCustomers: totalSnap.data().count,
      topCustomers,
    };
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not load customer report');
  }
});
