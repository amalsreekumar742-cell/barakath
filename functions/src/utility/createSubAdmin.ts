import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { Collections } from '../config/collections';
import { validateSuperAdmin } from '../utils/validateAuth';
import keywordsBuilder from '../utils/keywordsBuilder';

/** Role literal accepted for a sub-admin (matches SubAdminRole in packages/shared enums). */
type SubAdminRole = 'Super admin' | 'Manager' | 'Support';

interface CreateSubAdminInput {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  role: SubAdminRole;
  permissions: Record<string, boolean>;
}

const VALID_ROLES: readonly SubAdminRole[] = ['Super admin', 'Manager', 'Support'];

/**
 * createSubAdmin — provision an admin-panel user: Firebase Auth account + admin custom claim + profile doc.
 *
 * WHY a Cloud Function (not the client): three privileged steps the browser must never do —
 *   (1) getAuth().createUser() with a password (the client's createUserWithEmailAndPassword would sign the
 *       NEW user into the CURRENT admin's session), (2) setCustomUserClaims({ admin:true, role }) which
 *       gates Storage/Firestore rules and can only be set with the Admin SDK, (3) writing the profile doc
 *       keyed by the Auth uid so profile ⇄ auth stay 1:1. This replaces the client scaffold thunk.
 * WHY onCall: the only caller is our own admin SPA via httpsCallable — the callable protocol hands us a
 *   verified req.auth with no token parsing and serializes HttpsError codes the client understands.
 * AUTH: validateSuperAdmin — must be a signed-in admin whose token carries role 'Super admin'; anyone
 *   else is rejected before any work is done (fail closed).
 *
 * Request:  { fullName, email, phone, password, role, permissions }
 * Response: { success: true, subAdminId }
 * SECURITY: the password is handed to Firebase Auth and NEVER persisted to Firestore (deviates from the
 *   spec's 4.19 "password" column on purpose — storing a password, even hashed, in a client-readable
 *   collection is unacceptable; Auth is the sole credential store).
 */
export const createSubAdmin = onCall(async (request) => {
  validateSuperAdmin(request);

  const data = (request.data ?? {}) as Partial<CreateSubAdminInput>;
  const fullName = data.fullName?.trim();
  const email = data.email?.trim().toLowerCase();
  const phone = data.phone?.trim();
  const password = data.password;
  const role = data.role;
  const permissions = data.permissions;

  // Validate input first, before any Auth/Firestore write.
  if (!fullName) throw new HttpsError('invalid-argument', 'fullName is required');
  if (!email) throw new HttpsError('invalid-argument', 'email is required');
  if (!phone) throw new HttpsError('invalid-argument', 'phone is required');
  if (!password || password.length < 6) {
    throw new HttpsError('invalid-argument', 'password must be at least 6 characters');
  }
  if (!role || !VALID_ROLES.includes(role)) {
    throw new HttpsError('invalid-argument', 'role must be Super admin, Manager or Support');
  }
  if (!permissions || typeof permissions !== 'object') {
    throw new HttpsError('invalid-argument', 'permissions object is required');
  }

  const auth = getAuth();
  const db = getFirestore();

  try {
    // (1) Auth account. createUser throws auth/email-already-exists if the email is taken — mapped below.
    const user = await auth.createUser({ email, password, displayName: fullName });

    try {
      // (2) Admin claim + role — what Storage/Firestore rules check to recognise this admin.
      await auth.setCustomUserClaims(user.uid, { admin: true, role });

      // (3) Profile doc keyed by the Auth uid (id IN the doc so readers find it by field too).
      const keywords = keywordsBuilder(`${fullName} ${email} ${phone}`);
      await db
        .collection(Collections.subAdmins)
        .doc(user.uid)
        .set({
          id: user.uid,
          fullName,
          email,
          phone,
          role,
          permissions,
          status: 'Active',
          lastActive: null,
          keywords,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
    } catch (innerErr) {
      // Roll back the orphaned Auth account so a retry with the same email isn't blocked.
      await auth.deleteUser(user.uid).catch(() => undefined);
      throw innerErr;
    }

    return { success: true, subAdminId: user.uid };
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'auth/email-already-exists') {
      throw new HttpsError('already-exists', 'That email is already registered.');
    }
    if (code === 'auth/invalid-password') {
      throw new HttpsError('invalid-argument', 'Password does not meet the strength requirements.');
    }
    if (err instanceof HttpsError) throw err;
    logger.error('createSubAdmin failed', err);
    throw new HttpsError('internal', 'Could not create sub-admin.');
  }
});
