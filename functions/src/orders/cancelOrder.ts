import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { Collections } from '../config/collections';
import { getRazorpayInstance } from '../config/razorpay';
import { validateAuth } from '../utils/validateAuth';
import { readProductStock, writeStockDelta, type StockLine } from './service/stock';
import { findCouponByCode, decrementCouponUsage } from './service/coupon';
import { creditWallet } from './service/wallet';
import { toPaisa } from './service/computeTotals';

/**
 * cancelOrder — cancels a still-Pending order (spec §1.7, §2.18). Atomically restores stock, reverses
 * any coupon redemption, credits any wallet amount back, and (if the order was paid via Razorpay) issues
 * a gateway refund; then marks the order Cancelled. The customer is notified by `onOrderStatusUpdate`
 * (push + in-app notification) reacting to the Cancelled transition — NOT from here: this function used
 * to push as well, so every cancellation reached the customer twice.
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
 * WHY the cancel CLAIM: because the refund has to run outside the transaction, the Pending check used
 *   to sit outside it too — so two concurrent calls (a double-tap, or the customer and an admin at the
 *   same moment) both passed it, and BOTH restored stock, credited the wallet and gave back the coupon
 *   slot. A short claim transaction now stamps `cancelClaimedAt` on the order before any money moves;
 *   a second caller that finds a live claim is refused. The claim expires after CANCEL_CLAIM_TTL_MS so
 *   a crashed attempt can never wedge an order un-cancellable, and it is cleared on completion or on
 *   any failure after it was taken.
 *
 * Request:  { orderId, cancelReason }   Response: { success: true }
 */

/** How long a cancel claim blocks a second attempt. Comfortably longer than a Razorpay refund call. */
const CANCEL_CLAIM_TTL_MS = 2 * 60 * 1000;

/**
 * Razorpay SDK errors arrive as `{ statusCode, error: { code, description } }`, not as Error objects,
 * so a plain `String(err)` yields "[object Object]". Pull out the description a human can act on.
 */
function describeRazorpayError(err: unknown): string {
  const e = err as { error?: { description?: unknown; code?: unknown }; message?: unknown };
  const description = e?.error?.description;
  if (typeof description === 'string' && description) return description;
  const code = e?.error?.code;
  if (typeof code === 'string' && code) return code;
  if (typeof e?.message === 'string' && e.message) return e.message;
  return 'gateway error';
}

