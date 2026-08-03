import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { Collections } from '../config/collections';
import { readProductStock, writeStockDelta, type StockLine } from './service/stock';
import { findCouponByCode, decrementCouponUsage } from './service/coupon';
import { creditWallet } from './service/wallet';
import { ORDER_PAYMENT_TIMEOUT_MS, ORDER_PAYMENT_TIMEOUT_MINUTES } from './service/orderTimeout';

interface ExpiryItem {
  productId: string;
  variantId: string;
  quantity: number;
}

/**
 * expireUnpaidOrders — release checkout DRAFTS whose payment window has passed, giving back
 * everything `createPaymentOrder` took up front: reserved stock, the coupon redemption, and any
 * wallet debit.
 *
 * WHY drafts and not orders: an unpaid checkout is never an `orders` document — it lives in
 *   `orderDrafts` and only becomes an order when payment succeeds (service/promoteDraft.ts). So this
 *   job never touches a real order, and an expired checkout leaves nothing behind in the admin panel.
 *
 * WHY it exists at all: checkout is reserve-then-pay. `createPaymentOrder` decrements stock, burns a
 *   coupon slot and debits the wallet in one transaction BEFORE the Razorpay sheet opens, so that two
 *   customers cannot both buy the last unit. The cost is that every abandoned checkout holds inventory
 *   nobody can buy. Razorpay only fires `payment.failed` for an attempt that actually failed — a
 *   customer who closes the sheet or the tab produces no webhook at all, so this sweep is the ONLY
 *   thing that reclaims those reservations.
 *
 * WHY the draft is marked Cancelled rather than deleted: if the customer's payment lands late, the
 *   webhook still needs to find what they were buying, so promoteDraftToOrder can create a Cancelled
 *   order flagged for refund instead of silently losing their money.
 *
 * WHY it was split out of `dailyCleanup`: it used to be pass (1) of that job, which runs once a night.
 *   A 30-minute rule evaluated at 02:00 IST meant an order abandoned at 02:05 held its stock for
 *   nearly 24 hours. The window is now 10 minutes and the customer is shown a countdown for exactly
 *   that, so the sweep has to run on a comparable cadence. Coupon expiry has no such urgency and stays
 *   nightly in `dailyCleanup`.
 *
 * WHY every 5 minutes (not every 10): the window is measured from `createdAt`, so an order always
 *   lives AT LEAST the full 10 minutes; the schedule only decides how long past that it lingers.
 *   Sweeping at half the window keeps the worst case near 15 minutes. Erring long is the safe
 *   direction — an order is never cancelled while the customer still believes they have time.
 *
 * WHY `writeStockDelta` rather than a blind increment: the previous implementation incremented each
 *   variant's `stock` directly and never touched the parent product, so `totalStock`/`stockStatus`
 *   drifted out of sync with the variant sum on every sweep and a product could stay displayed as "Out
 *   of stock" after its stock came back. `writeStockDelta` recomputes those denormalized fields, the
 *   same way cancelOrder and the payment-failed webhook already do.
 *
 * WHY per-order transactions: one bad order (deleted product, missing variant) must not abort the
 *   whole sweep, and each order's reversal has to be atomic in itself.
 */
export const expireUnpaidOrders = onSchedule(
  { schedule: 'every 5 minutes', timeZone: 'Asia/Kolkata' },
  async () => {
    const db = getFirestore();
    const cutoff = Timestamp.fromMillis(Date.now() - ORDER_PAYMENT_TIMEOUT_MS);

    // Both filters are equality, so Firestore serves this from single-field indexes; the createdAt
    // comparison is applied in memory to avoid needing a composite. Bounded per run.
    const snap = await db
      .collection(Collections.orderDrafts)
      .where('status', '==', 'Pending')
      .where('paymentStatus', '==', 'Pending')
      .limit(300)
      .get();

    let cancelled = 0;

    for (const orderDoc of snap.docs) {
      const order = orderDoc.data();
      const createdAt = order.createdAt as Timestamp | undefined;
      if (!createdAt || createdAt.toMillis() > cutoff.toMillis()) continue; // still inside the window

      const items = (order.items as ExpiryItem[] | undefined) ?? [];
      const stockLines: StockLine[] = items
        .filter((it) => it.productId && it.variantId)
        .map((it) => ({
          productId: it.productId,
          variantId: it.variantId,
          quantity: Number(it.quantity) || 0,
        }));
      const productIds = Array.from(new Set(stockLines.map((l) => l.productId)));
      const couponCode = typeof order.couponCode === 'string' ? order.couponCode : '';
      const walletUsed = Number(order.walletAmountUsed) || 0;
      const userId = typeof order.userId === 'string' ? order.userId : '';

      // A query cannot run inside a transaction — resolve the coupon ref first.
      const coupon = couponCode ? await findCouponByCode(couponCode) : null;

      try {
        await db.runTransaction(async (tx) => {
          // READS FIRST (Firestore requires all reads before any write in a transaction).
          const fresh = await tx.get(orderDoc.ref);
          // Re-read inside the transaction: the paged query above is a snapshot, and the customer may
          // have paid in the seconds since. Cancelling a paid order would be catastrophic.
          if (fresh.get('status') !== 'Pending' || fresh.get('paymentStatus') !== 'Pending') return;

          const stockMap = stockLines.length ? await readProductStock(tx, productIds) : null;
          let currentBalance = 0;
          const userRef = userId ? db.collection(Collections.users).doc(userId) : null;
          if (userRef && walletUsed > 0) {
            const userSnap = await tx.get(userRef);
            currentBalance = Number(userSnap.data()?.walletBalance) || 0;
          }

          // WRITES
          if (stockMap) writeStockDelta(tx, stockMap, stockLines, 'restore');
          if (coupon) decrementCouponUsage(tx, coupon.ref);
          if (userRef && walletUsed > 0) {
            creditWallet(
              tx,
              userRef,
              userId,
              currentBalance,
              walletUsed,
              orderDoc.id,
              `Refund for cancelled order ${orderDoc.id} (payment timeout)`,
            );
          }

          tx.update(orderDoc.ref, {
            status: 'Cancelled',
            cancelReason: 'Payment timeout',
            // paymentStatus stays 'Pending' on purpose: no payment was ever attempted, so neither
            // 'Failed' (which means the gateway declined) nor 'Refunded' would be true.
            updatedAt: FieldValue.serverTimestamp(),
            statusTimeline: FieldValue.arrayUnion({
              status: 'Cancelled',
              // A Timestamp, not serverTimestamp — FieldValue sentinels are illegal inside an array.
              timestamp: Timestamp.now(),
              note: `Auto-cancelled: payment not completed within ${ORDER_PAYMENT_TIMEOUT_MINUTES} minutes.`,
            }),
          });
        });
        cancelled += 1;
      } catch (err) {
        logger.error('expireUnpaidOrders: failed to expire order', { orderId: orderDoc.id, err });
      }
    }

    if (cancelled > 0) logger.info('expireUnpaidOrders complete', { cancelled });
  },
);
