import { createAsyncThunk } from '@reduxjs/toolkit';
import { collection, query, where, doc, deleteDoc, getCountFromServer } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import { SubAdminRole } from '@barakath/shared/config/enums';
import type { SubAdminProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';

/**
 * deleteSubAdmin — hard-delete a sub-admin (spec §1.20 delete action; spec §1.22 hard deletes throughout,
 * confirmed with a dialog + toast in the component).
 *
 * Two guards run BEFORE the delete (both surfaced as reject messages the component toasts):
 *   1. Cannot delete yourself — an admin removing their own account would orphan the session.
 *   2. Cannot delete the LAST Super admin — a server-side count of Super admins must stay ≥ 1, otherwise
 *      the panel could be locked out of Settings/Sub Admin forever. WHY getCountFromServer: it reads only
 *      the aggregate, not the docs, and is the authoritative count regardless of what's on the loaded page.
 *
 * ⚠️ This deletes only the Firestore PROFILE document. The Firebase Auth ACCOUNT deletion is privileged:
 *   // TODO: move to Cloud Function — the real flow must also call admin.auth().deleteUser(uid) so the
 *   //   login credential is revoked; a client cannot delete another user's Auth account.
 *
 * WHY it returns the id: the slice removes the row in place without a re-fetch.
 */
export const deleteSubAdmin = createAsyncThunk<
  string,
  { target: SubAdminProps; currentAdminId: string },
  { rejectValue: string }
>('subAdmin/delete', async ({ target, currentAdminId }, { rejectWithValue }) => {
  try {
    if (target.id === currentAdminId) {
      return rejectWithValue('You cannot delete your own account');
    }

    if (target.role === SubAdminRole.SUPER_ADMIN) {
      const superAdminCount = await getCountFromServer(
        query(
          collection(db, FirestoreCollections.subAdmins),
          where('role', '==', SubAdminRole.SUPER_ADMIN),
        ),
      );
      if (superAdminCount.data().count <= 1) {
        return rejectWithValue('Cannot delete the last Super admin');
      }
    }

    await deleteDoc(doc(db, FirestoreCollections.subAdmins, target.id));
    return target.id;
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not delete sub-admin');
  }
});
