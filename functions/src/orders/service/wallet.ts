import {
  getFirestore,
  FieldValue,
  type Transaction,
  type DocumentReference,
} from 'firebase-admin/firestore';
import { Collections } from '../../config/collections';
import { round2 } from './computeTotals';

/**
 * Wallet ledger writes (spec §1.8 Wallet). The wallet is money, so every change is (a) atomic with the
 * order/refund it belongs to and (b) recorded as an append-only ledger entry carrying the running
 * `balanceAfter` the server computed. WHY write helpers (not read): the caller already holds the user doc
 * (read for other checks) inside the transaction, so these take the current balance and only WRITE —
 * keeping them on the write side of the "all reads before all writes" rule.
 */

/** Append a walletTransactions ledger entry. */
function writeLedgerEntry(
  tx: Transaction,
  userId: string,
  type: 'Credit' | 'Debit',
  amount: number,
  source: 'Refund' | 'Reward' | 'Top-up' | 'Purchase' | 'Admin',
  description: string,
  orderId: string,
  balanceAfter: number,
): void {
  const db = getFirestore();
  tx.set(db.collection(Collections.walletTransactions).doc(), {
    userId,
    type,
    amount: round2(amount),
    source,
    description,
    orderId,
    balanceAfter: round2(balanceAfter),
    createdAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Debit the wallet to pay for an order: reduce the user's balance and log a Debit/Purchase entry.
 * Returns the new balance. Caller must have already validated `amount ≤ currentBalance`.
 */
export function debitWallet(
  tx: Transaction,
  userRef: DocumentReference,
  userId: string,
  currentBalance: number,
  amount: number,
  orderId: string,
): number {
  const newBalance = round2(currentBalance - amount);
  tx.update(userRef, { walletBalance: newBalance, updatedAt: FieldValue.serverTimestamp() });
  writeLedgerEntry(tx, userId, 'Debit', amount, 'Purchase', `Order ${orderId}`, orderId, newBalance);
  return newBalance;
}

/**
 * Credit the wallet back on refund / failed payment / cancellation: raise the balance and log a
 * Credit/Refund entry. Returns the new balance.
 */
export function creditWallet(
  tx: Transaction,
  userRef: DocumentReference,
  userId: string,
  currentBalance: number,
  amount: number,
  orderId: string,
  description: string,
): number {
  const newBalance = round2(currentBalance + amount);
  tx.update(userRef, { walletBalance: newBalance, updatedAt: FieldValue.serverTimestamp() });
  writeLedgerEntry(tx, userId, 'Credit', amount, 'Refund', description, orderId, newBalance);
  return newBalance;
}
