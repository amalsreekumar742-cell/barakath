import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';

/**
 * Auth gates for callable functions. `req.auth` is populated by the callable protocol from the caller's
 * verified ID token — never trust a uid passed in req.data. The custom claims `admin` / `role` are set by
 * createSubAdmin (Admin SDK), so a signed-in admin carries them on the token.
 */

/** Require a signed-in user; returns their uid. */
export function validateAuth(request: CallableRequest): string {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }
  return request.auth.uid;
}

/** Require the caller to be an admin (admin:true claim); returns their uid. */
export function validateAdmin(request: CallableRequest): string {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }
  if (!request.auth.token.admin) {
    throw new HttpsError('permission-denied', 'Admin access required');
  }
  return request.auth.uid;
}

/** Require the caller to be a Super admin (admin:true + role === 'Super admin'); returns their uid. */
export function validateSuperAdmin(request: CallableRequest): string {
  const uid = validateAdmin(request);
  if (request.auth?.token.role !== 'Super admin') {
    throw new HttpsError('permission-denied', 'Super admin access required');
  }
  return uid;
}
