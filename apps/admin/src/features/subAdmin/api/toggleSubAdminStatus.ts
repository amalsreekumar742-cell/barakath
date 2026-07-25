import { createAsyncThunk } from '@reduxjs/toolkit';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import { SubAdminStatus } from '@barakath/shared/config/enums';
import type { SubAdminStatus as SubAdminStatusType } from '@barakath/shared/config/enums';
import { db } from '@/lib/firebaseConfig';

/**
 * toggleSubAdminStatus — flip a sub-admin between Active and Suspended from the list (spec §1.20 status
 * toggle). A suspended admin is blocked at login and force-signed-out by the RouteGuard.
 *
 * WHY only status + updatedAt are written: it is a single low-risk field flip that can't disturb the
 * profile, permissions, or keywords. updatedAt is server-stamped. Returns {id, status} so the slice
 * patches just that row in place — no re-fetch — and the badge recomputes from it.
 */
export const toggleSubAdminStatus = createAsyncThunk<
  { id: string; status: SubAdminStatusType },
  { id: string; status: SubAdminStatusType },
  { rejectValue: string }
>('subAdmin/toggleStatus', async ({ id, status }, { rejectWithValue }) => {
  try {
    // Normalise to the enum values so an unexpected string can never be written.
    const next =
      status === SubAdminStatus.SUSPENDED ? SubAdminStatus.SUSPENDED : SubAdminStatus.ACTIVE;
    await updateDoc(doc(db, FirestoreCollections.subAdmins, id), {
      status: next,
      updatedAt: serverTimestamp(),
    });
    return { id, status: next };
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not update status');
  }
});
