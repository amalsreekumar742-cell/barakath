import { timingSafeEqual } from 'node:crypto';
import { logger } from 'firebase-functions';
import { HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { Collections } from '../config/collections';
import {
  MSG91_CONFIG_DOC,
  MSG91_TOKEN_AUTH,
  MSG91_TOKEN_AUTH_WEB,
  MSG91_WIDGET_ID,
  MSG91_WIDGET_ID_WEB,
  REVIEW_LOGIN_OTP,
  REVIEW_LOGIN_PHONE,
  type OtpSource,
} from './constants';

/**
 * otpConfig — the MSG91 widget credentials + Play reviewer login one OTP call runs with, shared by
 * authOTP / verifyOTP / resendOTP. Mirrors packages/shared `Msg91Settings` (functions can't import the
 * workspace package at runtime, so the shape is duplicated here). Keep the two in lockstep.
 */
export interface OtpConfig {
  appWidgetId: string;
  appTokenAuth: string;
  webWidgetId: string;
  webTokenAuth: string;
  reviewLoginPhone: string;
  reviewLoginOtp: string;
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/**
 * Load the OTP settings for this call. MUST be called INSIDE a handler — the fallback reads params.
 *
 * The admin-written `general/msg91` doc wins once it holds an app widget pair; until then (fresh
 * project, or before an admin has saved Settings › OTP) the functions/.env params are used.
 *
 * WHY all-or-nothing (not field by field): a per-field fallback would let a value the admin cleared on
 * purpose — the reviewer bypass, a retired web widget — silently come back from .env. Once the admin
 * owns the settings, .env is ignored entirely. The admin form refuses to save without the app pair, so
 * a saved doc always qualifies.
 */
export async function getOtpConfig(): Promise<OtpConfig> {
  const snap = await getFirestore().collection(Collections.general).doc(MSG91_CONFIG_DOC).get();
  const d = (snap.data() ?? {}) as Record<string, unknown>;
  if (str(d.appWidgetId) && str(d.appTokenAuth)) {
    return {
      appWidgetId: str(d.appWidgetId),
      appTokenAuth: str(d.appTokenAuth),
      webWidgetId: str(d.webWidgetId),
      webTokenAuth: str(d.webTokenAuth),
      reviewLoginPhone: str(d.reviewLoginPhone),
      reviewLoginOtp: str(d.reviewLoginOtp),
    };
  }
  return {
    appWidgetId: MSG91_WIDGET_ID.value().trim(),
    appTokenAuth: MSG91_TOKEN_AUTH.value().trim(),
    webWidgetId: MSG91_WIDGET_ID_WEB.value().trim(),
    webTokenAuth: MSG91_TOKEN_AUTH_WEB.value().trim(),
    reviewLoginPhone: REVIEW_LOGIN_PHONE.value().trim(),
    reviewLoginOtp: REVIEW_LOGIN_OTP.value().trim(),
  };
}

/**
 * Resolve the widget credentials for a source.
 *
 * The web widget falls back to the app credentials FIELD BY FIELD, so a half-configured web widget
 * (id set, token left blank because the account shares one) still resolves to a working pair.
 *
 * Throws `failed-precondition` when no pair is configured anywhere — MSG91 would only reject the call
 * with an opaque error, and the log line here says what to fix.
 */
export function resolveWidgetCredentials(
  config: OtpConfig,
  source: OtpSource,
): { widgetId: string; tokenAuth: string } {
  const pair =
    source === 'web'
      ? {
          widgetId: config.webWidgetId || config.appWidgetId,
          tokenAuth: config.webTokenAuth || config.appTokenAuth,
        }
      : { widgetId: config.appWidgetId, tokenAuth: config.appTokenAuth };
  if (!pair.widgetId || !pair.tokenAuth) {
    logger.error(`MSG91 is not configured (${source}) — set it in admin Settings › OTP`);
    throw new HttpsError('failed-precondition', 'Mobile sign-in is unavailable right now. Please try again later.');
  }
  return pair;
}

/** True only for the configured reviewer number (10-digit local form) with a valid 6-digit code. */
export function isReviewLogin(config: OtpConfig, localPhone: string): boolean {
  return (
    /^\d{10}$/.test(config.reviewLoginPhone) &&
    /^\d{6}$/.test(config.reviewLoginOtp) &&
    config.reviewLoginPhone === localPhone
  );
}

/** Compare `otp` to the reviewer's fixed code in constant time (skill: timing-safe compare for static secrets). */
export function isReviewOtp(config: OtpConfig, otp: string): boolean {
  const given = Buffer.from(otp);
  const expected = Buffer.from(config.reviewLoginOtp);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
