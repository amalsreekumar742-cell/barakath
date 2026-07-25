import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { Collections } from '../config/collections';
import { getRazorpayInstance } from '../config/razorpay';
import { validateAuth } from '../utils/validateAuth';
import { sendFCMToUser } from '../utils/sendFCM';
import { readProductStock, writeStockDelta, type StockLine } from './service/stock';
import { findCouponByCode, decrementCouponUsage } from './service/coupon';
import { creditWallet } from './service/wallet';
import { toPaisa } from './service/computeTotals';

/**
 * cancelOrder — cancels a still-Pending order (spec §1.7, §2.18). Atomically restores stock, reverses
 * any coupon redemption, credits any wallet amount back, and (if the order was paid via Razorpay) issues
 * a gateway refund; then marks the order Cancelled and notifies the customer.
 *
 * WHO MAY CALL: an admin (`admin:true` claim), OR the customer who placed the order — spec §2.18 gives
 *   the customer a "Cancel order" action while it is still Pending. This used to be `validateAdmin`
 *   only, which meant the app's own Cancel button could never succeed: every customer got
 *   permission-denied. Ownership is checked AFTER loading the order, against `order.userId` and the uid
 *   from the verified token — never a uid from the request body.
 * WHY not simply open it up: a customer must be able to cancel THEIR OWN order and nothing else. The
 *   check below is an equality test on the order document, so there is no path to another user's order.
 * WHY server-side: it moves money (Razorpay refund + wallet credit) and mutates cross-user inventory —
 *   all of which the Admin SDK must do behind the trust boundary.
 * WHY only status === 'Pending': once an order is Accepted/Packed/Shipped it is in fulfilment; undoing
 *   stock/refunds then would corrupt operations. The refund runs BEFORE the Firestore transaction because
 *   an external API call cannot live inside a transaction (which may retry).
 *
 * Request:  { orderId, cancelReason }   Response: { success: true }
 */
export const cancelOrder = onCall(async (request) => {
  const callerUid = validateAuth(request);
  const isAdmin = request.auth?.token.admin === true;
  const db = getFirestore();

  const data = (request.data ?? {}) as { orderId?: unknown; cancelReason?: unknown };
  if (typeof data.orderId !== 'string' || !data.orderId) {
    throw new HttpsError('invalid-argument', 'orderId is required.');
  }
  const orderId = data.orderId;

  try {
    const orderRef = db.collection(Collections.orders).doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) throw new HttpsError('not-found', 'Order not found.');
    const order = orderSnap.data() ?? {};

    // Ownership gate. A non-admin may cancel only their own order; the uid comes
    // from the verified token. Deliberately the SAME message and code as a
    // missing order would give, so this cannot be used to probe which order ids
    // exist.
    const ownsOrder = String(order.userId ?? '') === callerUid;
    if (!isAdmin && !ownsOrder) {
      throw new HttpsError('not-found', 'Order not found.');
    }

    // The reason is customer-supplied text only when an admin sends it; a
    // customer cancelling their own order gets a fixed label, so the timeline
    // cannot be used to write arbitrary text into an admin-facing screen.
    const cancelReason = isAdmin
      ? (typeof data.cancelReason === 'string' && data.cancelReason.trim()
          ? data.cancelReason.trim()
          : 'Cancelled by admin')
      : 'Cancelled by customer';

    if (order.status !== 'Pending') {
      throw new HttpsError('failed-precondition', 'Only a Pending order can be cancelled.');
    }

    const wasPaid = order.paymentStatus === 'Paid';
    // A failed payment was already reversed by the webhook (stock restored, coupon/wallet returned);
    // cancelling it must NOT reverse a second time — only flip the order to Cancelled.
    const needsReversal = order.paymentStatus !== 'Failed';
    const userId = String(order.userId ?? '');
    const couponCode = String(order.couponCode ?? '');
    const walletAmountUsed = Number(order.walletAmountUsed) || 0;
    const items = Array.isArray(order.items) ? order.items : [];
    const stockLines: StockLine[] = items.map((raw: unknown) => {
      const it = (raw ?? {}) as { productId?: unknown; variantId?: unknown; quantity?: unknown };
      return {
        productId: String(it.productId ?? ''),
        variantId: String(it.variantId ?? ''),
        quantity: Number(it.quantity) || 0,
      };
    });
    const productIds = Array.from(new Set(stockLines.map((l) => l.productId).filter(Boolean)));

    // Locate the payment doc (needed for the Razorpay refund + to mark it Refunded).
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
    if (wasPaid && razorpayPaymentId && razorpayAmountPaid > 0) {
      const instance = await getRazorpayInstance();
      const refund = await instance.payments.refund(razorpayPaymentId, {
        amount: toPaisa(razorpayAmountPaid),
      });
      refundId = String(refund.id ?? '');
    }

    // Locate the coupon (by code) once, outside the transaction.
    const coupon = couponCode ? await findCouponByCode(couponCode) : null;

    await db.runTransaction(async (tx) => {
      // reads first
      const stockMap = needsReversal ? await readProductStock(tx, productIds) : null;
      let currentBalance = 0;
      const userRef = userId ? db.collection(Collections.users).doc(userId) : null;
      if (needsReversal && userRef && walletAmountUsed > 0) {
        const userSnap = await tx.get(userRef);
        currentBalance = Number(userSnap.data()?.walletBalance) || 0;
      }

      // writes
      if (needsReversal && stockMap) {
        writeStockDelta(tx, stockMap, stockLines, 'restore');
        if (coupon) decrementCouponUsage(tx, coupon.ref);
        if (userRef && walletAmountUsed > 0) {
          creditWallet(tx, userRef, userId, currentBalance, walletAmountUsed, orderId, `Refund for cancelled order ${orderId}`);
        }
      }

      const now = Timestamp.now();
      tx.update(orderRef, {
        status: 'Cancelled',
        cancelReason,
        paymentStatus: wasPaid ? 'Refunded' : order.paymentStatus,
        statusTimeline: FieldValue.arrayUnion({
          status: 'Cancelled',
          timestamp: now,
          note: cancelReason,
        }),
        updatedAt: FieldValue.serverTimestamp(),
      });

      if (payDoc && (wasPaid || (needsReversal && walletAmountUsed > 0))) {
        tx.update(payDoc.ref, {
          status: 'Refunded',
          refundId,
          refundAmount: razorpayAmountPaid + walletAmountUsed,
          refundedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    });

    // Best-effort push (must never fail the cancellation).
    if (userId) {
      await sendFCMToUser(
        userId,
        'Order cancelled',
        `Your order #${orderId} has been cancelled.`,
        { orderId },
      );
    }

    return { success: true };
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    logger.error('cancelOrder failed', err);
    throw new HttpsError('internal', 'Could not cancel the order.');
  }
});
