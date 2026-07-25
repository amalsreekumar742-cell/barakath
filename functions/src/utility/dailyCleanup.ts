import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { Collections } from '../config/collections';

interface CleanupItem {
  productId: string;
  variantId: string;
  quantity: number;
}

const THIRTY_MIN_MS = 30 * 60 * 1000;
const BATCH_LIMIT = 400; // stay under Firestore's 500-op batch cap.

/**
 * dailyCleanup — nightly housekeeping: cancel stale unpaid orders and expire lapsed coupons.
 *
 * WHY a scheduler (not onCall): this is unattended maintenance that must run on a clock with no user in
 *   the loop, doing cross-user financial writes (stock restore, wallet credit, coupon usage) that only the
 *   Admin SDK may perform.
 * WHY onSchedule daily 02:00 IST: off-peak, once a day is enough for these expiries (spec §5.5 dailyCleanup).
 *
 * (1) Expire PENDING unpaid orders older than 30 min → Cancelled ('Payment timeout'): restore variant
 *     stock, credit back any wallet used (append a ledger entry), and decrement the coupon's usedCount.
 * (2) Expire coupons past validUntil (isActive && validUntil < now → isActive:false), batched. This pass
 *     also covers spin-reward "SPIN-" coupons that live in the coupons collection with a validUntil.
 *
 * SCHEMA NOTE: the spec also lists "expire spin rewards + spinner campaigns". Standalone spin rewards live
 *   in a `spinRewards` collection that is NOT in the shared Collections map, so they are out of scope here
 *   and flagged in the report; SPIN- coupons stored in `coupons` are handled by pass (2).
 */
export const dailyCleanup = onSchedule({ schedule: 'every day 02:00', timeZone: 'Asia/Kolkata' }, async () => {
  const db = getFirestore();
  const now = Timestamp.now();
  const cutoff = Timestamp.fromMillis(now.toMillis() - THIRTY_MIN_MS);

  let ordersCancelled = 0;
  let couponsExpired = 0;

  // ---- (1) Stale unpaid orders -------------------------------------------------------------------
  // Filter status+paymentStatus in the query; the createdAt<cutoff test is applied in memory to avoid a
  // composite index. Bounded by .limit for one nightly pass.
  const pendingSnap = await db
    .collection(Collections.orders)
    .where('status', '==', 'Pending')
    .where('paymentStatus', '==', 'Pending')
    .limit(300)
    .get();

  for (const orderDoc of pendingSnap.docs) {
    const order = orderDoc.data();
    const createdAt = order.createdAt as Timestamp | undefined;
    if (!createdAt || createdAt.toMillis() >= cutoff.toMillis()) continue; // not old enough yet.

    const items = (order.items as CleanupItem[] | undefined) ?? [];
    const couponCode = typeof order.couponCode === 'string' ? order.couponCode : '';
    const walletUsed = Number(order.walletAmountUsed) || 0;
    const userId = typeof order.userId === 'string' ? order.userId : '';

    // Resolve the coupon ref up front (a query can't run inside the transaction).
    let couponRef: FirebaseFirestore.DocumentReference | null = null;
    if (couponCode) {
      const couponSnap = await db
        .collection(Collections.coupons)
        .where('code', '==', couponCode)
        .limit(1)
        .get();
      couponRef = couponSnap.docs[0]?.ref ?? null;
    }

    try {
      await db.runTransaction(async (tx) => {
        // READS FIRST — only the user doc needs reading (for the wallet running balance).
        let newBalance = 0;
        let userRef: FirebaseFirestore.DocumentReference | null = null;
        if (walletUsed > 0 && userId) {
          userRef = db.collection(Collections.users).doc(userId);
          const userSnap = await tx.get(userRef);
          const current = Number(userSnap.data()?.walletBalance) || 0;
          newBalance = current + walletUsed;
        }

        // WRITES — restore stock (blind increments), refund wallet, revert coupon usage, cancel order.
        for (const it of items) {
          if (!it.productId || !it.variantId) continue;
          tx.update(
            db
              .collection(Collections.products)
              .doc(it.productId)
              .collection(Collections.variants)
              .doc(it.variantId),
            { stock: FieldValue.increment(Number(it.quantity) || 0) },
          );
        }

        if (userRef) {
          tx.update(userRef, {
            walletBalance: newBalance,
            updatedAt: FieldValue.serverTimestamp(),
          });
          tx.set(db.collection(Collections.walletTransactions).doc(), {
            userId,
            type: 'Credit',
            amount: walletUsed,
            source: 'Refund',
            description: `Refund for cancelled order ${orderDoc.id} (payment timeout)`,
            orderId: orderDoc.id,
            balanceAfter: newBalance,
            createdAt: FieldValue.serverTimestamp(),
          });
        }

        if (couponRef) {
          tx.update(couponRef, { usedCount: FieldValue.increment(-1) });
        }

        tx.update(orderDoc.ref, {
          status: 'Cancelled',
          cancelReason: 'Payment timeout',
          updatedAt: FieldValue.serverTimestamp(),
          statusTimeline: FieldValue.arrayUnion({
            status: 'Cancelled',
            timestamp: Timestamp.now(),
            note: 'Auto-cancelled: payment not completed within 30 minutes.',
          }),
        });
      });
      ordersCancelled += 1;
    } catch (err) {
      logger.error('dailyCleanup: failed to expire order', { orderId: orderDoc.id, err });
    }
  }

  // ---- (2) Expired coupons -----------------------------------------------------------------------
  const couponSnap = await db
    .collection(Collections.coupons)
    .where('isActive', '==', true)
    .where('validUntil', '<', now)
    .limit(BATCH_LIMIT)
    .get();

  if (!couponSnap.empty) {
    const batch = db.batch();
    for (const c of couponSnap.docs) {
      batch.update(c.ref, { isActive: false, updatedAt: FieldValue.serverTimestamp() });
      couponsExpired += 1;
    }
    await batch.commit();
  }

  logger.info('dailyCleanup run complete', { ordersCancelled, couponsExpired });
});
