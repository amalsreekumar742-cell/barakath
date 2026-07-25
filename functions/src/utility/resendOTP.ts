import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import {
  OTP_REQUESTS_COLLECTION,
  OTP_REQUEST_TTL_MS,
  normalizeOtpSource,
  resolveWidgetCredentials,
} from './constants';
import { resendOtp, normalizePhone, isSuccess, RETRY_CHANNELS } from './msg91Client';

/**
 * resendOTP — resend the login OTP via SMS ('text') or a voice call ('voice') through the MSG91 widget.
 *
 * WHY a Cloud Function: same reason as authOTP — the MSG91 widget credentials are server-only secrets.
 * WHY onCall with NO auth gate: still the pre-login step; the visitor has no Firebase identity yet.
 * WHY it reads the stored reqId: the widget retry endpoint resends against the ORIGINAL request rather
 *   than starting a new one, so it needs the reqId authOTP parked.
 *
 * Request:  { phone: '10 digits', countryCode: '+91', retryType: 'text' | 'voice' }
 * Response: { success: true }
 */
export const resendOTP = onCall(async (request) => {
  const data = (request.data ?? {}) as { phone?: string; countryCode?: string; retryType?: string };
  const normalized = normalizePhone(data.phone, data.countryCode);
  if (!normalized) {
    throw new HttpsError('invalid-argument', 'Enter a valid 10-digit Indian (+91) mobile number.');
  }
  // The app speaks 'text' | 'voice'; MSG91's widget wants a numeric channel code.
  const retryChannel = data.retryType === 'voice' ? RETRY_CHANNELS.voice : RETRY_CHANNELS.sms;

  try {
    const reqRef = getFirestore().collection(OTP_REQUESTS_COLLECTION).doc(normalized.digits);
    const reqSnap = await reqRef.get();
    const pending = reqSnap.data();
    const reqId = typeof pending?.reqId === 'string' ? pending.reqId : '';
    const createdAtMs = typeof pending?.createdAtMs === 'number' ? pending.createdAtMs : 0;

    // Retry against the widget that ISSUED this reqId (stored by authOTP), never a client-claimed one.
    const { widgetId, tokenAuth } = resolveWidgetCredentials(normalizeOtpSource(pending?.source));

    if (!reqId || Date.now() - createdAtMs > OTP_REQUEST_TTL_MS) {
      throw new HttpsError('failed-precondition', 'This code has expired. Please request a new OTP.');
    }

    const result = await resendOtp(widgetId, tokenAuth, reqId, retryChannel);
    if (!isSuccess(result)) {
      logger.error('resendOTP: MSG91 retry rejected', { message: result.message });
      throw new HttpsError('resource-exhausted', 'Could not resend the OTP right now. Please try again.');
    }

    // Restart the TTL clock. A resend issues a FRESH code, so leaving createdAtMs
    // at the original send would expire a code the customer just received — the
    // exact failure seen in testing (resend at T+20min → "This code has expired").
    await reqRef.update({ createdAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp() });
    return { success: true };
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    logger.error('resendOTP failed', err);
    throw new HttpsError('internal', 'Could not resend the OTP. Please try again.');
  }
});
