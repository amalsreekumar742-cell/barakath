import { createAsyncThunk } from '@reduxjs/toolkit';
import { doc, getDoc, runTransaction, serverTimestamp, Timestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import { OrderStatus } from '@barakath/shared/config/enums';
import type { OrderProps } from '@barakath/shared/types';
import { db, functions } from '@/lib/firebaseConfig';
import { nextStatus, canCancel, isOrderPaid, unpaidAdvanceReason } from '../utils/orderFlow';
import { callableErrorMessage } from '../utils/callableError';

export interface UpdateOrderStatusInput {
  orderId: string;
  newStatus: string;
  note?: string;
  trackingId?: string;
  courierName?: string;
  cancelReason?: string;
}

/**
 * Mirrors CANCEL_CLAIM_TTL_MS in functions/src/orders/cancelOrder.ts. A claim younger than this means a
 * cancellation — and its gateway refund — is in flight; an older one is from a crashed attempt.
 */
const CANCEL_CLAIM_TTL_MS = 2 * 60 * 1000;

export interface UpdateOrderStatusResult {
  order: OrderProps;
  previousStatus: string;
}

/**
 * updateOrderStatus — advance an order along its flow, or cancel it (spec §1.7).
 *
 * WHY the transition is validated here (server-trust boundary, skill): the UI only ever offers the
 * single next step, but the thunk still re-checks that `newStatus` is exactly `nextStatus(current)` —
 * or, for a cancel, that the order is still Pending — so no out-of-order write can slip through.
 * Cancel requires a reason (Shipped's tracking + courier requirement is switched off for now).
 *
 * WHY a cancel goes through the `cancelOrder` callable instead of a client batch: cancelling moves
 * money and cross-user inventory. The callable (functions/src/orders/cancelOrder.ts) does the whole
 * reversal in one server transaction — Razorpay refund, wallet credit, coupon release, stock restore,
 * the payment doc and the timeline. The client batch this replaced only flipped `paymentStatus` to
 * Refunded (no money actually moved; the payment doc stayed Paid) and restored stock by reading each
 * variant and writing an absolute value, which raced any concurrent checkout. The client must never
 * restore stock as well: the callable already did, and a second restore would double it.
 *
 * WHY an unpaid order cannot be advanced: an unpaid checkout lives in `orderDrafts` and only becomes an
 * order once paid (functions/src/orders/service/promoteDraft.ts), so a non-Paid order here is a legacy
 * document from before that split, or a Failed/Refunded one. Advancing it would ship goods nobody paid
 * for. Cancelling stays allowed at any payment status — the callable skips the reversal for a Failed
 * payment, which the payment-failed webhook already reversed.
 *
 * WHY a client `Timestamp.now()` in the timeline (not serverTimestamp): Firestore forbids the
 * serverTimestamp sentinel inside an array element, so each timeline entry stamps the client time.
 *
 * WHY an advance is a transaction that honours `cancelClaimedAt`: cancelOrder claims a Pending order,
 * issues the Razorpay refund, and only then flips it to Cancelled — re-checking Pending first. An
 * advance landing in that window made the cancel abort AFTER the refund, leaving an Accepted order
 * whose payment had been returned. Reading the claim in the same transaction as the write makes the
 * two exclusive: either the advance commits first (the claim then finds Accepted and refuses) or the
 * claim does (the advance is refused here).
 */
export const updateOrderStatus = createAsyncThunk<
  UpdateOrderStatusResult,
  UpdateOrderStatusInput,
  { rejectValue: string }
>('orders/updateStatus', async (input, { rejectWithValue }) => {
  const isCancel = input.newStatus === OrderStatus.CANCELLED;
  try {
    const orderRef = doc(db, FirestoreCollections.orders, input.orderId);
    const snap = await getDoc(orderRef);
    if (!snap.exists()) return rejectWithValue('Order not found');
    const order = { ...snap.data(), id: snap.id } as OrderProps;
    const current = order.status;

    if (isCancel) {
      if (!canCancel(current)) return rejectWithValue('Order can only be cancelled while Pending');
      const cancelReason = input.cancelReason?.trim();
      if (!cancelReason) return rejectWithValue('Cancel reason is required');

      // The server re-checks Pending inside its own read, so a status change between our read and
      // this call is refused there rather than double-cancelled.
      const call = httpsCallable<{ orderId: string; cancelReason: string }, { success: boolean }>(
        functions,
        'cancelOrder',
      );
      await call({ orderId: input.orderId, cancelReason });

      // Re-read so the slice gets the server-written status, payment status and timeline.
      const cancelled = await getDoc(orderRef);
      return { order: { ...cancelled.data(), id: cancelled.id } as OrderProps, previousStatus: current };
    }

    // --- Advance: validate the transition on the transaction's own read, then write ---
    // Shipment details are switched off for now (the shipment form is commented out), so Ship no
    // longer requires them. Re-enable together with ShipmentModal.
    // if (input.newStatus === OrderStatus.SHIPPED && (!input.trackingId?.trim() || !input.courierName?.trim()))
    //   return rejectWithValue('Tracking ID and courier name are required to ship');
    let previousStatus = current;
    await runTransaction(db, async (tx) => {
      const fresh = await tx.get(orderRef);
      if (!fresh.exists()) throw new Error('Order not found');
      const live = fresh.data() as OrderProps & { cancelClaimedAt?: Timestamp };
      previousStatus = live.status;

      if (!isOrderPaid(live.paymentStatus)) throw new Error(unpaidAdvanceReason(live.paymentStatus));
      if (input.newStatus !== nextStatus(live.status))
        throw new Error(`Cannot move from "${live.status}" to "${input.newStatus}"`);
      const claimedAt = live.cancelClaimedAt;
      if (claimedAt && Date.now() - claimedAt.toMillis() < CANCEL_CLAIM_TTL_MS)
        throw new Error('This order is being cancelled. Refresh in a moment.');

      const timelineEntry = {
        status: input.newStatus,
        timestamp: Timestamp.now(),
        note: input.note ?? '',
      };
      const orderUpdate: Record<string, unknown> = {
        status: input.newStatus,
        statusTimeline: [...(live.statusTimeline ?? []), timelineEntry],
        updatedAt: serverTimestamp(),
      };
      if (input.newStatus === OrderStatus.SHIPPED) {
        // Only when supplied — a plain Ship leaves the checkout's empty defaults in place.
        if (input.trackingId?.trim()) orderUpdate.trackingId = input.trackingId.trim();
        if (input.courierName?.trim()) orderUpdate.courierName = input.courierName.trim();
      }
      tx.update(orderRef, orderUpdate);
    });

    const updated = await getDoc(orderRef);
    return { order: { ...updated.data(), id: updated.id } as OrderProps, previousStatus };
  } catch (err) {
    return rejectWithValue(
      isCancel
        ? callableErrorMessage(err, 'Could not cancel the order')
        : err instanceof Error
          ? err.message
          : 'Could not update order status',
    );
  }
});
