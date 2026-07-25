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
import { WalletTransactionType, WalletSource } from '@barakath/shared/config/enums';
import type { WalletTransactionProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';

/**
 * addWalletMoney — admin credits a customer's wallet (spec §1.8 "Add money to wallet").
 *
 * Reads the current balance, appends a Credit `walletTransactions` ledger entry (source: Admin), and
 * atomically increments the user's `walletBalance` via `FieldValue.increment` — the two writes go in one
 * `writeBatch` so a partial failure can't record a credit without moving the balance (or vice-versa).
 *
 * TODO: move to Cloud Function — admin wallet credit should be atomic. A batched client write can't
 * guarantee `balanceAfter` reflects concurrent spends (the read-then-write on the balance snapshot
 * races); a Cloud Function using `runTransaction` should own this so the money math is server-authoritative.
 *
 * Returns the new transaction (with a client-estimated `balanceAfter`) and the credited amount so the
 * slice can prepend the row and bump the detail balance without a refetch.
 */
export const addWalletMoney = createAsyncThunk<
  { transaction: WalletTransactionProps; amount: number },
  { userId: string; amount: number; description: string },
  { rejectValue: string }
>('customers/addWalletMoney', async ({ userId, amount, description }, { rejectWithValue }) => {
  try {
    const userRef = doc(db, FirestoreCollections.users, userId);
    const snap = await getDoc(userRef);
    if (!snap.exists()) return rejectWithValue('Customer not found');
    const current = (snap.data().walletBalance as number) ?? 0;
    const balanceAfter = current + amount;

    const txnRef = doc(collection(db, FirestoreCollections.walletTransactions));
    const now = Timestamp.now();
    const transaction: WalletTransactionProps = {
      id: txnRef.id,
      userId,
      type: WalletTransactionType.CREDIT,
      amount,
      source: WalletSource.ADMIN,
      description,
      orderId: '',
      balanceAfter,
      createdAt: now,
    };

    const batch = writeBatch(db);
    // Persist with a server timestamp for authoritative ordering; the returned object carries a
    // client `Timestamp.now()` only so the optimistic slice row can render immediately.
    batch.set(txnRef, { ...transaction, createdAt: serverTimestamp() });
    batch.update(userRef, { walletBalance: increment(amount), updatedAt: serverTimestamp() });
    await batch.commit();

    return { transaction, amount };
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not add money to wallet');
  }
});
