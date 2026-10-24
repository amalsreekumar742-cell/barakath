import { HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { Collections } from '../../config/collections';

/**
 * Credit a wallet top-up the gateway has charged — shared by the two paths that can learn of the
 * payment: `verifyWalletTopUp` (the customer's app reports success) and `razorpayWebhook` (Razorpay's
 * server reports `payment.captured`, which still arrives when the app was closed or lost its network
 * before it could report). Whichever lands first credits; the other finds the top-up already Paid.
 *
 * WHY ONE transaction keyed on the top-up's status: `FieldValue.increment` is atomic but NOT
 * idempotent, and both paths — plus Razorpay's own retries — can run for the same payment. Flipping
 * Pending → Paid in the same transaction that performs the credit makes every later attempt a no-op.
 *
 * WHY the amount comes from the stored top-up: neither a signature nor a webhook event is trusted for
 * the VALUE here — the top-up document recorded what the Razorpay order was opened for.
 */
export async function settleWalletTopUp(
  topUpRef: FirebaseFirestore.DocumentReference,
  payment: { razorpayPaymentId: string; razorpaySignature?: string; settledVia: 'client' | 'webhook' },
): Promise<{ amount: number; newBalance: number; alreadySettled: boolean }> {
  const db = getFirestore();
  return db.runTransaction(async (tx) => {
    const topUp = await tx.get(topUpRef);
    if (!topUp.exists) throw new HttpsError('not-found', 'No top-up found for this payment.');
    const userId = String(topUp.get('userId') ?? '');
    const userRef = db.collection(Collections.users).doc(userId);
    const userDoc = await tx.get(userRef);
    const recorded = Number(topUp.get('amount')) || 0;

    // Already settled — report the balance as it stands rather than crediting a second time. This is
    // the retry / second-path case, not an error.
    if (topUp.get('status') === 'Paid') {
      return {
        amount: recorded,
        newBalance: (userDoc.get('walletBalance') as number | undefined) ?? 0,
        alreadySettled: true,
      };
    }
    if (!userId || !userDoc.exists) throw new HttpsError('not-found', 'User not found.');
    if (recorded <= 0) {
      throw new HttpsError('failed-precondition', 'This top-up has no amount recorded.');
    }

    const currentBalance = (userDoc.get('walletBalance') as number | undefined) ?? 0;
    const updatedBalance = Math.round((currentBalance + recorded) * 100) / 100;

    tx.set(db.collection(Collections.walletTransactions).doc(), {
      userId,
      type: 'Credit',
      amount: recorded,
      // Spec §4.9 lists this source.
      source: 'UPI top-up',
      description: 'Money added to wallet',
      orderId: '',
      balanceAfter: updatedBalance,
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.update(userRef, {
      walletBalance: FieldValue.increment(recorded),
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.update(topUpRef, {
      status: 'Paid',
      razorpayPaymentId: payment.razorpayPaymentId,
      // The webhook has no client-side signature; it authenticated the whole event instead.
      ...(payment.razorpaySignature ? { razorpaySignature: payment.razorpaySignature } : {}),
      settledVia: payment.settledVia,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { amount: recorded, newBalance: updatedBalance, alreadySettled: false };
  });
}
