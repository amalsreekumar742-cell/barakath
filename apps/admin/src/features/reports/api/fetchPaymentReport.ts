import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  collection,
  query,
  where,
  getCountFromServer,
  getAggregateFromServer,
  sum,
  count,
  Timestamp,
  type QueryConstraint,
} from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import { PaymentMethod, PaymentStatus } from '@barakath/shared/config/enums';
import { db } from '@/lib/firebaseConfig';
import type { PaymentReportData, PaymentMethodStat } from '../types';

/**
 * fetchPaymentReport — payment mix by method, refund total, failed count and GST collected over the
 * range (spec §1.19 payment analysis / §1.9 payment summary).
 *
 * WHY aggregation queries (getAggregateFromServer / getCountFromServer), never fetch-and-sum: every
 * figure is a server-side sum/count returning a single number (skill: mandatory aggregation). Each
 * method's paid revenue + count come from one aggregation. Combining method/status equality with the
 * createdAt range needs composite indexes (payments: method+status+createdAt, status+createdAt) — see
 * the wiring report.
 */
export const fetchPaymentReport = createAsyncThunk<
  PaymentReportData,
  { from: number; to: number },
  { rejectValue: string }
>('reports/fetchPayment', async ({ from, to }, { rejectWithValue }) => {
  try {
    const col = collection(db, FirestoreCollections.payments);
    const fromTs = Timestamp.fromDate(new Date(from));
    const toTs = Timestamp.fromDate(new Date(to));
    const inRange: QueryConstraint[] = [
      where('createdAt', '>=', fromTs),
      where('createdAt', '<=', toTs),
    ];

    // Paid revenue + count for one method.
    const methodAgg = (m: string) =>
      getAggregateFromServer(
        query(col, where('method', '==', m), where('status', '==', PaymentStatus.PAID), ...inRange),
        { amount: sum('amount'), c: count() },
      );

    const [razorpay, wallet, both, refunds, failed, gst] = await Promise.all([
      methodAgg(PaymentMethod.RAZORPAY),
      methodAgg(PaymentMethod.WALLET),
      methodAgg(PaymentMethod.BOTH),
      getAggregateFromServer(
        query(col, where('status', '==', PaymentStatus.REFUNDED), ...inRange),
        { total: sum('refundAmount') },
      ),
      getCountFromServer(query(col, where('status', '==', PaymentStatus.FAILED), ...inRange)),
      getAggregateFromServer(
        query(col, where('status', '==', PaymentStatus.PAID), ...inRange),
        { total: sum('gstAmount') },
      ),
    ]);

    const byMethod: PaymentMethodStat[] = [
      { method: PaymentMethod.RAZORPAY, count: razorpay.data().c ?? 0, amount: razorpay.data().amount ?? 0 },
      { method: PaymentMethod.WALLET, count: wallet.data().c ?? 0, amount: wallet.data().amount ?? 0 },
      { method: PaymentMethod.BOTH, count: both.data().c ?? 0, amount: both.data().amount ?? 0 },
    ];

    return {
      byMethod,
      totalRevenue: byMethod.reduce((s, m) => s + m.amount, 0),
      refundTotal: refunds.data().total ?? 0,
      failedCount: failed.data().count,
      gstCollected: gst.data().total ?? 0,
    };
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not load payment report');
  }
});
