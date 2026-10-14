import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { Collections } from '../config/collections';
import { getRazorpayInstance } from '../config/razorpay';
import { validateAdmin } from '../utils/validateAuth';
import { sendFCMToUser } from '../utils/sendFCM';
import { creditWallet } from './service/wallet';
import { toPaisa } from './service/computeTotals';

/**
 * processRefund — an admin issues the refund for an already-Cancelled order whose money has not yet been
 * returned (spec §5.2 #6). Refunds the Razorpay portion via the gateway and credits the wallet portion
 * back, then marks the payment Refunded and the order's paymentStatus Refunded.
 *
 * WHY separate from cancelOrder: cancellation and refund can be decoupled — an order may be cancelled
 *   while payment is still Pending/Failed, and the refund is settled later. This is the money-only step
 *   (stock was already restored at cancellation, so it is NOT touched here).
 * WHY onCall + validateAdmin: admin-only money movement behind the trust boundary.
 * WHY the guard (status === 'Cancelled' AND paymentStatus !== 'Refunded'): refunding a live order, or
 *   double-refunding, would move money twice.
 *
 * Request:  { orderId }   Response: { success: true, refundId }
 */
export const processRefund = onCall(async (request) => {
  validateAdmin(request);
  const db = getFirestore();

  const data = (request.data ?? {}) as { orderId?: unknown };
  if (typeof data.orderId !== 'string' || !data.orderId) {
    throw new HttpsError('invalid-argument', 'orderId is required.');
  }
  const orderId = data.orderId;

  try {
    const orderRef = db.collection(Collections.orders).doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) throw new HttpsError('not-found', 'Order not found.');
    const order = orderSnap.data() ?? {};
    if (order.status !== 'Cancelled') {
      throw new HttpsError('failed-precondition', 'Only a Cancelled order can be refunded.');
    }
    if (order.paymentStatus === 'Refunded') {
      throw new HttpsError('failed-precondition', 'This order has already been refunded.');
    }

    const userId = String(order.userId ?? '');
    const walletAmountUsed = Number(order.walletAmountUsed) || 0;
    // `cancelOrder` returns the wallet portion inside its own transaction even when the Razorpay refund
    // fails — it then flags the order `gatewayRefundPending`. Retrying such an order must refund ONLY the
    // gateway part; crediting the wallet again here would pay the wallet portion back twice.
    const walletAlreadyReturned = order.gatewayRefundPending === true;
    const walletToCredit = walletAlreadyReturned ? 0 : walletAmountUsed;

    const paymentQuery = await db
      .collection(Collections.payments)
      .where('orderId', '==', orderId)
      .limit(1)
      .get();
    const payDoc = paymentQuery.docs[0] ?? null;
    const payment = payDoc?.data() ?? {};
    const razorpayPaymentId = String(payment.razorpayPaymentId ?? '');
    const razorpayAmountPaid = Number(payment.razorpayAmountPaid) || 0;

    // Razorpay refund BEFORE the transaction (external call can't be transactional).
    let refundId = '';
    if (razorpayAmountPaid > 0 && razorpayPaymentId) {
      const instance = await getRazorpayInstance();
      try {
        const refund = await instance.payments.refund(razorpayPaymentId, {
          amount: toPaisa(razorpayAmountPaid),
        });
        refundId = String(refund.id ?? '');
      } catch (refundErr) {
        // Razorpay errors are `{ error: { description } }`, not Error objects. Surface the gateway's own
        // reason to the admin instead of a generic "Could not process the refund" — it is the only clue
        // to whether a retry later can work (e.g. a test bank that does not support refunds).
        const e = refundErr as { error?: { description?: unknown } };
        const reason = typeof e?.error?.description === 'string' ? e.error.description : 'gateway error';
        logger.error('processRefund: gateway refused the refund', { orderId, razorpayPaymentId, reason });
        throw new HttpsError('failed-precondition', `Razorpay refused the refund: ${reason}`);
      }
    }

    await db.runTransaction(async (tx) => {
      // reads first
      const userRef = userId ? db.collection(Collections.users).doc(userId) : null;
      let currentBalance = 0;
      if (userRef && walletToCredit > 0) {
        const userSnap = await tx.get(userRef);
        currentBalance = Number(userSnap.data()?.walletBalance) || 0;
      }

      // writes
      if (userRef && walletToCredit > 0) {
        creditWallet(tx, userRef, userId, currentBalance, walletToCredit, orderId, `Refund for order ${orderId}`);
      }
      if (payDoc) {
        tx.update(payDoc.ref, {
          status: 'Refunded',
          refundId,
          // The whole amount the customer has now got back, wallet portion included either way.
          refundAmount: razorpayAmountPaid + walletAmountUsed,
          refundedAt: FieldValue.serverTimestamp(),
          gatewayRefundPending: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      tx.update(orderRef, {
        paymentStatus: 'Refunded',
        gatewayRefundPending: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    if (userId) {
      await sendFCMToUser(
        userId,
        'Refund processed',
        `Your refund for order #${orderId} has been processed.`,
        { orderId },
      );
    }

    return { success: true, refundId };
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    logger.error('processRefund failed', err);
    throw new HttpsError('internal', 'Could not process the refund.');
  }
});
