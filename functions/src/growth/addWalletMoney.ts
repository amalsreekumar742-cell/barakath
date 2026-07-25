import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { Collections } from '../config/collections';
import { validateAdmin } from '../utils/validateAuth';

/**
 * addWalletMoney — an admin credits a customer's wallet ("Add money"), appending a ledger entry and
 * bumping the balance.
 *
 * WHY onCall + validateAdmin: only the admin panel calls this and only an admin may credit a wallet;
 *   the callable protocol supplies the verified admin claim.
 * WHY server-side: walletBalance is money — the client must never write it; the Admin SDK does, behind
 *   this admin gate.
 * WHY runTransaction: balanceAfter on the ledger entry must equal the balance AT write time, so the
 *   read of the current balance and the write of the new one must be atomic — a read-modify-write would
 *   race with a concurrent debit at checkout and record a wrong running balance.
 *
 * Request:  { userId: string, amount: number, description?: string }
 * Response: { success: true, newBalance: number }
 */
export const addWalletMoney = onCall(
  async (request): Promise<{ success: true; newBalance: number }> => {
    validateAdmin(request);

    const { userId, amount, description } = (request.data ?? {}) as {
      userId?: unknown;
      amount?: unknown;
      description?: unknown;
    };
    if (typeof userId !== 'string' || userId.trim() === '') {
      throw new HttpsError('invalid-argument', 'userId is required');
    }
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      throw new HttpsError('invalid-argument', 'amount must be a positive number');
    }
    const desc = typeof description === 'string' ? description : '';

    const db = getFirestore();
    const userRef = db.collection(Collections.users).doc(userId);
    const txnRef = db.collection(Collections.walletTransactions).doc();

    const newBalance = await db.runTransaction(async (tx) => {
      const userDoc = await tx.get(userRef);
      if (!userDoc.exists) {
        throw new HttpsError('not-found', 'User not found');
      }
      const currentBalance = (userDoc.get('walletBalance') as number | undefined) ?? 0;
      const updatedBalance = currentBalance + amount;

      tx.set(txnRef, {
        userId,
        type: 'Credit',
        amount,
        source: 'Admin',
        description: desc,
        orderId: '',
        balanceAfter: updatedBalance,
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.update(userRef, {
        walletBalance: FieldValue.increment(amount),
        updatedAt: FieldValue.serverTimestamp(),
      });

      return updatedBalance;
    });

    return { success: true, newBalance };
  },
);
