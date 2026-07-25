import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { Collections } from '../config/collections';
import keywordsBuilder from '../utils/keywordsBuilder';
import {
  OTP_REQUESTS_COLLECTION,
  OTP_REQUEST_TTL_MS,
  normalizeOtpSource,
  resolveWidgetCredentials,
} from './constants';
import { verifyOtp, normalizePhone, isSuccess } from './msg91Client';

/**
 * verifyOTP — verify a storefront customer's OTP and mint a Firebase custom token to sign them in.
 *
 * WHY a Cloud Function: (1) the MSG91 widget verify call needs server-only credentials; (2)
 *   createCustomToken is an Admin-SDK-only operation — the client cannot forge its own sign-in; (3) a
 *   brand-new customer's users doc + Auth account are created here atomically so the app can trust the
 *   account exists.
 * WHY onCall with NO auth gate: the caller has no Firebase identity yet — verifying the OTP is what mints
 *   it. Identity is derived from the VERIFIED phone number, never from client-supplied uid.
 * WHY no separate verifyAccessToken call: in the widget flow that endpoint exists so a server can trust an
 *   access-token produced by a *client-side* widget. Here the server itself made the verify call, so a
 *   `success` response is already first-hand proof — re-verifying our own token would add nothing.
 *
 * Request:  { phone: '10 digits', countryCode: '+91', otp }
 * Response: { verified: true, customToken, isNewUser } | { verified: false }
 */
export const verifyOTP = onCall(async (request) => {
  const data = (request.data ?? {}) as { phone?: string; countryCode?: string; otp?: string };
  const normalized = normalizePhone(data.phone, data.countryCode);
  if (!normalized) {
    throw new HttpsError('invalid-argument', 'Enter a valid 10-digit Indian (+91) mobile number.');
  }
  const otp = typeof data.otp === 'string' ? data.otp.trim() : '';
  if (!/^\d{4,6}$/.test(otp)) {
    throw new HttpsError('invalid-argument', 'Enter the 6-digit OTP.');
  }

  try {
    const db = getFirestore();
    const auth = getAuth();

    // The pending request issued by authOTP — required by the widget verify call.
    const reqRef = db.collection(OTP_REQUESTS_COLLECTION).doc(normalized.digits);
    const reqSnap = await reqRef.get();
    const pending = reqSnap.data();
    const reqId = typeof pending?.reqId === 'string' ? pending.reqId : '';
    const createdAtMs = typeof pending?.createdAtMs === 'number' ? pending.createdAtMs : 0;

    // Resolve the widget from the STORED source, not from anything the client sends now — the reqId
    // above was issued by that widget and cannot be verified against another. Legacy pending requests
    // written before this field existed have no `source`; normalizeOtpSource maps that to 'app'.
    const { widgetId, tokenAuth } = resolveWidgetCredentials(normalizeOtpSource(pending?.source));

    if (!reqId || Date.now() - createdAtMs > OTP_REQUEST_TTL_MS) {
      // Nothing pending (or it aged out) — the client should request a fresh code.
      logger.error(
        `verifyOTP: no usable pending request for ${normalized.digits} — ` +
          `exists=${reqSnap.exists} reqId=${reqId || '(none)'} ` +
          `createdAtMs=${createdAtMs} ageMs=${createdAtMs ? Date.now() - createdAtMs : 'n/a'} ` +
          `data=${JSON.stringify(pending ?? null)}`,
      );
      throw new HttpsError('failed-precondition', 'This code has expired. Please request a new OTP.');
    }

    const result = await verifyOtp(widgetId, tokenAuth, reqId, otp);
    if (!isSuccess(result)) {
      // Wrong/expired code — not an error condition, a negative result the client shows inline.
      return { verified: false };
    }

    // Find an existing customer by phone. Stored formats vary, so match both the E.164 and 10-digit forms.
    const usersRef = db.collection(Collections.users);
    let userSnap = await usersRef.where('phone', '==', normalized.e164).limit(1).get();
    if (userSnap.empty) {
      userSnap = await usersRef.where('phone', '==', normalized.local).limit(1).get();
    }

    // The code is spent — drop the pending request so it can't be replayed.
    await reqRef.delete().catch(() => undefined);

    if (!userSnap.empty) {
      const doc = userSnap.docs[0];
      if (!doc) return { verified: false };
      const uid = doc.id;
      // Touch updatedAt so "last seen" reflects the sign-in; keep the phone as already stored.
      await doc.ref.update({ updatedAt: FieldValue.serverTimestamp() });
      const customToken = await auth.createCustomToken(uid);
      return { verified: true, customToken, isNewUser: false };
    }

    // New customer — create the Auth account (phone provider) then the users doc keyed by the Auth uid.
    const authUser = await auth.createUser({ phoneNumber: normalized.e164 });
    const uid = authUser.uid;
    await usersRef.doc(uid).set({
      id: uid,
      fullName: '',
      email: '',
      phone: normalized.e164,
      profileImage: '',
      status: 'Active',
      walletBalance: 0,
      affiliateCode: '',
      affiliateBalance: 0,
      totalOrders: 0,
      totalSpent: 0,
      keywords: keywordsBuilder(normalized.e164),
      fcmToken: '',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    const customToken = await auth.createCustomToken(uid);
    return { verified: true, customToken, isNewUser: true };
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    logger.error('verifyOTP failed', err);
    throw new HttpsError('internal', 'Could not verify the OTP. Please try again.');
  }
});
