import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import { Collections } from '../config/collections';
import { sendFCMToUser } from '../utils/sendFCM';

/**
 * trackReferralSignup — when a user doc carries a referral code in `referredBy`, resolve that code to
 * the referrer's uid, stamp `referredByUserId` on the referred user, and count the referral.
 *
 * WHY onDocumentWritten and NOT onDocumentCreated (this was the bug): the user document is created by
 *   `verifyOTP` the moment the OTP is accepted, and that write contains no `referredBy` at all — the
 *   field does not exist yet. The customer types their friend's code on the NEXT screen, which arrives
 *   as an UPDATE. An onCreate handler therefore ran exactly once, always before the code existed, read
 *   `referredBy` as undefined and returned. `referredByUserId` was never written for anybody, and
 *   processReferralCommission bails without it — so no referral commission was ever paid.
 *   Reacting to every write catches the code whenever it lands: at create, or on the profile update.
 *
 * WHY no infinite loop: this handler updates the same user doc, which re-fires it — but the second pass
 *   sees `referredByUserId` already set and returns before writing. The transaction below re-checks it
 *   inside the transaction, so two concurrent invocations cannot both count the same referral.
 *
 * WHY only LINK + COUNT here (no commission): commission is earned per delivered order, not per signup
 *   (spec §1.14) — processReferralCommission does that. This step records the relationship so later
 *   orders can be attributed.
 */
export const trackReferralSignup = onDocumentWritten('users/{userId}', async (event) => {
  const after = event.data?.after;
  if (!after?.exists) return; // deleted

  const user = after.data() as {
    referredBy?: string;
    referredByUserId?: string;
    fullName?: string;
  };

  const referredBy = (user.referredBy ?? '').trim();
  // Nothing to do if the account wasn't referred, or was already linked.
  if (!referredBy || user.referredByUserId) return;

  const db = getFirestore();
  const referrerSnap = await db
    .collection(Collections.users)
    .where('affiliateCode', '==', referredBy)
    .limit(1)
    .get();

  const referrerDoc = referrerSnap.docs[0];
  if (!referrerDoc) {
    logger.info('trackReferralSignup: no affiliate found for code', { referredBy });
    return;
  }

  const referrerId = referrerDoc.id;
  // Guard against a self-referral (a user can't refer themselves).
  if (referrerId === after.id) return;

  const referrerRef = db.collection(Collections.users).doc(referrerId);

  // The link and the count go together, atomically. `totalReferrals` is what the
  // affiliate dashboard's "Referrals" tile reads, and nothing incremented it
  // before — so that tile sat at 0 even for affiliates with real signups.
  const linked = await db.runTransaction(async (tx) => {
    const fresh = await tx.get(after.ref);
    // Re-check inside the transaction: a concurrent invocation may have linked
    // this user already, and `increment` is atomic but not idempotent.
    if (!fresh.exists || fresh.get('referredByUserId')) return false;

    tx.update(after.ref, {
      referredByUserId: referrerId,
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.update(referrerRef, {
      totalReferrals: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return true;
  });

  if (!linked) return;

  // Courtesy notification to the affiliate that a new signup used their code.
  await sendFCMToUser(
    referrerId,
    'New referral joined',
    `${user.fullName || 'A new customer'} signed up with your referral code.`,
    { type: 'Affiliate' },
  );
});
