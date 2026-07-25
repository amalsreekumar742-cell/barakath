import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  collection,
  query,
  where,
  sum,
  getAggregateFromServer,
  Timestamp,
} from 'firebase/firestore';
import {
  startOfDay,
  addDays,
  startOfMonth,
  addMonths,
  subDays,
  subMonths,
  format,
} from 'date-fns';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import { OrderStatus } from '@barakath/shared/config/enums';
import { db } from '@/lib/firebaseConfig';
import type { ChartPeriod, RevenueChartData } from '../types';

/**
 * fetchRevenueChart — revenue-over-time series for the bar chart (spec §1.3, 12M/30D/7D toggle).
 *
 * WHY one aggregation per bucket (not fetch-all-and-group client-side): each bucket total is computed
 * server-side via `sum('grandTotal')`; we run the buckets concurrently. This keeps billing to a handful
 * of index scans instead of reading every order in the window. Cancelled orders are excluded to mirror
 * the KPI revenue definition.
 */

// Sum of non-cancelled revenue in [start, end).
async function bucketRevenue(start: Date, end: Date): Promise<number> {
  const snap = await getAggregateFromServer(
    query(
      collection(db, FirestoreCollections.orders),
      where('createdAt', '>=', Timestamp.fromDate(start)),
      where('createdAt', '<', Timestamp.fromDate(end)),
      where('status', '!=', OrderStatus.CANCELLED),
    ),
    { total: sum('grandTotal') },
  );
  return snap.data().total ?? 0;
}

export const fetchRevenueChart = createAsyncThunk<
  RevenueChartData,
  ChartPeriod,
  { rejectValue: string }
>('dashboard/fetchRevenueChart', async (period, { rejectWithValue }) => {
  try {
    const now = new Date();
    const buckets: { start: Date; end: Date; label: string }[] = [];

    if (period === '12M') {
      // 12 monthly buckets ending with the current month.
      const first = startOfMonth(subMonths(now, 11));
      for (let i = 0; i < 12; i++) {
        const start = addMonths(first, i);
        buckets.push({ start, end: addMonths(start, 1), label: format(start, 'MMM') });
      }
    } else {
      // Daily buckets: 7 or 30 days ending today.
      const days = period === '7D' ? 7 : 30;
      const first = startOfDay(subDays(now, days - 1));
      const labelFmt = period === '7D' ? 'EEE' : 'd/M';
      for (let i = 0; i < days; i++) {
        const start = addDays(first, i);
        buckets.push({ start, end: addDays(start, 1), label: format(start, labelFmt) });
      }
    }

    const data = await Promise.all(buckets.map((b) => bucketRevenue(b.start, b.end)));
    return { labels: buckets.map((b) => b.label), data };
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not load revenue chart');
  }
});