export const cancelOrder = onCall(async (request) => {
  const callerUid = validateAuth(request);
  const isAdmin = request.auth?.token.admin === true;
  const db = getFirestore();

  const data = (request.data ?? {}) as { orderId?: unknown; cancelReason?: unknown };
  if (typeof data.orderId !== 'string' || !data.orderId) {
    throw new HttpsError('invalid-argument', 'orderId is required.');
  }
  const orderId = data.orderId;
  const orderRef = db.collection(Collections.orders).doc(orderId);

  // Claim bookkeeping, read by the catch block: a claim this call took must be released if anything
  // after it fails, and a claim some OTHER call holds must never be touched.
  let claimed = false;
  let completed = false;
  let refundId = '';

  try {
    // ---- 1. CLAIM the cancellation (before any money moves) ---------------------------------------
    // Everything the rest of the function decides is taken from THIS snapshot, read inside the
    // transaction that took the claim — not from an unguarded read that a concurrent call could share.
    const order = await db.runTransaction(async (tx) => {
      const snap = await tx.get(orderRef);
      if (!snap.exists) throw new HttpsError('not-found', 'Order not found.');
      const o = snap.data() ?? {};

      // Ownership gate. A non-admin may cancel only their own order; the uid comes
      // from the verified token. Deliberately the SAME message and code as a
      // missing order would give, so this cannot be used to probe which order ids
      // exist.
      const ownsOrder = String(o.userId ?? '') === callerUid;
      if (!isAdmin && !ownsOrder) {
        throw new HttpsError('not-found', 'Order not found.');
      }

      if (o.status !== 'Pending') {
        throw new HttpsError('failed-precondition', 'Only a Pending order can be cancelled.');
      }

      const claimedAt = o.cancelClaimedAt as Timestamp | undefined;
      if (
        claimedAt &&
        typeof claimedAt.toMillis === 'function' &&
        Date.now() - claimedAt.toMillis() < CANCEL_CLAIM_TTL_MS
      ) {
        throw new HttpsError(
          'failed-precondition',
          'This order is already being cancelled. Please wait a moment and refresh.',
        );
      }

      // No status change, so onOrderStatusUpdate treats this write as a no-op.
      tx.update(orderRef, { cancelClaimedAt: Timestamp.now() });
      return o;
    });
    claimed = true;

    // The reason is customer-supplied text only when an admin sends it; a
    // customer cancelling their own order gets a fixed label, so the timeline
    // cannot be used to write arbitrary text into an admin-facing screen.
    const cancelReason = isAdmin
      ? (typeof data.cancelReason === 'string' && data.cancelReason.trim()
          ? data.cancelReason.trim()
          : 'Cancelled by admin')
      : 'Cancelled by customer';

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

    // ---- 2. Razorpay refund BEFORE the transaction (external call can't be transactional) ---------
    //
    // A GATEWAY FAILURE MUST NOT ABORT THE CANCELLATION. This used to throw straight out of the
    // function, so any Razorpay error — a declined refund, a timeout, an insufficient balance on the
    // account — meant the customer simply could not cancel at all: the order stayed live, its stock
    // stayed reserved, and they got "Could not cancel the order." with nothing they could do about it.
    // The cancellation itself is entirely ours to perform; only the money movement depends on
    // Razorpay. So we cancel regardless and record the refund as OUTSTANDING, leaving `paymentStatus`
    // as 'Paid' (never 'Refunded' — that would be a lie) so an admin can retry it via processRefund.
    let gatewayRefundFailed = false;
    let gatewayRefundError = '';
    if (wasPaid && razorpayPaymentId && razorpayAmountPaid > 0) {
      try {
        const instance = await getRazorpayInstance();
        const refund = await instance.payments.refund(razorpayPaymentId, {
          amount: toPaisa(razorpayAmountPaid),
        });
        refundId = String(refund.id ?? '');
      } catch (refundErr) {
        gatewayRefundFailed = true;
        gatewayRefundError = describeRazorpayError(refundErr);
        logger.error('cancelOrder: gateway refund failed — cancelling anyway, refund outstanding', {
          orderId,
          razorpayPaymentId,
          amount: razorpayAmountPaid,
          error: gatewayRefundError,
        });
      }
    }

    // Locate the coupon (by code) once, outside the transaction.
    const coupon = couponCode ? await findCouponByCode(couponCode) : null;

    // ---- 3. Atomic reversal + status flip --------------------------------------------------------
    await db.runTransaction(async (tx) => {
      // READS FIRST. Re-read the order: the claim shuts out a second cancelOrder, but the order can
      // still have been moved on (e.g. Accepted from the admin status screen) since it was taken.
      const fresh = await tx.get(orderRef);
      if (fresh.get('status') !== 'Pending') {
        throw new HttpsError('failed-precondition', 'Only a Pending order can be cancelled.');
      }
      // skipMissing: a product deleted since the order was placed must not block handing back the
      // wallet amount and coupon slot — and the gateway refund above has already been issued.
      const stockMap = needsReversal
        ? await readProductStock(tx, productIds, { skipMissing: true })
        : null;
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
        // Only claim 'Refunded' when the money actually went back. If the gateway refused, the order
        // is cancelled but still Paid — which is exactly what an admin needs to see to act on it.
        paymentStatus: wasPaid && !gatewayRefundFailed ? 'Refunded' : order.paymentStatus,
        ...(gatewayRefundFailed ? { gatewayRefundPending: true } : {}),
        statusTimeline: FieldValue.arrayUnion({
          status: 'Cancelled',
          timestamp: now,
          note: gatewayRefundFailed
            ? `${cancelReason} — REFUND OUTSTANDING: the ₹${razorpayAmountPaid} gateway refund failed (${gatewayRefundError}). Retry it from Payments.`
            : cancelReason,
        }),
        // The claim has done its job; a Cancelled order can never be claimed again anyway.
        cancelClaimedAt: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      if (payDoc && (wasPaid || (needsReversal && walletAmountUsed > 0))) {
        // The wallet portion (if any) genuinely was credited back inside this transaction; the
        // gateway portion may not have been. Record only what moved.
        const refundedNow = (gatewayRefundFailed ? 0 : razorpayAmountPaid) + walletAmountUsed;
        tx.update(payDoc.ref, {
          status: gatewayRefundFailed ? 'Paid' : 'Refunded',
          refundId,
          refundAmount: refundedNow,
          refundedAt: gatewayRefundFailed ? null : FieldValue.serverTimestamp(),
          ...(gatewayRefundFailed ? { gatewayRefundPending: true } : {}),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    });
    completed = true;

    return { success: true };
  } catch (err) {
    if (claimed && !completed) {
      if (refundId) {
        // Money left through Razorpay but the order was NOT cancelled. Nothing here can undo a
        // gateway refund, so say so loudly — someone has to reconcile this order by hand.
        logger.error('cancelOrder: gateway refund ISSUED but the cancellation did not commit', {
          orderId,
          refundId,
          err,
        });
      }
      // Release our claim so the order can be cancelled again straight away rather than after the
      // TTL. Best-effort: if this fails too, the claim simply expires on its own.
      try {
        await orderRef.update({ cancelClaimedAt: FieldValue.delete() });
      } catch (clearErr) {
        logger.warn('cancelOrder: could not release the cancel claim (it will expire)', {
          orderId,
          clearErr,
        });
      }
    }
    if (err instanceof HttpsError) throw err;
    logger.error('cancelOrder failed', err);
    throw new HttpsError('internal', 'Could not cancel the order.');
  }
});
