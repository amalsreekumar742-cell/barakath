import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import { Collections } from '../config/collections';
import { validateAdmin } from '../utils/validateAuth';
import { sendFCMToUser } from '../utils/sendFCM';
import { creditWallet } from '../orders/service/wallet';
import keywordsBuilder from '../utils/keywordsBuilder';
import {
  computeReplacementRefund,
  ReplacementLineNotFoundError,
  type RefundOrder,
} from './service/replacementRefund';

/**
 * approveReplacement — an admin approves a pending return request; we refund the returned line's value
 * to the customer's WALLET and resolve the request.
 *
 * WHY a wallet refund (not a free order): approval used to mint a zero-value "replacement order", which
 *   paid the customer nothing, polluted the order list and sales reports with ₹0 rows, and was the sole
 *   reason firestore.rules had to let an admin client create `orders` documents. The remedy is now money
 *   back in the wallet, so none of that is needed (user decision, 2026-08-03; overrides spec §1.10's
 *   "replacement order auto-created").
 * WHY onCall + validateAdmin: only an admin may resolve a request, and the callable protocol gives us
 *   the verified admin claim for free. The admin panel previously did this work client-side in a
 *   writeBatch; crediting a wallet from a browser is not something rules can safely permit, so the whole
 *   operation moved here.
 * WHY a transaction: the balance is read and written inside it, so concurrent credits/debits for the
 *   same customer serialise instead of clobbering each other.
 * WHY the deterministic ledger id: `walletTransactions/replacement_{id}` exists at most once, so a
 *   retried call — or someone flipping the request back to 'Pending' in the console — cannot double-pay.
 *   Same construction as processReferralCommission's `${orderId}_referral`.
 *
 * Request:  { replacementId: string, adminNote?: string }
 * Response: { success: true, refundAmount: number, newBalance: number, walletTransactionId: string }
 */
