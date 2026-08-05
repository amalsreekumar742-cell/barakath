import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { Collections } from '../../config/collections';
import {
  collectTokensForAllUsers,
  collectTokensForUsers,
  sendFCMToTokens,
  type UserToken,
} from '../../utils/sendFCM';

/**
 * The shared fan-out for an admin-authored notification document.
 *
 * WHY this is driven off the DOCUMENT rather than called from the admin panel: fanning out needs
 * every customer's FCM token, which is exactly the cross-user read the Security Rules forbid a
 * client — the admin app cannot do it, which is why `createNotification.ts` / `sendNotificationNow.ts`
 * could only ever record intent and leave a TODO. The notification doc IS the intent, so the server
 * reacts to it and owns delivery.
 *
 * Called from two places: the `onNotificationSend` trigger (admin pressed Send) and the
 * `dispatchScheduledNotifications` scheduler (a scheduled send came due).
 */

/** Marks a document as claimed for delivery. Also the field the trigger reads to skip re-sends. */
export const DISPATCH_FIELD = 'fcmDispatchedAt';

export interface DispatchOutcome {
  status: 'sent' | 'skipped-already-dispatched' | 'skipped-not-sendable' | 'no-recipients';
  sent?: number;
  failed?: number;
  reached?: number;
}

/**
 * Claim the document for delivery, atomically and exactly once.
 *
 * WHY claim BEFORE sending rather than stamping after: Firestore triggers are at-least-once — the
 * same write can invoke this more than once, and a crash mid-send would otherwise re-broadcast to
 * everyone already reached. For a push notification, delivering twice is far worse than delivering
 * zero times (it is spam to the entire customer base, and unrecallable), so this deliberately
 * chooses at-most-once. If the send crashes after the claim, the admin can still re-send from the
 * panel, which is a decision a human makes rather than a retry loop makes for them.
 */
async function claim(notificationId: string): Promise<boolean> {
  const db = getFirestore();
  const ref = db.collection(Collections.notifications).doc(notificationId);
  try {
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return false;
      if (snap.get(DISPATCH_FIELD)) return false; // already claimed by an earlier invocation
      tx.update(ref, { [DISPATCH_FIELD]: FieldValue.serverTimestamp() });
      return true;
    });
  } catch (err) {
    logger.error('dispatchNotification: claim failed', { notificationId, err });
    return false;
  }
}

/** Resolve who this notification is for. 'All' means every non-blocked customer with a token. */
async function resolveAudience(data: FirebaseFirestore.DocumentData): Promise<UserToken[]> {
  if (data.targetType === 'Specific') {
    const ids = Array.isArray(data.targetUserIds) ? (data.targetUserIds as string[]) : [];
    return collectTokensForUsers(ids.filter((id) => typeof id === 'string' && id));
  }
  return collectTokensForAllUsers();
}

/**
 * Deliver one notification document.
 *
 * `data` is the document's current contents. The caller has already established that it should go
 * out (isSent flipped true, or a schedule came due) — this function re-checks the invariants anyway,
 * because the scheduler and the trigger arrive by different routes and neither should be trusted to
 * have looked.
 */
export async function dispatchNotification(
  notificationId: string,
  data: FirebaseFirestore.DocumentData,
): Promise<DispatchOutcome> {
  if (data[DISPATCH_FIELD]) return { status: 'skipped-already-dispatched' };
  if (data.isSent !== true) return { status: 'skipped-not-sendable' };

  if (!(await claim(notificationId))) return { status: 'skipped-already-dispatched' };

  const db = getFirestore();
  const ref = db.collection(Collections.notifications).doc(notificationId);

  const title = typeof data.title === 'string' ? data.title : '';
  const body = typeof data.body === 'string' ? data.body : '';
  const image = typeof data.image === 'string' && data.image ? data.image : undefined;

  // Deep-link payload the clients route on. All values must be strings — FCM rejects a data map
  // containing anything else, and a rejected message is indistinguishable from a dead token.
  const payload: Record<string, string> = {
    notificationId,
    type: typeof data.type === 'string' ? data.type : 'Broadcast',
    linkType: typeof data.linkType === 'string' ? data.linkType : 'None',
    linkValue: typeof data.linkValue === 'string' ? data.linkValue : '',
  };

  const targets = await resolveAudience(data);
  if (targets.length === 0) {
    await ref
      .update({
        fcmSentCount: 0,
        fcmFailedCount: 0,
        // recipientCount is what the admin list shows. The client wrote an optimistic estimate
        // (a raw user count); overwrite it with the number actually reachable so the panel never
        // claims it reached customers who have no device registered.
        recipientCount: 0,
        updatedAt: FieldValue.serverTimestamp(),
      })
      .catch((err) => logger.warn('dispatchNotification: result write failed', err));
    return { status: 'no-recipients' };
  }

  const result = await sendFCMToTokens(targets, title, body, payload, image);

  await ref
    .update({
      fcmSentCount: result.sent,
      fcmFailedCount: result.failed,
      recipientCount: result.reached,
      updatedAt: FieldValue.serverTimestamp(),
    })
    .catch((err) => logger.warn('dispatchNotification: result write failed', err));

  logger.info('dispatchNotification: delivered', {
    notificationId,
    targetType: data.targetType,
    tokens: targets.length,
    ...result,
  });

  return { status: 'sent', sent: result.sent, failed: result.failed, reached: result.reached };
}

/**
 * Flip a due scheduled notification into the sent state, then deliver it.
 * Mirrors the field changes `sendNotificationNow.ts` makes in the admin panel, so a scheduled send
 * and a manual send leave the document in exactly the same shape.
 */
export async function markSentAndDispatch(
  notificationId: string,
  data: FirebaseFirestore.DocumentData,
): Promise<DispatchOutcome> {
  const db = getFirestore();
  const ref = db.collection(Collections.notifications).doc(notificationId);
  await ref.update({
    isSent: true,
    sentAt: FieldValue.serverTimestamp(),
    isScheduled: false,
    scheduledAt: null,
    updatedAt: FieldValue.serverTimestamp(),
  });
  return dispatchNotification(notificationId, { ...data, isSent: true });
}

/** Exposed for the scheduler's query — a notification is due when its time has passed. */
export function isDue(scheduledAt: unknown, now: Timestamp): boolean {
  return scheduledAt instanceof Timestamp && scheduledAt.toMillis() <= now.toMillis();
}
