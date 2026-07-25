import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  collection,
  query,
  where,
  sum,
  getAggregateFromServer,
  getCountFromServer,
  Timestamp,
} from 'firebase/firestore';
import {
  startOfDay,
  subDays,
  startOfWeek,
  subWeeks,
  startOfMonth,
  subMonths,
} from 'date-fns';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import { OrderStatus } from '@barakath/shared/config/enums';
import { db } from '@/lib/firebaseConfig';
import type { DashboardStats } from '../types';

/**
 * fetchDashboardStats — the four KPI tiles (spec §1.3).
 *
 * WHY aggregation queries (getAggregateFromServer / getCountFromServer), never a client loop-and-sum
 * (skill "Mandatory aggregation queries"): sums/counts are computed server-side and only the single
 * summary value is transmitted — billed as a few index entries, not one read per order. Reading every
 * order to total it client-side would be slow and expensive.
 *
 * WHY the boundaries come from date-fns: correct start-of-day/week/month math (week starts Monday) so
 * "today", "this week", "this month" and their prior periods are compared like-for-like.
 */

const ordersRef = () => collection(db, FirestoreCollections.orders);

// Revenue (excluding cancelled) within [start, end). Returns a plain number.
async function sumRevenue(start: Date, end?: Date): Promise<number> {
  const filters = [
    where('createdAt', '>=', Timestamp.fromDate(start)),
    where('status', '!=', OrderStatus.CANCELLED),
  ];
  if (end) filters.push(where('createdAt', '<', Timestamp.fromDate(end)));
  const snap = await getAggregateFromServer(query(ordersRef(), ...filters), {
    total: sum('grandTotal'),
  });
  return snap.data().total ?? 0;
}

// Order count within [start, end), optionally filtered to an exact status.
async function countOrders(start: Date, end: Date | undefined, statusEq?: string): Promise<number> {
  const filters = [where('createdAt', '>=', Timestamp.fromDate(start))];
  if (end) filters.push(where('createdAt', '<', Timestamp.fromDate(end)));
  if (statusEq) filters.push(where('status', '==', statusEq));
  const snap = await getCountFromServer(query(ordersRef(), ...filters));
  return snap.data().count;
}

// Count of orders currently in a given status (no date bound).
async function countByStatus(statusEq: string): Promise<number> {
  const snap = await getCountFromServer(query(ordersRef(), where('status', '==', statusEq)));
  return snap.data().count;
}

// Signed % change of current vs previous. If previous is 0: 100% up when current>0, else 0.
function trend(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export const fetchDashboardStats = createAsyncThunk<DashboardStats, void, { rejectValue: string }>(
  'dashboard/fetchStats',
  async (_, { rejectWithValue }) => {
    try {
      const now = new Date();
      const todayStart = startOfDay(now);
      const yesterdayStart = startOfDay(subDays(now, 1));
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
      const monthStart = startOfMonth(now);
      const lastMonthStart = startOfMonth(subMonths(now, 1));

      // Run the independent aggregations concurrently.
      const [
        todayRevenue,
        yesterdayRevenue,
        totalOrdersWeek,
        lastWeekOrders,
        pendingOrders,
        monthRevenue,
        monthOrders,
        lastMonthRevenue,
        lastMonthOrders,
      ] = await Promise.all([
        sumRevenue(todayStart),
        sumRevenue(yesterdayStart, todayStart),
        countOrders(weekStart, undefined),
        countOrders(lastWeekStart, weekStart),
        countByStatus(OrderStatus.PENDING),
        sumRevenue(monthStart),
        countOrders(monthStart, undefined),
        sumRevenue(lastMonthStart, monthStart),
        countOrders(lastMonthStart, monthStart),
      ]);

      const avgOrderValue = monthOrders > 0 ? monthRevenue / monthOrders : 0;
      const lastAvg = lastMonthOrders > 0 ? lastMonthRevenue / lastMonthOrders : 0;

      return {
        todayRevenue,
        revenueTrend: trend(todayRevenue, yesterdayRevenue),
        totalOrdersWeek,
        ordersTrend: trend(totalOrdersWeek, lastWeekOrders),
        pendingOrders,
        avgOrderValue,
        avgTrend: trend(avgOrderValue, lastAvg),
      };
    } catch (err) {
      return rejectWithValue(
        err instanceof Error ? err.message : 'Could not load dashboard stats',
      );
    }
  },
);
