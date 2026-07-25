import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import {
  OTP_REQUESTS_COLLECTION,
  normalizeOtpSource,
  resolveWidgetCredentials,
} from './constants';
import { sendOtp, normalizePhone, isSuccess, payloadOf } from './msg91Client';

/**
 * authOTP — send a login OTP to a storefront customer's phone via the MSG91 OTP Widget (spec §5.2 #1).
 *
 * WHY a Cloud Function: the MSG91 widget credentials are server-only secrets — they can never ship to a
 *   client, so the send must happen server-side (skill: secrets live in functions/.env, never in client
 *   env vars).
 * WHY onCall with NO auth gate: this is the pre-login step — the caller is an anonymous visitor who has no
 *   Firebase identity yet, so there is intentionally no validateAuth here. The only guard is input shape.
 * WHY the reqId is stored (not returned): verify/retry need the reqId MSG91 issues here. Parking it in
 *   Firestore keeps the callable contract unchanged and stops a client from tampering with it.
 *
 * Request:  { phone: '10 digits', countryCode: '+91', source?: 'app' | 'web' }
 * Response: { success: true, message: 'OTP sent' }
 */
export const authOTP = onCall(async (request) => {
  const data = (request.data ?? {}) as { phone?: string; countryCode?: string; source?: string };
  const normalized = normalizePhone(data.phone, data.countryCode);
  if (!normalized) {
    throw new HttpsError('invalid-argument', 'Enter a valid 10-digit Indian (+91) mobile number.');
  }

  // The app and website use SEPARATE MSG91 widgets. Resolve which one from the caller's source, and
  // record it below so verify/resend act on the SAME widget the reqId was issued by — a reqId is not
  // portable across widgets.
  const source = normalizeOtpSource(data.source);

  // Resolve params INSIDE the handler (never at module scope) — a missing value already blocked deploy.
  const { widgetId, tokenAuth } = resolveWidgetCredentials(source);

  try {
    const result = await sendOtp(widgetId, tokenAuth, normalized.digits, source);
    if (!isSuccess(result)) {
      // MSG91 rejected the send (e.g. rate limit); surface a generic message, keep detail in the log.
      logger.error(
        `authOTP: MSG91 send rejected — ${JSON.stringify(result)}`,
      );
      throw new HttpsError('resource-exhausted', 'Could not send the OTP right now. Please try again.');
    }

    const reqId = payloadOf(result);
    if (!reqId) {
      logger.error('authOTP: MSG91 returned no reqId', { result });
      throw new HttpsError('internal', 'Could not send the OTP. Please try again.');
    }

    // Park the request id for verifyOTP / resendOTP (keyed by phone — one pending request each).
    await getFirestore()
      .collection(OTP_REQUESTS_COLLECTION)
      .doc(normalized.digits)
      .set({
        reqId,
        phone: normalized.e164,
        // The widget this reqId belongs to. verifyOTP/resendOTP read this back so they never verify a
        // web-issued code against the app widget (or vice versa), which MSG91 rejects.
        source,
        createdAt: FieldValue.serverTimestamp(),
        createdAtMs: Date.now(),
      });

    logger.info(`authOTP: stored reqId ${reqId} for ${normalized.digits}`);
    return { success: true, message: 'OTP sent' };
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    logger.error('authOTP failed', err);
    throw new HttpsError('internal', 'Could not send the OTP. Please try again.');
  }
});
