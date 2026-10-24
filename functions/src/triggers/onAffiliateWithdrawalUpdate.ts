import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { Collections } from '../config/collections';
import keywordsBuilder from '../utils/keywordsBuilder';
import { sendFCMToUser } from '../utils/sendFCM';

/** Firestore's gRPC status for "document already exists" — what `create()` throws on a duplicate. */
const ALREADY_EXISTS = 6;

/**
 * onAffiliateWithdrawalUpdate — when an admin approves or rejects an affiliate withdrawal request, push
 * an FCM to the affiliate AND drop a doc into `notifications` so it shows in their in-app list
 * (spec §1.14, §1.18).
 *
 * WHY a Firestore trigger (not inside the admin thunk): the admin panel resolves the request with a
 *   client-side write, and a browser cannot read another user's FCM token. Same shape as
 *   onOrderStatusUpdate — react server-side to the document change itself.
 * WHY only Pending → Approved/Rejected: that is the one transition the affiliate cares about. Any other
 *   edit (or a status reset by hand in the console) announces nothing.
 * WHY a deterministic notification id + `create()`: the in-app record doubles as the "already
 *   notified" marker, so a re-delivered event finds the doc, skips, and never pushes twice.
 *
 * The money itself is transferred MANUALLY by the admin after approving (see the admin's
 * approveWithdrawal), so the approved copy says it "will be" sent, not that it has landed.
 */
export const onAffiliateWithdrawalUpdate = onDocumentUpdated(
  'affiliateWithdrawals/{withdrawalId}',
  async (event) => {
    const change = event.data;
    if (!change) return;

    const before = change.before.data();
    const after = change.after.data();
    if (!before || !after) return;

    const afterStatus = after.status as string | undefined;
    if (before.status !== 'Pending') return;
    if (afterStatus !== 'Approved' && afterStatus !== 'Rejected') return;

    const userId = after.userId as string | undefined;
    if (!userId) return;

    const withdrawalId = event.params.withdrawalId;
    const amount = Number(after.amount) || 0;
    const bankName = ((after.bankName as string | undefined) ?? '').trim();
    const last4 = String(after.accountNumber ?? '').slice(-4);
    const reason = ((after.rejectionReason as string | undefined) ?? '').trim();

    let title = '';
    let body = '';
    if (afterStatus === 'Approved') {
      const account = [bankName, 'account', last4 ? `ending ${last4}` : '']
        .filter(Boolean)
        .join(' ');
      title = 'Withdrawal approved';
      body = `Your withdrawal of ₹${amount} has been approved and will be transferred to your ${account}.`;
    } else {
      title = 'Withdrawal rejected';
      body = reason
        ? `Your withdrawal request of ₹${amount} was rejected. Reason: ${reason}. The amount is still in your affiliate balance.`
        : `Your withdrawal request of ₹${amount} was rejected. The amount is still in your affiliate balance.`;
    }

    try {
      const db = getFirestore();
      const ref = db
        .collection(Collections.notifications)
        .doc(`withdrawal_${withdrawalId}_${afterStatus.toLowerCase()}`);
      try {
        await ref.create({
          id: ref.id,
          title,
          body,
          image: '',
          type: 'Affiliate',
          targetType: 'Specific',
          targetUserIds: [userId],
          linkType: 'Affiliate',
          linkValue: withdrawalId,
          isScheduled: false,
          scheduledAt: null,
          isSent: true,
          sentAt: FieldValue.serverTimestamp(),
          sentBy: 'system',
          sentByName: 'System',
          recipientCount: 1,
          // Pre-stamped as delivered — the push below is sent from here. Without it
          // `onNotificationSend` would read this record of a push as a request for one and send a
          // duplicate. Keep in step with dispatchNotification's DISPATCH_FIELD.
          fcmDispatchedAt: FieldValue.serverTimestamp(),
          keywords: keywordsBuilder(title),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      } catch (err) {
        if ((err as { code?: number }).code === ALREADY_EXISTS) return; // already notified
        throw err;
      }

      // Best-effort push (sendFCMToUser swallows token errors internally).
      await sendFCMToUser(userId, title, body, {
        type: 'Affiliate',
        linkType: 'Affiliate',
        linkValue: withdrawalId,
        withdrawalId,
        amount: String(amount),
      });
    } catch (err) {
      logger.error('onAffiliateWithdrawalUpdate failed', { withdrawalId, afterStatus, err });
    }
  },
);
