import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { Collections } from '../config/collections';
import keywordsBuilder from '../utils/keywordsBuilder';
import { sendFCMToUser } from '../utils/sendFCM';

/**
 * onOrderStatusUpdate — when an order's `status` changes, push an FCM to the customer AND drop a doc
 * into the `notifications` collection so it shows in their in-app notification list (spec §1.7, §1.18).
 *
 * WHY a Firestore trigger (not client/onCall): the status is flipped by an admin (or another Cloud
 *   Function). The customer whose device must be notified is nowhere near that write, so the reaction
 *   has to be server-driven off the document change itself — the single source of truth for "it moved".
 * WHY idempotency is safe here: it only proceeds when before.status !== after.status. A retry of the
 *   same change re-sends at most one push; a write that didn't touch status is a no-op.
 * WHY guard event.data: an update event can arrive without before/after snapshots — bail rather than
 *   dereference undefined.
 */
export const onOrderStatusUpdate = onDocumentUpdated('orders/{orderId}', async (event) => {
  const change = event.data;
  if (!change) return;

  const before = change.before.data();
  const after = change.after.data();
  if (!before || !after) return;

  const beforeStatus = before.status as string | undefined;
  const afterStatus = after.status as string | undefined;
  // Only a genuine status transition should notify — everything else is an unrelated field edit.
  if (!afterStatus || beforeStatus === afterStatus) return;

  const userId = after.userId as string | undefined;
  if (!userId) return;

  const orderId = event.params.orderId;
  const trackingId = (after.trackingId as string | undefined) ?? '';
  const cancelReason = (after.cancelReason as string | undefined) ?? '';

  // Build the copy per new status. Statuses not in this map (e.g. Pending, the initial state) do NOT
  // notify — there is nothing customer-meaningful to announce for them.
  let title = '';
  let body = '';
  switch (afterStatus) {
    case 'Accepted':
      title = 'Order accepted';
      body = `Your order #${orderId} has been accepted`;
      break;
    case 'Packed':
      title = 'Order packed';
      body = `Your order #${orderId} has been packed and ready for shipping`;
      break;
    case 'Shipped':
      title = 'Order shipped';
      body = `Your order #${orderId} has been shipped. Tracking ID: ${trackingId}`;
      break;
    case 'Out for delivery':
      title = 'Out for delivery';
      body = `Your order #${orderId} is out for delivery`;
      break;
    case 'Delivered':
      title = 'Order delivered';
      body = `Your order #${orderId} has been delivered`;
      break;
    case 'Cancelled':
      title = 'Order cancelled';
      body = `Your order #${orderId} has been cancelled. Reason: ${cancelReason}`;
      break;
    default:
      // Pending / unknown — nothing to announce.
      return;
  }

  try {
    // Best-effort push (sendFCMToUser swallows token errors internally).
    await sendFCMToUser(userId, title, body, {
      type: 'Order',
      linkType: 'Order',
      linkValue: orderId,
    });

    // Persist an in-app notification so the customer sees history even if the push was missed.
    const db = getFirestore();
    const ref = db.collection(Collections.notifications).doc();
    await ref.set({
      id: ref.id,
      title,
      body,
      image: '',
      type: 'Order',
      targetType: 'Specific',
      targetUserIds: [userId],
      linkType: 'Order',
      linkValue: orderId,
      isScheduled: false,
      scheduledAt: null,
      isSent: true,
      sentAt: FieldValue.serverTimestamp(),
      sentBy: 'system',
      sentByName: 'System',
      recipientCount: 1,
      // Pre-stamped as delivered because the push above ALREADY went out. Without this the
      // `onNotificationSend` trigger would see a new doc with isSent:true, treat it as an admin
      // broadcast awaiting delivery, and send the customer a second identical push. This doc is a
      // RECORD of a push, not a request for one. Keep in step with dispatchNotification's
      // DISPATCH_FIELD.
      fcmDispatchedAt: FieldValue.serverTimestamp(),
      keywords: keywordsBuilder(title),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    logger.error('onOrderStatusUpdate failed', { orderId, afterStatus, err });
  }
});
