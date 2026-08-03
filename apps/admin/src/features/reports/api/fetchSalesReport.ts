import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  collection,
  query,
  where,
  sum,
  count,
  getAggregateFromServer,
  Timestamp,
} from 'firebase/firestore';
import {
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  addDays,
  addWeeks,
  addMonths,
  format,
} from 'date-fns';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import { OrderStatus } from '@barakath/shared/config/enums';
import { db } from '@/lib/firebaseConfig';
import type { ReportArgs, SalesReportData, SalesPeriod } from '../types';

/**
 * fetchSalesReport — revenue / order-count / average-order-value per period, grouped by day, week or
 * month over the selected range (spec §1.19 revenue-by-month + summary cards with trend).
 *
 * WHY one aggregation per bucket (getAggregateFromServer with { sum, count }), never fetch-and-sum:
 * each bucket's revenue AND order count come back as two numbers computed server-side — billed as a few
 * index scans, not one read per order (skill: mandatory aggregation). Buckets run concurrently.
 * WHY cancelled orders are excluded via `where status != Cancelled` (matching the dashboard revenue
 * definition): revenue must not count cancelled orders. This pairs a createdAt range with a status `!=`,
 * which needs a composite index (orders: status + createdAt) — see the wiring report.
 *
 * REVENUE IS NET OF GST. GST collected on a sale is tax held on the government's behalf, never the
 * business's income, so counting it as revenue overstates the business by the whole tax take. Both the
 * card and the chart use the net figure so they can never disagree; `totalGst` is reported alongside so
 * the deduction is visible rather than silent. The subtraction rides the SAME aggregation query as the
 * revenue sum — an extra `sum()` costs nothing next to a second round trip.
 */

const ordersRef = () => collection(db, FirestoreCollections.orders);

/** Gross revenue, GST collected and order count in [start, end) excluding cancelled orders. */
async function bucketAgg(
  start: Date,
  end: Date,
): Promise<{ gross: number; gst: number; orders: number }> {
  const snap = await getAggregateFromServer(
    query(
      ordersRef(),
      where('createdAt', '>=', Timestamp.fromDate(start)),
      where('createdAt', '<', Timestamp.fromDate(end)),
      where('status', '!=', OrderStatus.CANCELLED),
    ),
    { gross: sum('grandTotal'), gst: sum('gstAmount'), orders: count() },
  );
  const d = snap.data();
  return { gross: d.gross ?? 0, gst: d.gst ?? 0, orders: d.orders ?? 0 };
}

/**
 * Net revenue over an arbitrary window (used for the previous-period trend comparison). Net, not
 * gross — comparing a net current period against a gross previous one would invent a trend.
 */
async function windowRevenue(start: Date, end: Date): Promise<number> {
  const snap = await getAggregateFromServer(
    query(
      ordersRef(),
      where('createdAt', '>=', Timestamp.fromDate(start)),
      where('createdAt', '<', Timestamp.fromDate(end)),
      where('status', '!=', OrderStatus.CANCELLED),
    ),
    { gross: sum('grandTotal'), gst: sum('gstAmount') },
  );
  const d = snap.data();
  return (d.gross ?? 0) - (d.gst ?? 0);
}

/** Signed % change; if previous is 0, 100% up when current > 0 else 0 (mirrors the dashboard trend). */
function trend(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

/** Build [start,end) buckets across the inclusive [from,to] range for the chosen grouping. */
function buildBuckets(
  from: Date,
  to: Date,
  groupBy: ReportArgs['groupBy'],
): { start: Date; end: Date; label: string }[] {
  if (groupBy === 'month') {
    return eachMonthOfInterval({ start: from, end: to }).map((start) => ({
      start,
      end: addMonths(start, 1),
      label: format(start, 'MMM yy'),
    }));
  }
  if (groupBy === 'week') {
    return eachWeekOfInterval({ start: from, end: to }, { weekStartsOn: 1 }).map((start) => ({
      start,
      end: addWeeks(start, 1),
      label: format(start, 'd MMM'),
    }));
  }
  return eachDayOfInterval({ start: from, end: to }).map((start) => ({
    start,
    end: addDays(start, 1),
    label: format(start, 'd MMM'),
  }));
}

export const fetchSalesReport = createAsyncThunk<SalesReportData, ReportArgs, { rejectValue: string }>(
  'reports/fetchSales',
  async ({ from, to, groupBy }, { rejectWithValue }) => {
    try {
      const fromDate = new Date(from);
      const toDate = new Date(to);
      const buckets = buildBuckets(fromDate, toDate, groupBy);

      // Previous equal-length window immediately before [from, to], for the revenue trend card.
      const spanMs = to - from;
      const prevStart = new Date(from - spanMs);
      const prevEnd = fromDate;

      const [aggs, prevRevenue] = await Promise.all([
        Promise.all(buckets.map((b) => bucketAgg(b.start, b.end))),
        windowRevenue(prevStart, prevEnd),
      ]);

      const periods: SalesPeriod[] = buckets.map((b, i) => {
        const a = aggs[i] ?? { gross: 0, gst: 0, orders: 0 };
        const revenue = a.gross - a.gst;
        return {
          label: b.label,
          revenue,
          gstCollected: a.gst,
          orderCount: a.orders,
          // Net-of-GST too, so AOV and revenue are the same currency of measure.
          avgOrderValue: a.orders > 0 ? revenue / a.orders : 0,
        };
      });

      const totalRevenue = periods.reduce((s, p) => s + p.revenue, 0);
      const totalGst = periods.reduce((s, p) => s + p.gstCollected, 0);
      const totalOrders = periods.reduce((s, p) => s + p.orderCount, 0);

      return {
        periods,
        totalRevenue,
        totalGst,
        totalOrders,
        avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
        revenueTrend: trend(totalRevenue, prevRevenue),
      };
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Could not load sales report');
    }
  },
);
