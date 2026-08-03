import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { Collections } from '../config/collections';

const BATCH_LIMIT = 400; // stay under Firestore's 500-op batch cap.

/**
 * dailyCleanup — nightly housekeeping: expire coupons past their validUntil
 * (isActive && validUntil < now → isActive:false), batched. This also covers spin-reward "SPIN-"
 * coupons, which live in the same `coupons` collection with a validUntil.
 *
 * WHY a scheduler (not onCall): unattended maintenance that must run on a clock with no user in the
 *   loop, writing to documents only the Admin SDK may touch.
 * WHY nightly: a coupon lapsing a few hours late costs nothing — it simply stays redeemable until the
 *   sweep, and `validateCoupon` rejects it on its own date check at redemption time regardless.
 *
 * NOTE: this job used to ALSO cancel stale unpaid orders. That moved to
 *   `functions/src/orders/expireUnpaidOrders.ts`, which runs every 5 minutes — an unpaid order holds
 *   reserved stock, so reclaiming it once a night was far too slow, and the customer is now shown a
 *   10-minute countdown that a nightly job could not honour.
 *
 * SCHEMA NOTE: the spec also lists "expire spin rewards + spinner campaigns". Standalone spin rewards
 *   live in a `spinRewards` collection that is NOT in the shared Collections map, so they are out of
 *   scope here; SPIN- coupons stored in `coupons` are handled by this pass.
 */
export const dailyCleanup = onSchedule({ schedule: 'every day 02:00', timeZone: 'Asia/Kolkata' }, async () => {
  const db = getFirestore();
  const now = Timestamp.now();

  let couponsExpired = 0;

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

  logger.info('dailyCleanup run complete', { couponsExpired });
});
