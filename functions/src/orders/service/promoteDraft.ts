import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { Collections } from '../../config/collections';

/**
 * promoteDraftToOrder — turn a paid checkout draft into a real `orders` document.
 *
 * THE RULE THIS ENFORCES: nothing unpaid is ever an order. `createPaymentOrder` writes a Razorpay
 * checkout to `orderDrafts` (reserving stock, the coupon slot and any wallet amount, exactly as
 * before); only a confirmed payment moves it into `orders`. Abandoned checkouts therefore expire out
 * of `orderDrafts` and never appear in the admin Orders list, the Payments page, or any report.
 *
 * WHY the draft id becomes the order id: the Razorpay `receipt`, the coupon-usage record and the
 * wallet ledger entry all reference the id minted at checkout. Reusing it means promotion invalidates
 * nothing, the customer's order number never changes, and any link they already have keeps working.
 *
 * WHY idempotent, and how: BOTH `verifyPayment` (client-driven, fast) and the `payment.captured`
 * webhook (server-driven, authoritative) call this for the same payment, and either may arrive first
 * or twice. The transaction reads `orders/{id}` and returns immediately if it exists, so the second
 * caller is a no-op — the existence of the order document IS the idempotency key.
 *
 * WHY a cancelled draft still produces an order: if the expiry sweep (or an abandon) already released
 * the draft and the payment lands afterwards, the customer HAS paid and their money must be visible
 * to someone who can refund it. Silently dropping it would strand real money in Razorpay with no
 * record on our side. Such an order is created already `Cancelled`, so it can never be fulfilled, and
 * its timeline says plainly that a refund is owed.
 */

export type PromotionOutcome =
  | 'promoted'
  | 'already-promoted'
  | 'promoted-cancelled'
  | 'draft-missing';

export async function promoteDraftToOrder(
  orderId: string,
  razorpayPaymentId: string,
  razorpaySignature = '',
): Promise<PromotionOutcome> {
  const db = getFirestore();
  const orderRef = db.collection(Collections.orders).doc(orderId);
  const draftRef = db.collection(Collections.orderDrafts).doc(orderId);
  const paymentRef = db.collection(Collections.payments).doc();

  return db.runTransaction(async (tx): Promise<PromotionOutcome> => {
    const [orderSnap, draftSnap] = await Promise.all([tx.get(orderRef), tx.get(draftRef)]);

    // Already promoted by whichever of verifyPayment / the webhook got here first.
    if (orderSnap.exists) return 'already-promoted';

    if (!draftSnap.exists) {
      // No draft and no order. Either the id is wrong, or a very old draft was hard-deleted. There is
      // nothing to build an order from, so record it loudly rather than inventing one.
      logger.error('promoteDraftToOrder: no draft and no order for a captured payment', {
        orderId,
        razorpayPaymentId,
      });
      return 'draft-missing';
    }

    const draft = draftSnap.data() ?? {};
    // The sweep/abandon path marks a released draft 'Cancelled' rather than deleting it, precisely so
    // a late payment can still be traced back to what the customer was buying.
    const wasReleased = draft.status === 'Cancelled';
    const now = Timestamp.now();

    tx.set(orderRef, {
      ...draft,
      id: orderId,
      paymentStatus: 'Paid',
      razorpayPaymentId,
      status: wasReleased ? 'Cancelled' : 'Pending',
      statusTimeline: wasReleased
        ? [
            ...((draft.statusTimeline as unknown[] | undefined) ?? []),
            {
              status: 'Cancelled',
              timestamp: now,
              note: `Payment ${razorpayPaymentId} captured AFTER this checkout expired — refund the customer. Stock was already released.`,
            },
          ]
        : [{ status: 'Pending', timestamp: now, note: 'Order placed' }],
      createdAt: draft.createdAt ?? FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    tx.set(paymentRef, {
      id: paymentRef.id,
      orderId,
      userId: draft.userId ?? '',
      userName: draft.userName ?? '',
      userPhone: draft.userPhone ?? '',
      amount: draft.grandTotal ?? 0,
      method: draft.paymentMethod ?? 'Razorpay',
      razorpayOrderId: draft.razorpayOrderId ?? '',
      razorpayPaymentId,
      razorpaySignature,
      walletAmountUsed: draft.walletAmountUsed ?? 0,
      razorpayAmountPaid:
        Number(draft.grandTotal ?? 0) - Number(draft.walletAmountUsed ?? 0),
      status: 'Paid',
      refundId: '',
      refundAmount: 0,
      refundedAt: null,
      gstAmount: draft.gstAmount ?? 0,
      metadata: {},
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // The customer's lifetime counters, which the admin Customers list and the customer report read.
    //
    // Here rather than in `createPaymentOrder`: a Razorpay checkout is only a draft until this
    // point, so counting it earlier would credit an order for every abandoned checkout. This runs in
    // the same transaction as the order write and the `already-promoted` guard above returns before
    // it, so the double-delivery of verifyPayment + the webhook cannot double-count.
    //
    // NOT counted when `wasReleased`: that order is born Cancelled and owes the customer a refund —
    // it is money to give back, not a purchase to credit them with.
    // `set(..., { merge: true })`, NOT `update`: update throws when the document is missing, and a
    // throw here would abort the transaction and leave a CAPTURED PAYMENT with no order behind it.
    // A counter is never worth losing an order over. Merge creates-or-updates and still applies the
    // increments.
    const buyerId = String(draft.userId ?? '');
    if (!wasReleased && buyerId) {
      tx.set(
        db.collection(Collections.users).doc(buyerId),
        {
          totalOrders: FieldValue.increment(1),
          totalSpent: FieldValue.increment(Number(draft.grandTotal ?? 0)),
        },
        { merge: true },
      );
    }

    // The draft has served its purpose. Deleting it keeps `orderDrafts` to genuinely in-flight
    // checkouts, and the order document now carries everything.
    tx.delete(draftRef);

    return wasReleased ? 'promoted-cancelled' : 'promoted';
  });
}
