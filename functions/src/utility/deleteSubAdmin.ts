import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { Collections } from '../config/collections';
import { validateSuperAdmin } from '../utils/validateAuth';

/**
 * deleteSubAdmin — remove an admin-panel user: delete the Auth account AND the profile doc together.
 *
 * WHY a Cloud Function: deleting a Firebase Auth account requires the Admin SDK; leaving the Auth user
 *   while removing only the doc would strand a still-signed-in admin whose token still carries admin:true.
 * WHY onCall + validateSuperAdmin: same trust model as createSubAdmin — only a Super admin from our own
 *   SPA may deprovision another admin.
 *
 * Request:  { subAdminId }
 * Response: { success: true }
 */
export const deleteSubAdmin = onCall(async (request) => {
  validateSuperAdmin(request);

  const subAdminId = (request.data as { subAdminId?: string })?.subAdminId?.trim();
  if (!subAdminId) throw new HttpsError('invalid-argument', 'subAdminId is required');

  const auth = getAuth();
  const db = getFirestore();

  try {
    // Delete the Auth account first (revokes access); tolerate a missing account so the doc still clears.
    await auth.deleteUser(subAdminId).catch((err: { code?: string }) => {
      if (err.code !== 'auth/user-not-found') throw err;
    });
    await db.collection(Collections.subAdmins).doc(subAdminId).delete();
    return { success: true };
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    logger.error('deleteSubAdmin failed', err);
    throw new HttpsError('internal', 'Could not delete sub-admin.');
  }
});
