import { defineString } from 'firebase-functions/params';

/**
 * MSG91 OTP Widget credentials for the phone-auth flow (spec §5.2 #1 authOTP).
 *
 * WHY the WIDGET flow (not the template /otp API): the widget flow authenticates with a
 *   widgetId + tokenAuth pair and needs no approved template_id. We drive its REST endpoints
 *   from the server, so the credentials never ship to a client — same security posture as before.
 * WHY defineString (not process.env): the Firebase CLI resolves these at deploy time and REFUSES to
 *   deploy when a value is missing, so an unconfigured OTP key fails in front of a developer instead of
 *   at 2am as a 500 on a live sign-in. process.env silently yields undefined and ships broken.
 * IMPORTANT: never call `.value()` at module scope — only INSIDE a handler. The CLI loads & inspects
 *   this module before parameter values are resolved, so a global `.value()` breaks deploys.
 */

/** MSG91 account auth key. SERVER-ONLY secret (kept for account-level APIs, e.g. verifyAccessToken). */
export const MSG91_AUTH_KEY = defineString('MSG91_AUTH_KEY');

/** MSG91 OTP Widget id — identifies which widget configuration sends the OTP. This is the APP widget. */
export const MSG91_WIDGET_ID = defineString('MSG91_WIDGET_ID');

/** MSG91 widget token auth — authenticates the widget REST calls. SERVER-ONLY secret. */
export const MSG91_TOKEN_AUTH = defineString('MSG91_TOKEN_AUTH');

/**
 * MSG91 widget for the WEBSITE. The customer app and the website use SEPARATE MSG91 widgets (they have
 * different widget ids), so one credential cannot serve both surfaces. The website sends `source: 'web'`
 * on the callable and the handler resolves THIS widget; the app sends nothing and keeps the widget above.
 *
 * WHY a default of '' when the app widget has none: an empty default keeps deploys working before the
 * web widget is provisioned — an unset web id simply falls back to the app widget in
 * `resolveWidgetCredentials`, so nothing breaks. The app widget stays REQUIRED, so app sign-in can
 * never silently lose its credential. Fill `MSG91_WIDGET_ID_WEB` in functions/.env before web launch.
 */
export const MSG91_WIDGET_ID_WEB = defineString('MSG91_WIDGET_ID_WEB', { default: '' });

/**
 * Token-auth for the website widget. Optional: MSG91 often shares one account-level token across
 * widgets, so an unset value falls back to `MSG91_TOKEN_AUTH`. Set it only if the web widget's
 * "Add to your site" snippet shows a DIFFERENT tokenAuth from the app widget's.
 */
export const MSG91_TOKEN_AUTH_WEB = defineString('MSG91_TOKEN_AUTH_WEB', { default: '' });

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

/**
 * Resolve the widget credentials for a source. MUST be called INSIDE a handler — it reads param
 * values, and reading them at module scope breaks deploys.
 *
 * The web widget falls back to the app credentials FIELD BY FIELD, so a half-configured web widget
 * (id set, token left blank because the account shares one) still resolves to a working pair.
 */
export function resolveWidgetCredentials(source: OtpSource): { widgetId: string; tokenAuth: string } {
  const appWidgetId = MSG91_WIDGET_ID.value();
  const appTokenAuth = MSG91_TOKEN_AUTH.value();
  if (source === 'web') {
    const webId = MSG91_WIDGET_ID_WEB.value().trim();
    const webToken = MSG91_TOKEN_AUTH_WEB.value().trim();
    return { widgetId: webId || appWidgetId, tokenAuth: webToken || appTokenAuth };
  }
  return { widgetId: appWidgetId, tokenAuth: appTokenAuth };
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
