import { defineString } from 'firebase-functions/params';

/**
 * MSG91 OTP Widget credentials for the phone-auth flow (spec §5.2 #1 authOTP).
 *
 * WHY the WIDGET flow (not the template /otp API): the widget flow authenticates with a
 *   widgetId + tokenAuth pair and needs no approved template_id. We drive its REST endpoints
 *   from the server, so the credentials never ship to a client — same security posture as before.
 * WHERE they come from: the admin panel (Settings › OTP) writes them to the admin-only `general/msg91`
 *   document, and `getOtpConfig` (otpConfig.ts) reads it on every call — so a widget or token change
 *   takes effect immediately, with no redeploy. The params below are only the FALLBACK used until an
 *   admin has saved that tab, which is why each defaults to '' instead of blocking deploy.
 * IMPORTANT: never call `.value()` at module scope — only INSIDE a handler. The CLI loads & inspects
 *   this module before parameter values are resolved, so a global `.value()` breaks deploys.
 */

/** MSG91 account auth key. SERVER-ONLY secret (kept for account-level APIs, e.g. verifyAccessToken). */
export const MSG91_AUTH_KEY = defineString('MSG91_AUTH_KEY');

/** Fallback APP widget id — identifies which widget configuration sends the OTP. */
export const MSG91_WIDGET_ID = defineString('MSG91_WIDGET_ID', { default: '' });

/** Fallback APP widget token auth — authenticates the widget REST calls. SERVER-ONLY secret. */
export const MSG91_TOKEN_AUTH = defineString('MSG91_TOKEN_AUTH', { default: '' });

/**
 * Fallback WEBSITE widget. The customer app and the website use SEPARATE MSG91 widgets (they have
 * different widget ids), so one credential cannot serve both surfaces. The website sends
 * `source: 'web'` on the callable; blank falls back to the app widget in `resolveWidgetCredentials`.
 */
export const MSG91_WIDGET_ID_WEB = defineString('MSG91_WIDGET_ID_WEB', { default: '' });

/**
 * Fallback token-auth for the website widget. MSG91 often shares one account-level token across
 * widgets, so blank falls back to the app widget's token.
 */
export const MSG91_TOKEN_AUTH_WEB = defineString('MSG91_TOKEN_AUTH_WEB', { default: '' });

/**
 * Fallback Google Play reviewer sign-in. Reviewers cannot receive an SMS, and Play requires reusable
 * sign-in details that never expire — so ONE configured test number skips MSG91 and accepts a fixed
 * 6-digit code. Blank (or a malformed pair) turns the bypass off.
 */
export const REVIEW_LOGIN_PHONE = defineString('REVIEW_LOGIN_PHONE', { default: '' });
export const REVIEW_LOGIN_OTP = defineString('REVIEW_LOGIN_OTP', { default: '' });

/**
 * `general/msg91` — the admin-only document the Settings › OTP tab writes. A sibling of
 * `general/secrets`, not a map inside it: the admin form reads its widget ids back, and reading
 * `general/secrets` would pull the Razorpay secrets into the browser along with them.
 */
export const MSG91_CONFIG_DOC = 'msg91';

/** Which surface a sign-in came from — decides which MSG91 widget sends the OTP. */
export type OtpSource = 'app' | 'web';

/**
 * Narrow the client-supplied source. Anything that is not exactly 'web' is treated as 'app'.
 *
 * WHY 'app' is the fallback and not an error: the DEPLOYED Flutter app sends no `source` field at all,
 * so treating "absent" as 'app' is what keeps every existing install signing in. Only the website,
 * which we are writing now, sends 'web'.
 */
export function normalizeOtpSource(source: unknown): OtpSource {
  return source === 'web' ? 'web' : 'app';
}

/** MSG91 OTP Widget API base — public, not a secret, so a plain const (not a param). */
export const MSG91_WIDGET_BASE_URL = 'https://control.msg91.com/api/v5/widget';

/**
 * Where a pending OTP request's `reqId` is parked between send and verify/retry.
 *
 * WHY server-side (not returned to the client): the widget flow's verify/retry calls need the
 * `reqId` issued by sendOtp. Caching it here keeps the callable contract unchanged
 * ({phone, countryCode, otp}) and stops a client from tampering with the request id.
 * Admin SDK bypasses security rules; clients never read this collection.
 */
export const OTP_REQUESTS_COLLECTION = 'otpRequests';

/** A pending OTP request is only good for this long. */
export const OTP_REQUEST_TTL_MS = 15 * 60 * 1000;

/** Only Indian (+91) numbers are supported by the storefront sign-in. */
export const ALLOWED_COUNTRY_CODE = '+91';
