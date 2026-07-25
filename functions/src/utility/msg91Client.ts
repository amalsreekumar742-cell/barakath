import { MSG91_WIDGET_BASE_URL } from './constants';

/**
 * msg91Client — thin wrappers over the MSG91 **OTP Widget** REST API, shared by
 * authOTP / verifyOTP / resendOTP.
 *
 * WHY the widget endpoints: this account uses the OTP Widget (widgetId + tokenAuth) rather than an
 *   approved SMS template, so there is no `template_id`. The widget is normally embedded in a client,
 *   but its REST endpoints work fine server-to-server — which is what we do, so the credentials never
 *   leave the backend.
 * WHY a helper (not inline in each handler): the three OTP handlers all speak to the same API with the
 *   same credential pair; centralising the fetch calls keeps the endpoint shapes in one place. This is
 *   NOT a deployed function — it is not exported from index.ts, it is called by the handlers.
 * WHY fetch (not a package): a few plain HTTP calls; Node 20's global fetch is enough and avoids a
 *   dependency (skill: don't add a package for what stdlib already does).
 *
 * NOTE: credential values are passed IN from the handler — the caller resolves the params inside the
 * handler (never at module scope), and this helper never touches params directly.
 *
 * Flow: sendOtp -> reqId ; verifyOtp(reqId, otp) -> access-token ; retryOtp(reqId, channel).
 * MSG91 answers `{ type: 'success' | 'error', message: <payload-or-reason> }`.
 */

export interface Msg91WidgetResponse {
  type?: string;
  message?: string;
  /** Some MSG91 responses nest the payload — read defensively. */
  data?: unknown;
  request_id?: string;
  /** Gateway-level failures answer HTTP 200 with these instead of `type`. */
  hasError?: boolean;
  status?: string;
  errors?: unknown;
  code?: number;
}

/** MSG91 retry channel codes (from the official SDKs). */
export const RETRY_CHANNELS = {
  email: 3,
  voice: 4,
  sms: 11,
  whatsapp: 12,
} as const;

/**
 * GET with query params. `sendOtpMobile` ONLY accepts GET: control.msg91.com 302-redirects it to
 * otpwidget.msg91.com, and that route rejects POST ("The POST method is not supported").
 */
async function getWidget(path: string, params: Record<string, string>): Promise<Msg91WidgetResponse> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${MSG91_WIDGET_BASE_URL}/${path}?${qs}`, { method: 'GET' });
  return (await res.json()) as Msg91WidgetResponse;
}

/** POST + JSON body. `verifyOtp` and `retryOtp` only accept POST. */
async function postWidget(path: string, body: Record<string, unknown>): Promise<Msg91WidgetResponse> {
  const res = await fetch(`${MSG91_WIDGET_BASE_URL}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return (await res.json()) as Msg91WidgetResponse;
}

/**
 * True only on an explicit success.
 *
 * WHY strict: MSG91 answers HTTP 200 for failures too — either `{type:'error',...}` or, for
 * gateway-level rejections, `{errors, hasError:true, status:'fail'}` with NO `type` at all.
 * Treating a missing `type` as success would silently swallow those.
 */
export function isSuccess(result: Msg91WidgetResponse): boolean {
  if (result.hasError === true || result.status === 'fail') return false;
  return result.type === 'success';
}

/**
 * Pull the payload MSG91 returns in `message` (the reqId for send, the access-token for verify).
 * Falls back across the shapes MSG91 has been seen to use.
 */
export function payloadOf(result: Msg91WidgetResponse): string {
  if (typeof result.message === 'string' && result.message) return result.message;
  if (typeof result.request_id === 'string' && result.request_id) return result.request_id;
  if (typeof result.data === 'string' && result.data) return result.data;
  return '';
}

/**
 * Send a fresh OTP to `identifier` (country code + number, no '+'). On success `message` carries the
 * **reqId** needed by verify/retry.
 *
 * WHY the route depends on the widget: MSG91 configures each widget as either a "mobile" or a "web"
 * widget and REJECTS the other route. Verified live against both Barakath widgets:
 *   • APP widget  → `GET /sendOtpMobile`. The web `/sendOtp` route answers "Web requests are not
 *     allowed for this widget."
 *   • WEB widget  → `POST /sendOtp`. The `/sendOtpMobile` route answers "Mobile requests are not
 *     allowed for this widget."
 * So the caller passes which surface this send is for, and the route is chosen accordingly. Only the
 * SEND differs — verifyOtp and retryOtp are POST on both widgets.
 */
export async function sendOtp(
  widgetId: string,
  tokenAuth: string,
  identifier: string,
  source: 'app' | 'web' = 'app',
): Promise<Msg91WidgetResponse> {
  return source === 'web'
    ? postWidget('sendOtp', { widgetId, tokenAuth, identifier })
    : getWidget('sendOtpMobile', { widgetId, tokenAuth, identifier });
}

/**
 * POST /verifyOtp — verify the code the user entered against the pending request.
 * On success `message` carries the **access-token** proving the number was verified.
 */
export async function verifyOtp(
  widgetId: string,
  tokenAuth: string,
  reqId: string,
  otp: string,
): Promise<Msg91WidgetResponse> {
  return postWidget('verifyOtp', { widgetId, tokenAuth, reqId, otp });
}

/** POST /retryOtp — resend the OTP for a pending request over the given channel. */
export async function resendOtp(
  widgetId: string,
  tokenAuth: string,
  reqId: string,
  retryChannel: number,
): Promise<Msg91WidgetResponse> {
  return postWidget('retryOtp', { widgetId, tokenAuth, reqId, retryChannel });
}

/**
 * normalizePhone — validate a 10-digit Indian number + a '+91' country code and return both forms.
 * Returns null when the input is not a valid +91 10-digit number (handler maps null → invalid-argument).
 */
export function normalizePhone(
  phone: unknown,
  countryCode: unknown,
): { local: string; e164: string; digits: string } | null {
  if (typeof phone !== 'string' || typeof countryCode !== 'string') return null;
  const local = phone.trim();
  const cc = countryCode.trim();
  if (cc !== '+91') return null;
  if (!/^\d{10}$/.test(local)) return null;
  return { local, e164: `+91${local}`, digits: `91${local}` };
}
