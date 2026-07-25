import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import { Collections } from '../config/collections';

/**
 * clearAffiliateCommissions — daily job that releases affiliate commissions whose 7-day hold has
 * elapsed: flips each Pending transaction to Cleared and adds its amount to the referrer's balance.
 *
 * WHY onSchedule (not onCall/trigger): clearing is time-driven — a commission becomes withdrawable when
 *   its clearsAt passes, which no user action signals. A daily cron is the right driver.
 * WHY per-transaction runTransaction: balanceAfter must reflect the balance AT clearing time, so we read
 *   the referrer's current balance and write the new one atomically with the status flip — a plain
 *   read-modify-write would race across concurrent clears for the same affiliate.
 * WHY bounded query + loop: never fetch an unbounded set; process up to a page per run (a backlog drains
 *   over subsequent daily runs, and in practice a day's worth is tiny).
 */
export const clearAffiliateCommissions = onSchedule(
  { schedule: '0 0 * * *', timeZone: 'Asia/Kolkata' },
  async () => {
    const db = getFirestore();
    const now = Timestamp.now();

    const dueSnap = await db
      .collection(Collections.affiliateTransactions)
      .where('status', '==', 'Pending')
      .where('clearsAt', '<=', now)
      .limit(300)
      .get();

    let cleared = 0;
    for (const doc of dueSnap.docs) {
      const amount = (doc.get('amount') as number | undefined) ?? 0;
      const referrerId = doc.get('userId') as string | undefined;
      if (!referrerId || amount <= 0) continue;

      const userRef = db.collection(Collections.users).doc(referrerId);
      try {
        await db.runTransaction(async (tx) => {
          const [userDoc, txnDoc] = await Promise.all([tx.get(userRef), tx.get(doc.ref)]);
          // Re-read the status inside the transaction: the paged query above is a
          // snapshot, and a concurrent run must not clear the same commission
          // twice — `increment` is atomic but not idempotent.
          if (txnDoc.get('status') !== 'Pending') return;

          const currentBalance = (userDoc.get('affiliateBalance') as number | undefined) ?? 0;
          const newBalance = currentBalance + amount;

          tx.update(userRef, {
            affiliateBalance: FieldValue.increment(amount),
            // Move the money between the two dashboard tiles as the hold expires:
            // out of "Pending", into "Confirmed". Both fields are read straight
            // from users/{uid} by the affiliate dashboard.
            pendingCommission: FieldValue.increment(-amount),
            confirmedCommission: FieldValue.increment(amount),
            updatedAt: FieldValue.serverTimestamp(),
          });
          tx.update(doc.ref, {
            status: 'Cleared',
            balanceAfter: newBalance,
          });
        });
        cleared++;
      } catch (err) {
        logger.error('clearAffiliateCommissions failed for txn', { txnId: doc.id, err });
      }
    }

    logger.info(`Cleared ${cleared} affiliate commissions`);
  },
);
