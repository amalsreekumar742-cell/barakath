import { createAsyncThunk } from '@reduxjs/toolkit';
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { ReplacementProps } from '@barakath/shared/types';
import { db, functions } from '@/lib/firebaseConfig';

export interface ApproveReplacementInput {
  replacementId: string;
  adminNote: string;
}

/**
 * approveReplacement — approve a Pending return request. The refund lands in the customer's WALLET.
 *
 * WHY a callable and not a batch here: approval moves money (it credits `walletBalance` and appends a
 * `walletTransactions` ledger row), which no client may ever do — `firestore.rules` must not, and does
 * not, permit it. This used to run entirely in the browser as a `writeBatch` that minted a free ₹0
 * replacement order; that behaviour is gone (user decision, 2026-08-03) and with it the rule that let an
 * admin client create `orders` documents. All the logic — the refund calculation, idempotency and the
 * customer notification — now lives in `functions/src/growth/approveReplacement.ts`.
 *
 * `adminId`/`adminName` are deliberately NOT parameters: the function reads them from the verified auth
 * token, so a caller cannot attribute an approval to someone else.
 *
 * Returns the re-read replacement doc so `replacementSlice.resolveRequest` keeps working unchanged.
 */
export const approveReplacement = createAsyncThunk<
  ReplacementProps,
  ApproveReplacementInput,
  { rejectValue: string }
>('replacement/approve', async (input, { rejectWithValue }) => {
  try {
    const call = httpsCallable<
      { replacementId: string; adminNote: string },
      { refundAmount: number; newBalance: number; walletTransactionId: string }
    >(functions, 'approveReplacement');
    await call({ replacementId: input.replacementId, adminNote: input.adminNote });

    // Re-read so the slice gets the server-resolved status, refund amount and timestamps.
    const updated = await getDoc(
      doc(db, FirestoreCollections.replacements, input.replacementId),
    );
    return { ...updated.data(), id: updated.id } as ReplacementProps;
  } catch (err) {
    return rejectWithValue(
      err instanceof Error ? err.message : 'Could not approve the return request',
    );
  }
});
