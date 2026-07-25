import { createAsyncThunk } from '@reduxjs/toolkit';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import { ReplacementStatus } from '@barakath/shared/config/enums';
import type { ReplacementProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';

export interface RejectReplacementInput {
  replacementId: string;
  adminNote: string;
  adminId: string;
  adminName: string;
}

/**
 * rejectReplacement — decline a Pending request with a mandatory admin note (spec §1.10). Unlike
 * approval this creates no order; it just resolves the request to Rejected and records who processed it
 * and why. The note is required (validated in the modal) so the customer notification has a reason.
 *
 * TODO: move to Cloud Function to send the FCM rejection notification.
 */
export const rejectReplacement = createAsyncThunk<
  ReplacementProps,
  RejectReplacementInput,
  { rejectValue: string }
>('replacement/reject', async (input, { rejectWithValue }) => {
  try {
    if (!input.adminNote.trim()) return rejectWithValue('A rejection note is required');

    const replRef = doc(db, FirestoreCollections.replacements, input.replacementId);
    const replSnap = await getDoc(replRef);
    if (!replSnap.exists()) return rejectWithValue('Replacement request not found');
    const replacement = { ...replSnap.data(), id: replSnap.id } as ReplacementProps;

    if (replacement.status !== ReplacementStatus.PENDING)
      return rejectWithValue('Only a pending request can be rejected');

    await updateDoc(replRef, {
      status: ReplacementStatus.REJECTED,
      adminNote: input.adminNote.trim(),
      processedBy: input.adminId,
      processedByName: input.adminName,
      processedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Re-read so the slice gets server-resolved timestamps + the new status.
    const updated = await getDoc(replRef);
    return { ...updated.data(), id: updated.id } as ReplacementProps;
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not reject the replacement');
  }
});
