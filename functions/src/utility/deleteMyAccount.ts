import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { Collections } from '../config/collections';
import { validateAuth } from '../utils/validateAuth';

/** Order states with nothing left to fulfil. Anything else still needs the customer's details. */
const FINISHED_ORDER_STATUSES = new Set(['Delivered', 'Cancelled']);

const DELETED_CUSTOMER_NAME = 'Deleted customer';

/**
 * deleteMyAccount — permanently delete the signed-in customer's account (App Store guideline 5.1.1(v)).
 *
 * Removes: the Auth user, `users/{uid}` with every subcollection (addresses, wishlist, payout accounts,
 *   blocked users), profile photos, their reviews (onReviewDelete refreshes ratings and purges photos),
 *   and their own review reports. Signing in again with the same number creates a new, empty account.
 * Keeps, with personal details removed: orders, payments, wallet and affiliate ledgers, and withdrawals —
 *   financial records the business must retain. City/state/pincode stay on the order for tax purposes.
 *
 * WHY a Cloud Function: a client cannot rewrite its own orders, and Security Rules deliberately forbid
 *   deleting `users/{uid}` from a client.
 * WHY refuse while something is open: an undelivered order still needs the address, and cancelling it or
 *   approving a return would credit a wallet that no longer exists. The customer can retry once it closes.
 * WHY the Auth user goes last: if anything earlier fails the caller is still signed in and can retry, and
 *   every step is idempotent.
 *
 * Request:  {}
 * Response: { deleted: true }
 */
export const deleteMyAccount = onCall({ timeoutSeconds: 300 }, async (request) => {
  const uid = validateAuth(request);
  const db = getFirestore();

  const byUser = (collection: string) =>
    db.collection(collection).where('userId', '==', uid).get();

  const [orders, replacements, withdrawals, payments, reviews, commissions, reports] =
    await Promise.all([
      byUser(Collections.orders),
      byUser(Collections.replacements),
      byUser(Collections.affiliateWithdrawals),
      byUser(Collections.payments),
      byUser(Collections.reviews),
      byUser(Collections.affiliateTransactions),
      db.collection(Collections.reviewReports).where('reporterId', '==', uid).get(),
    ]);

  if (orders.docs.some((d) => !FINISHED_ORDER_STATUSES.has(String(d.get('status'))))) {
    throw new HttpsError(
      'failed-precondition',
      'You have an order in progress. You can delete your account once it is delivered or cancelled.',
    );
  }
  const isPending = (d: QueryDocumentSnapshot) => d.get('status') === 'Pending';
  if (replacements.docs.some(isPending)) {
    throw new HttpsError(
      'failed-precondition',
      'You have a return request in progress. You can delete your account once it is resolved.',
    );
  }
  if (withdrawals.docs.some(isPending)) {
    throw new HttpsError(
      'failed-precondition',
      'You have a withdrawal in progress. You can delete your account once it is resolved.',
    );
  }

  try {
    const writer = db.bulkWriter();

    for (const order of orders.docs) {
      writer.update(order.ref, {
        userName: DELETED_CUSTOMER_NAME,
        userPhone: '',
        keywords: [order.id.toLowerCase()],
        'shippingAddress.fullName': DELETED_CUSTOMER_NAME,
        'shippingAddress.phone': '',
        'shippingAddress.addressLine1': '',
        'shippingAddress.addressLine2': '',
        'shippingAddress.landmark': '',
      });
    }
    for (const doc of [...payments.docs, ...replacements.docs]) {
      writer.update(doc.ref, { userName: DELETED_CUSTOMER_NAME, userPhone: '' });
    }
    for (const withdrawal of withdrawals.docs) {
      const accountNumber = String(withdrawal.get('accountNumber') ?? '');
      writer.update(withdrawal.ref, {
        userName: DELETED_CUSTOMER_NAME,
        userPhone: '',
        accountHolderName: '',
        ifscCode: '',
        // Last 4 only: enough to reconcile the payout, useless to anyone else.
        accountNumber: accountNumber.slice(-4),
      });
    }
    // A pending commission can never clear into a deleted account, and would fail daily otherwise.
    for (const commission of commissions.docs.filter(isPending)) {
      writer.update(commission.ref, { status: 'Forfeited' });
    }
    for (const doc of [...reviews.docs, ...reports.docs]) {
      writer.delete(doc.ref);
    }
    await writer.close();

    await db.recursiveDelete(db.collection(Collections.users).doc(uid));
    await getStorage().bucket().deleteFiles({ prefix: `users/${uid}/` });

    await getAuth()
      .deleteUser(uid)
      .catch((err: { code?: string }) => {
        if (err.code !== 'auth/user-not-found') throw err;
      });

    return { deleted: true };
  } catch (err) {
    logger.error('deleteMyAccount failed', { uid, err });
    throw new HttpsError('internal', 'Could not delete your account. Please try again.');
  }
});
