import { createAsyncThunk } from '@reduxjs/toolkit';
import { Timestamp, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { PolicyStatus } from '@barakath/shared/config/enums';
import type { RootState } from '@/stores/store';
import { db } from '@/lib/firebaseConfig';

/**
 * setPolicyStatus — enable (show to customers) or disable (hide, keep in admin) one policy from the list
 * switch. Disabling is the ONLY way to take a policy down: the rules deny delete, so a policy's history
 * and its link target are never lost.
 *
 * WHY it stamps `updatedAt`/`updatedBy`: publishing or unpublishing a policy is an admin decision about
 * that policy, so it counts as an update (unlike a reorder, which only moves it in the footer).
 *
 * WHY it returns a client `Timestamp.now()`: `serverTimestamp()` is a write sentinel with no value, and
 * re-reading the doc just to show "Updated today" isn't worth a read. The list is patched in place with
 * this close-enough stamp; the next fetch replaces it with the server's.
 */
export const setPolicyStatus = createAsyncThunk<
  { id: string; status: PolicyStatus; updatedAt: Timestamp; updatedBy: string },
  { id: string; status: PolicyStatus },
  { state: RootState; rejectValue: string }
>('settings/setPolicyStatus', async ({ id, status }, { getState, rejectWithValue }) => {
  const updatedBy = getState().currentAdmin.admin?.id;
  if (!updatedBy) return rejectWithValue('Not signed in');
  try {
    await updateDoc(doc(db, FirestoreCollections.policies, id), {
      status,
      updatedAt: serverTimestamp(),
      updatedBy,
    });
    return { id, status, updatedAt: Timestamp.now(), updatedBy };
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not update the policy');
  }
});
