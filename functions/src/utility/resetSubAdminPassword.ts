import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { Collections } from '../config/collections';
import { validateSuperAdmin } from '../utils/validateAuth';

/**
 * resetSubAdminPassword — set a new password for an existing admin-panel user.
 *
 * WHY a Cloud Function: getAuth().updateUser({ password }) is an Admin-SDK-only operation; the client can
 *   never change another user's credentials. The new password is applied to Auth and NEVER stored in
 *   Firestore (Auth is the sole credential store).
 * WHY onCall + validateSuperAdmin: only a Super admin from our own SPA may rotate another admin's password.
 *
 * Request:  { subAdminId, newPassword }
 * Response: { success: true }
 */
export const resetSubAdminPassword = onCall(async (request) => {
  validateSuperAdmin(request);

  const data = (request.data ?? {}) as { subAdminId?: string; newPassword?: string };
  const subAdminId = data.subAdminId?.trim();
  const newPassword = data.newPassword;
  if (!subAdminId) throw new HttpsError('invalid-argument', 'subAdminId is required');
  if (!newPassword || newPassword.length < 6) {
    throw new HttpsError('invalid-argument', 'newPassword must be at least 6 characters');
  }

  try {
    await getAuth().updateUser(subAdminId, { password: newPassword });
    // Stamp updatedAt so the profile list reflects the change; the password itself is not persisted.
    await getFirestore()
      .collection(Collections.subAdmins)
      .doc(subAdminId)
      .update({ updatedAt: FieldValue.serverTimestamp() });
    return { success: true };
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'auth/user-not-found') {
      throw new HttpsError('not-found', 'That sub-admin no longer exists.');
    }
    if (code === 'auth/invalid-password') {
      throw new HttpsError('invalid-argument', 'Password does not meet the strength requirements.');
    }
    if (err instanceof HttpsError) throw err;
    logger.error('resetSubAdminPassword failed', err);
    throw new HttpsError('internal', 'Could not reset the password.');
  }
});