export const approveReplacement = onCall(
  async (
    request,
  ): Promise<{
    success: true;
    refundAmount: number;
    newBalance: number;
    walletTransactionId: string;
  }> => {
    const adminUid = validateAdmin(request);

    const { replacementId, adminNote } = (request.data ?? {}) as {
      replacementId?: unknown;
      adminNote?: unknown;
    };
    if (typeof replacementId !== 'string' || replacementId.trim() === '') {
      throw new HttpsError('invalid-argument', 'replacementId is required');
    }
    const note = typeof adminNote === 'string' ? adminNote : '';

    const db = getFirestore();
    const replacementRef = db.collection(Collections.replacements).doc(replacementId);
    const replacementSnap = await replacementRef.get();
    if (!replacementSnap.exists) {
      throw new HttpsError('not-found', 'Return request not found');
    }
    const replacement = replacementSnap.data() as {
      orderId?: string;
      userId?: string;
      productId?: string;
      variantId?: string;
      quantity?: number;
      status?: string;
    };

    if (replacement.status !== 'Pending') {
      throw new HttpsError('failed-precondition', 'Only pending requests can be approved');
    }

    const originalOrderId = replacement.orderId ?? '';
    const orderRef = originalOrderId
      ? db.collection(Collections.orders).doc(originalOrderId)
      : null;
    const orderSnap = orderRef ? await orderRef.get() : null;
    if (!orderRef || !orderSnap || !orderSnap.exists) {
      throw new HttpsError('not-found', 'Original order not found');
    }
    const originalOrder = orderSnap.data() as RefundOrder & {
      userId?: string;
      status?: string;
      paymentStatus?: string;
      grandTotal?: number;
      replacementRefundedTotal?: number;
    };

    // Nothing to give back if the customer never paid, or if the order was already refunded in full by
    // cancelOrder/processRefund. Both would otherwise refund money that no longer exists on the order.
    if (originalOrder.paymentStatus !== 'Paid') {
      throw new HttpsError(
        'failed-precondition',
        'This order was not paid, so there is nothing to refund',
      );
    }
    if (originalOrder.status === 'Cancelled') {
      throw new HttpsError(
        'failed-precondition',
        'This order was cancelled and already refunded',
      );
    }

    const customerId = originalOrder.userId ?? replacement.userId ?? '';
    if (!customerId) {
      throw new HttpsError('failed-precondition', 'The order has no customer to refund');
    }

    let breakdown;
    try {
      breakdown = computeReplacementRefund(originalOrder, {
        productId: replacement.productId ?? '',
        variantId: replacement.variantId ?? '',
        quantity: replacement.quantity ?? 0,
      });
    } catch (err) {
      if (err instanceof ReplacementLineNotFoundError) {
        throw new HttpsError('not-found', err.message);
      }
      throw err;
    }

    // Cap against what is left on the order, so several partial returns can never jointly refund more
    // than was paid. The stored running total is read again inside the transaction below.
    const grandTotal = originalOrder.grandTotal ?? 0;
    const alreadyRefunded = originalOrder.replacementRefundedTotal ?? 0;
    const refundAmount = Math.min(breakdown.refundAmount, Math.max(0, grandTotal - alreadyRefunded));
    if (refundAmount <= 0) {
      throw new HttpsError('failed-precondition', 'Nothing left to refund on this order');
    }

    const userRef = db.collection(Collections.users).doc(customerId);
    const ledgerRef = db
      .collection(Collections.walletTransactions)
      .doc(`replacement_${replacementId}`);

    const newBalance = await db.runTransaction(async (tx) => {
      const [freshReplacement, freshLedger, userDoc, freshOrder] = await Promise.all([
        tx.get(replacementRef),
        tx.get(ledgerRef),
        tx.get(userRef),
        tx.get(orderRef),
      ]);

      // Re-read the status INSIDE the transaction: the read at the top of this function is a snapshot,
      // and two admins clicking Approve at the same moment must not both pass.
      if (freshReplacement.get('status') !== 'Pending') {
        throw new HttpsError('failed-precondition', 'This request has already been processed');
      }
      // The real idempotency guard. Survives the status being reset to 'Pending' by hand, which the
      // check above cannot: the ledger row is the record that money actually moved.
      if (freshLedger.exists) {
        throw new HttpsError('failed-precondition', 'This request has already been refunded');
      }
      if (!userDoc.exists) {
        throw new HttpsError('not-found', 'Customer not found');
      }

      const currentBalance = (userDoc.get('walletBalance') as number | undefined) ?? 0;
      const balanceAfter = creditWallet(
        tx,
        userRef,
        customerId,
        currentBalance,
        refundAmount,
        originalOrderId,
        `Refund for returned item in order #${originalOrderId}`,
        ledgerRef,
      );

      tx.update(replacementRef, {
        status: 'Approved',
        adminNote: note,
        refundAmount,
        refundedToWallet: true,
        walletTransactionId: ledgerRef.id,
        // Always '' now — no replacement order is created. Non-empty values survive only on requests
        // approved before this change, which the admin detail page still renders.
        replacementOrderId: '',
        processedBy: adminUid,
        processedByName: (request.auth?.token.name as string | undefined) ?? '',
        processedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      // `increment` is atomic but NOT idempotent — the two guards above are what stop it running twice.
      // The timeline note reuses the order's CURRENT status so onOrderStatusUpdate stays a no-op and
      // the customer doesn't get a spurious "your order status changed" push.
      tx.update(orderRef, {
        replacementRefundedTotal: FieldValue.increment(refundAmount),
        statusTimeline: FieldValue.arrayUnion({
          status: freshOrder.get('status') ?? originalOrder.status ?? '',
          // A Timestamp (not serverTimestamp) — FieldValue sentinels are illegal inside an array.
          timestamp: Timestamp.now(),
          note: `₹${refundAmount} refunded to wallet for a returned item`,
        }),
        updatedAt: FieldValue.serverTimestamp(),
      });

      return balanceAfter;
    });

    // Best-effort notification; never let a delivery failure undo the refund (already committed).
    const title = 'Return approved — refund credited';
    const body = `₹${refundAmount} has been credited to your Barakath wallet for order #${originalOrderId}.`;
    try {
      await sendFCMToUser(customerId, title, body, {
        type: 'Replacement',
        linkType: 'Order',
        linkValue: originalOrderId,
        replacementId,
        amount: String(refundAmount),
      });

      // Persist an in-app notification so the customer sees history even if the push was missed. With
      // no replacement order created, this is their only in-app record of the refund besides the
      // wallet ledger row.
      const notificationRef = db.collection(Collections.notifications).doc();
      await notificationRef.set({
        id: notificationRef.id,
        title,
        body,
        image: '',
        type: 'Replacement',
        targetType: 'Specific',
        targetUserIds: [customerId],
        linkType: 'Order',
        linkValue: originalOrderId,
        isScheduled: false,
        scheduledAt: null,
        isSent: true,
        sentAt: FieldValue.serverTimestamp(),
        sentBy: 'system',
        sentByName: 'System',
        recipientCount: 1,
        // Pre-stamped as delivered — `sendFCMToUser` above already pushed this. See the identical
        // note in `triggers/onOrderStatusUpdate.ts`: without it, `onNotificationSend` would read
        // this record of a push as a request for one and send a duplicate.
        fcmDispatchedAt: FieldValue.serverTimestamp(),
        keywords: keywordsBuilder(title),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } catch (err) {
      logger.error('approveReplacement: notification failed after refund', {
        replacementId,
        refundAmount,
        err,
      });
    }

    return { success: true, refundAmount, newBalance, walletTransactionId: ledgerRef.id };
  },
);
