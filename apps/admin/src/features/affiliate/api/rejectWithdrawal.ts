import { createAsyncThunk } from '@reduxjs/toolkit';
import { doc, getDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import { AffiliateWithdrawalStatus } from '@barakath/shared/config/enums';
import type { AffiliateWithdrawalProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';

/**
 * rejectWithdrawal — admin rejects an affiliate withdrawal request with a reason (spec §1.14). Marks the
 * request Rejected and records `rejectionReason` + `processedBy` + `processedAt`.
 *
 * WHY no balance movement here: the affiliate's balance is only debited on APPROVAL (see
 * approveWithdrawal). A pending request has not yet moved money, so rejecting it simply leaves the
 * withdrawable balance intact ("Reject → returns amount to withdrawable balance", spec §1.14 — i.e. the
 * amount stays available). A single `updateDoc` is sufficient; no ledger row is written for a no-op.
 *
 * `processedBy` is passed in (the acting admin's display name) so the thunk stays free of store lookups.
 */
export const rejectWithdrawal = createAsyncThunk<
  AffiliateWithdrawalProps,
  { withdrawalId: string; rejectionReason: string; processedBy: string },
  { rejectValue: string }
>(
  'affiliate/rejectWithdrawal',
  async ({ withdrawalId, rejectionReason, processedBy }, { rejectWithValue }) => {
    try {
      const ref = doc(db, FirestoreCollections.affiliateWithdrawals, withdrawalId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return rejectWithValue('Withdrawal request not found');
      const withdrawal = { ...snap.data(), id: snap.id } as AffiliateWithdrawalProps;
      if (withdrawal.status !== AffiliateWithdrawalStatus.PENDING) {
        return rejectWithValue('This request has already been processed');
      }

      const now = Timestamp.now();
      await updateDoc(ref, {
        status: AffiliateWithdrawalStatus.REJECTED,
        rejectionReason: rejectionReason.trim(),
        processedBy,
        processedAt: serverTimestamp(),
      });

      return {
        ...withdrawal,
        status: AffiliateWithdrawalStatus.REJECTED,
        rejectionReason: rejectionReason.trim(),
        processedBy,
        processedAt: now,
      };
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Could not reject withdrawal');
    }
  },
);
