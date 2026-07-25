import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  doc,
  getDoc,
  collection,
  writeBatch,
  increment,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import {
  AffiliateWithdrawalStatus,
  AffiliateTransactionSource,
  WalletTransactionType,
} from '@barakath/shared/config/enums';
import type { AffiliateWithdrawalProps, AffiliateTransactionProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';

/**
 * approveWithdrawal — admin approves an affiliate withdrawal request (spec §1.14). Reads the withdrawal
 * (for `userId` + `amount`) and the affiliate's current balance, then commits ONE `writeBatch` that:
 *  1. marks the withdrawal Approved (+ processedBy / processedAt),
 *  2. writes a Debit `affiliateTransactions` ledger row (source Withdrawal, "Withdrawal approved",
 *     balanceAfter = currentAffiliateBalance − amount), and
 *  3. atomically decrements the user's `affiliateBalance` via `increment(-amount)`.
 * Batching keeps the three writes all-or-nothing so a partial failure can't approve without deducting.
 *
 * TODO: move to Cloud Function — withdrawal approval should be atomic with balance deduction. A batched
 * client write can't guarantee `balanceAfter` reflects concurrent movements (the read-then-write on the
 * balance snapshot races); a Cloud Function using `runTransaction` should own this so the money math is
 * server-authoritative. Admin manually transfers the funds outside the system after approving.
 *
 * `processedBy` is passed in (the acting admin's display name) so the thunk stays free of store lookups.
 */
export const approveWithdrawal = createAsyncThunk<
  { withdrawal: AffiliateWithdrawalProps; transaction: AffiliateTransactionProps },
  { withdrawalId: string; processedBy: string },
  { rejectValue: string }
>('affiliate/approveWithdrawal', async ({ withdrawalId, processedBy }, { rejectWithValue }) => {
  try {
    const withdrawalRef = doc(db, FirestoreCollections.affiliateWithdrawals, withdrawalId);
    const wSnap = await getDoc(withdrawalRef);
    if (!wSnap.exists()) return rejectWithValue('Withdrawal request not found');
    const withdrawal = { ...wSnap.data(), id: wSnap.id } as AffiliateWithdrawalProps;
    if (withdrawal.status !== AffiliateWithdrawalStatus.PENDING) {
      return rejectWithValue('This request has already been processed');
    }

    // The user to deduct from is identified by the withdrawal's own `userId`.
    const userRef = doc(db, FirestoreCollections.users, withdrawal.userId);
    const uSnap = await getDoc(userRef);
    if (!uSnap.exists()) return rejectWithValue('Affiliate account not found');
    const currentBalance = (uSnap.data().affiliateBalance as number) ?? 0;
    const balanceAfter = currentBalance - withdrawal.amount;

    const now = Timestamp.now();
    const txnRef = doc(collection(db, FirestoreCollections.affiliateTransactions));
    const transaction: AffiliateTransactionProps = {
      id: txnRef.id,
      userId: withdrawal.userId,
      type: WalletTransactionType.DEBIT, // 'Debit' — shared Credit/Debit vocabulary
      amount: withdrawal.amount,
      source: AffiliateTransactionSource.WITHDRAWAL,
      description: 'Withdrawal approved',
      referredUserId: '',
      referredUserName: '',
      orderId: '',
      balanceAfter,
      status: 'Withdrawn',
      clearsAt: null,
      createdAt: now,
    };

    const batch = writeBatch(db);
    batch.update(withdrawalRef, {
      status: AffiliateWithdrawalStatus.APPROVED,
      processedBy,
      processedAt: serverTimestamp(),
    });
    // Persist the ledger row with a server timestamp for authoritative ordering; the returned object
    // keeps a client `Timestamp.now()` only so the optimistic slice row can render immediately.
    batch.set(txnRef, { ...transaction, createdAt: serverTimestamp() });
    batch.update(userRef, {
      affiliateBalance: increment(-withdrawal.amount),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();

    const updated: AffiliateWithdrawalProps = {
      ...withdrawal,
      status: AffiliateWithdrawalStatus.APPROVED,
      processedBy,
      processedAt: now,
    };
    return { withdrawal: updated, transaction };
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not approve withdrawal');
  }
});
