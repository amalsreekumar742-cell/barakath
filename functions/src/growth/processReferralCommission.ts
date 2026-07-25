import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import { Collections } from '../config/collections';

/** Subset of OrderItemProps we need to price the commission. */
interface OrderItem {
  /** REQUIRED to find the variant: variants are a SUBCOLLECTION of the product. */
  productId: string;
  variantId: string;
  quantity: number;
}

/**
 * processReferralCommission — when an order transitions INTO 'Delivered', credit the buyer's referrer a
 * PENDING affiliate commission (sum of each variant's fixed ₹ commission × quantity).
 *
 * WHY a Firestore onUpdate trigger: delivery is recorded by flipping order.status, so reacting to that
 *   write is the natural, single-source hook — no client involvement in a money calculation.
 * WHY server-side: commission is money the client must never compute or credit; the per-variant rate
 *   lives on the variant doc (admin-controlled) and is read here with the Admin SDK.
 * WHY 'Pending' + clearsAt (no balance bump yet): commissions hold for a 7-day clearing window
 *   (spec §1.14) and are released by clearAffiliateCommissions — affiliateBalance is NOT incremented
 *   here, only recorded in balanceAfter for the ledger.
 * WHY idempotent (query for an existing Referral txn on this order): the trigger can fire more than once
 *   for the same logical update, and a second run must not double-pay.
 *
 * Trigger: orders/{orderId} onUpdate. No-op unless status goes non-Delivered → Delivered.
 */
export const processReferralCommission = onDocumentUpdated('orders/{orderId}', async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after) return;

  // Only on the first transition into Delivered.
  if (after.status !== 'Delivered' || before.status === 'Delivered') return;

  const orderId = event.params.orderId;
  const buyerId = after.userId as string | undefined;
  if (!buyerId) return;

  const db = getFirestore();

  const buyerSnap = await db.collection(Collections.users).doc(buyerId).get();
  const buyer = buyerSnap.data() as
    | { referredByUserId?: string; fullName?: string }
    | undefined;
  const referrerId = buyer?.referredByUserId;
  if (!referrerId) return; // buyer wasn't referred — nothing to pay.

  // Sum commission across line items: variant.commission (fixed ₹ per variant) × quantity.
  //
  // The variant is read from `products/{productId}/variants/{variantId}`. This
  // used to read a TOP-LEVEL `variants` collection, which does not exist in this
  // database — variants have always been a subcollection of their product. Every
  // lookup therefore returned a non-existent document, `commission` was
  // undefined, `total` stayed 0 and the function returned below without ever
  // writing a commission. That is why no affiliate was ever paid, even where the
  // variant carried a perfectly good commission value.
  const items = (after.items as OrderItem[] | undefined) ?? [];
  let total = 0;
  for (const item of items) {
    if (!item.variantId || !item.productId) continue;
    const variantSnap = await db
      .collection(Collections.products)
      .doc(item.productId)
      .collection(Collections.variants)
      .doc(item.variantId)
      .get();
    const commission = variantSnap.get('commission') as number | undefined;
    if (typeof commission === 'number' && commission > 0) {
      total += commission * (item.quantity ?? 0);
    }
  }
  if (total <= 0) return;

  // Idempotency by CONSTRUCTION: one deterministic document per order, created
  // inside the transaction that also bumps the referrer's pending total. The
  // previous query-then-add left a window in which two concurrent deliveries of
  // the same event could both find nothing and both pay out.
  const txnRef = db
    .collection(Collections.affiliateTransactions)
    .doc(`${orderId}_referral`);
  const referrerRef = db.collection(Collections.users).doc(referrerId);
  const clearsAt = Timestamp.fromMillis(Date.now() + 7 * 86_400_000);

  const created = await db.runTransaction(async (tx) => {
    const [existing, referrerDoc] = await Promise.all([tx.get(txnRef), tx.get(referrerRef)]);
    if (existing.exists) return false;

    const currentBalance = (referrerDoc.get('affiliateBalance') as number | undefined) ?? 0;

    tx.set(txnRef, {
      userId: referrerId,
      type: 'Credit',
      amount: total,
      source: 'Referral',
      description: `Referral commission for order #${orderId}`,
      referredUserId: buyerId,
      referredUserName: buyer?.fullName ?? '',
      orderId,
      balanceAfter: currentBalance + total, // record only; balance clears via scheduler
      status: 'Pending',
      clearsAt,
      createdAt: FieldValue.serverTimestamp(),
    });

    // `pendingCommission` is what the affiliate dashboard's "Pending" tile reads.
    // Nothing maintained it before, so the tile showed ₹0 even with commissions
    // sitting in the ledger. clearAffiliateCommissions moves it to
    // `confirmedCommission` when the hold expires.
    tx.update(referrerRef, {
      pendingCommission: FieldValue.increment(total),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return true;
  });

  if (!created) {
    logger.info('processReferralCommission: already processed', { orderId });
    return;
  }

  logger.info('processReferralCommission: pending commission created', {
    orderId,
    referrerId,
    amount: total,
  });
});
