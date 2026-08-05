import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import { dispatchNotification, DISPATCH_FIELD } from '../notifications/service/dispatchNotification';

/**
 * onNotificationSend — deliver the FCM fan-out when an admin sends a notification (spec §1.18).
 *
 * This is the missing half of the notification feature. `createNotification.ts` (send-now) and
 * `sendNotificationNow.ts` in the admin panel both write `isSent: true` and then stop, each with a
 * TODO saying the push must move server-side. They were right to stop: fanning out needs every
 * customer's `fcmToken`, and the Security Rules correctly forbid a client that cross-user read. So
 * the admin records intent, and this trigger — on the trust side of the boundary — delivers it.
 *
 * WHY `onDocumentWritten` rather than `onDocumentCreated` + `onDocumentUpdated`: the same transition
 * arrives two different ways. "Create and send now" writes a brand-new doc already carrying
 * `isSent: true`, while "send later, then press Send" flips an existing doc from false to true. One
 * handler watching for the transition covers both without duplicating the delivery logic.
 *
 * WHY it does not fire for the system's own notifications: functions like `onOrderStatusUpdate` push
 * to the customer directly AND drop a doc in this collection for the in-app list. Those docs are
 * created pre-stamped with `fcmDispatchedAt`, so the guard below treats them as already delivered
 * and the customer gets one push, not two.
 */
export const onNotificationSend = onDocumentWritten('notifications/{notificationId}', async (event) => {
  const change = event.data;
  if (!change) return;

  const after = change.after?.data();
  // Deletion, or a document that vanished mid-flight — nothing to deliver.
  if (!after) return;

  const before = change.before?.data();

  // Only a genuine "not sent" -> "sent" transition delivers. An unrelated field edit on an
  // already-sent notification (an admin fixing a typo in the title afterwards) must not re-broadcast.
  const wasSent = before?.isSent === true;
  const isSent = after.isSent === true;
  if (!isSent || wasSent) return;

  // Already delivered — either a system-authored doc pre-stamped at creation, or an Eventarc retry
  // of a delivery that already happened. `dispatchNotification` re-checks this atomically; this is
  // the cheap early exit that avoids a transaction on every retry.
  if (after[DISPATCH_FIELD]) return;

  const notificationId = event.params.notificationId;
  try {
    const outcome = await dispatchNotification(notificationId, after);
    logger.info('onNotificationSend', { notificationId, ...outcome });
  } catch (err) {
    // Swallowed deliberately: throwing asks Eventarc to retry, and a retry of a broadcast that
    // partially succeeded would re-notify everyone it already reached. The claim in
    // `dispatchNotification` makes that impossible anyway, so a throw could only add noise.
    logger.error('onNotificationSend failed', { notificationId, err });
  }
});
