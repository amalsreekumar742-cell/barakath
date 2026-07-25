import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  collection,
  query,
  where,
  getCountFromServer,
  getAggregateFromServer,
  sum,
  Timestamp,
} from 'firebase/firestore';
import { startOfMonth } from 'date-fns';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import { PaymentMethod, PaymentStatus } from '@barakath/shared/config/enums';
import { db } from '@/lib/firebaseConfig';
import type { PaymentStats } from '../types';

/**
 * fetchPaymentStats — the Payments header-line figures (design: a single subtitle, "₹X this month ·
 * N failed" — not a stat-card grid, see PaymentsPage.tsx). Also retains the per-method counts and
 * all-time revenue/refund totals for callers that still need them (e.g. a future reports view).
 *
 * WHY aggregation queries (getAggregateFromServer/getCountFromServer): sums and counts are computed
 * server-side and only the single figure is transmitted — never fetch-and-total client-side (skill:
 * mandatory aggregation). Revenue sums `amount` over Paid payments; refunds sum `refundAmount` over
 * Refunded ones. `monthRevenue` is the same `sum('amount')` query bounded to `createdAt >= startOfMonth`,
 * matching the design's period figure without a second, differently-shaped query pattern.
 */
export const fetchPaymentStats = createAsyncThunk<PaymentStats, void, { rejectValue: string }>(
  'payments/fetchStats',
  async (_, { rejectWithValue }) => {
    try {
      const col = collection(db, FirestoreCollections.payments);
      const byMethod = (m: string) => getCountFromServer(query(col, where('method', '==', m)));
      const monthStart = Timestamp.fromDate(startOfMonth(new Date()));

      const [revenue, monthRevenue, refunds, razorpay, wallet, both, failed] = await Promise.all([
        getAggregateFromServer(query(col, where('status', '==', PaymentStatus.PAID)), {
          total: sum('amount'),
        }),
        getAggregateFromServer(
          query(
            col,
            where('status', '==', PaymentStatus.PAID),
            where('createdAt', '>=', monthStart),
          ),
          { total: sum('amount') },
        ),
        getAggregateFromServer(query(col, where('status', '==', PaymentStatus.REFUNDED)), {
          total: sum('refundAmount'),
        }),
        byMethod(PaymentMethod.RAZORPAY),
        byMethod(PaymentMethod.WALLET),
        byMethod(PaymentMethod.BOTH),
        getCountFromServer(query(col, where('status', '==', PaymentStatus.FAILED))),
      ]);

      return {
        totalRevenue: revenue.data().total ?? 0,
        monthRevenue: monthRevenue.data().total ?? 0,
        totalRefunds: refunds.data().total ?? 0,
        razorpayCount: razorpay.data().count,
        walletCount: wallet.data().count,
        bothCount: both.data().count,
        // Design's "N failed" reads as a period figure, but nothing pins it to the calendar month
        // specifically — reusing the existing all-time count avoids a second Failed+date-bounded query
        // for a number the mockup never defines precisely. Revisit if the store wants it month-scoped too.
        failedCount: failed.data().count,
      };
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Could not load payment stats');
    }
  },
);
