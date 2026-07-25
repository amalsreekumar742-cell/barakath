'use client';

import { useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signInWithCustomToken } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { FirestoreCollections, keywordsBuilder } from '@barakath/shared';

import { auth, db, functions } from '@/lib/firebaseConfig';
import { Constants } from '@/config/constants';
import { CloudFunctions } from '@/config/cloudFunctions';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import {
  setAuthError,
  setOtpPhone,
  setOtpStep,
  setResendAt,
  setSubmitting,
} from '@/features/auth/stores/authSlice';
import { postSession } from '@/features/auth/utils/session';
import { sanitizeNext } from '@/features/auth/utils/redirect';
import type { ProfileForm } from '@/features/auth/types/schemas';

/**
 * Shapes returned by the three MSG91 callables (verified live — see WEB_BATCH1_NOTES §9).
 * `verified: false` is a normal 200 (wrong code), NOT an error — the flow shows it inline.
 */
interface OtpSendResult {
  success?: boolean;
  message?: string;
}
interface OtpVerifyResult {
  verified?: boolean;
  customToken?: string;
  isNewUser?: boolean;
}

/**
 * useAuthFlow — the single place the login screen talks to Firebase. It wraps the three OTP
 * callables, the custom-token sign-in, the session-cookie POST and the profile merge, driving
 * `submitting` / `error` / `otpStep` through the existing auth slice.
 *
 * WHY a hook rather than thunks: this flow is a sequence of imperative side effects with UI branches
 * (wrong code → inline, new user → profile step, else → redirect) and a router navigation — not a
 * data read. The web skill reserves `createAsyncThunk` for Firestore reads; an OTP handshake that
 * signs in and redirects is orchestration, which belongs in a hook the component calls.
 */
export function useAuthFlow() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const searchParams = useSearchParams();

  const { otpStep, otpPhone, resendAt, submitting, error } = useAppSelector((s) => s.auth);

  const redirectAfterAuth = useCallback(() => {
    const target = sanitizeNext(searchParams.get('next'));
    // replace() so the login page isn't left in history — Back from /account shouldn't return here.
    router.replace(target);
  }, [router, searchParams]);

  /** Step 1 — send the OTP. `source: 'web'` selects the website's MSG91 widget (load-bearing). */
  const sendOtp = useCallback(
    async (phone: string) => {
      dispatch(setSubmitting(true));
      dispatch(setAuthError(null));
      try {
        const call = httpsCallable<Record<string, unknown>, OtpSendResult>(
          functions,
          CloudFunctions.authOTP,
        );
        const { data } = await call({
          phone,
          countryCode: Constants.DEFAULT_COUNTRY_CODE,
          source: CloudFunctions.OTP_SOURCE,
        });
        if (data?.success === false) {
          dispatch(setAuthError(data.message ?? 'Could not send the code. Please try again.'));
          return;
        }
        dispatch(setOtpPhone(phone));
        dispatch(setResendAt(Date.now() + Constants.OTP_RESEND_SECONDS * 1000));
        dispatch(setOtpStep('otp'));
      } catch (e) {
        dispatch(setAuthError(messageOf(e, 'Could not send the code. Please try again.')));
      } finally {
        dispatch(setSubmitting(false));
      }
    },
    [dispatch],
  );

  /** Step 2 — verify the code, sign in, sync the cookie, branch to profile or redirect. */
  const verifyOtp = useCallback(
    async (otp: string) => {
      dispatch(setSubmitting(true));
      dispatch(setAuthError(null));
      try {
        const call = httpsCallable<Record<string, unknown>, OtpVerifyResult>(
          functions,
          CloudFunctions.verifyOTP,
        );
        const { data } = await call({
          phone: otpPhone,
          countryCode: Constants.DEFAULT_COUNTRY_CODE,
          otp,
        });

        // Wrong code: a normal response, shown inline. Do NOT throw and do NOT clear the phone.
        if (data?.verified !== true || !data.customToken) {
          dispatch(setAuthError('That code is incorrect. Please check and try again.'));
          return;
        }

        const cred = await signInWithCustomToken(auth, data.customToken);
        // Set the cookie BEFORE navigating: the middleware reads it on the very next request, and a
        // redirect that races ahead of the cookie would bounce the fresh session back to /login.
        const idToken = await cred.user.getIdToken();
        await postSession(idToken);

        if (data.isNewUser === true) {
          dispatch(setOtpStep('profile'));
        } else {
          redirectAfterAuth();
        }
      } catch (e) {
        dispatch(setAuthError(messageOf(e, 'Could not verify the code. Please try again.')));
      } finally {
        dispatch(setSubmitting(false));
      }
    },
    [dispatch, otpPhone, redirectAfterAuth],
  );

  /** Resend the code, gated by the countdown so a customer can't hammer the SMS allowance. */
  const resendOtp = useCallback(async () => {
    if (resendAt !== null && Date.now() < resendAt) return; // still counting down
    dispatch(setSubmitting(true));
    dispatch(setAuthError(null));
    try {
      const call = httpsCallable<Record<string, unknown>, OtpSendResult>(
        functions,
        CloudFunctions.resendOTP,
      );
      const { data } = await call({
        phone: otpPhone,
        countryCode: Constants.DEFAULT_COUNTRY_CODE,
        retryType: 'text',
      });
      if (data?.success === false) {
        dispatch(setAuthError(data.message ?? 'Could not resend the code. Please try again.'));
        return;
      }
      dispatch(setResendAt(Date.now() + Constants.OTP_RESEND_SECONDS * 1000));
    } catch (e) {
      dispatch(setAuthError(messageOf(e, 'Could not resend the code. Please try again.')));
    } finally {
      dispatch(setSubmitting(false));
    }
  }, [dispatch, otpPhone, resendAt]);

  /**
   * Step 3 — merge the profile fields into the existing `users/{uid}` doc.
   * WHY updateDoc and not setDoc: verifyOTP already created the doc, and `firestore.rules` forbids a
   * client create/delete — an update is the only permitted (and narrower) operation. Only the
   * rule-whitelisted keys are written, so `onlyOwnProfileFields` passes.
   */
  const saveProfile = useCallback(
    async (form: ProfileForm) => {
      const uid = auth.currentUser?.uid;
      if (!uid) {
        dispatch(setAuthError('You are no longer signed in. Please start again.'));
        return;
      }
      dispatch(setSubmitting(true));
      dispatch(setAuthError(null));
      try {
        const fullName = form.fullName.trim();
        // Rebuild the search index from name + phone so admin search finds this customer, matching
        // the same keyword scheme the shipped app writes.
        const keywords = keywordsBuilder([fullName, otpPhone].filter(Boolean).join(' '));
        await updateDoc(doc(db, FirestoreCollections.users, uid), {
          fullName,
          email: form.email?.trim() ?? '',
          whatsapp: form.whatsapp?.trim() ?? '',
          referredBy: form.referredBy?.trim() ?? '',
          keywords,
          updatedAt: serverTimestamp(),
        });
        redirectAfterAuth();
      } catch (e) {
        dispatch(setAuthError(messageOf(e, 'Could not save your profile. Please try again.')));
      } finally {
        dispatch(setSubmitting(false));
      }
    },
    [dispatch, otpPhone, redirectAfterAuth],
  );

  /** "Skip for now" — the doc already exists with empty fields, so just proceed. */
  const skipProfile = useCallback(() => {
    redirectAfterAuth();
  }, [redirectAfterAuth]);

  /** Back-arrow from the OTP step to re-enter the number. */
  const changeNumber = useCallback(() => {
    dispatch(setOtpStep('phone'));
    dispatch(setResendAt(null));
  }, [dispatch]);

  return {
    otpStep,
    otpPhone,
    resendAt,
    submitting,
    error,
    sendOtp,
    verifyOtp,
    resendOtp,
    saveProfile,
    skipProfile,
    changeNumber,
  };
}

/**
 * Pull a customer-safe message from a caught error.
 * WHY suppress anything with a URL: a raw Firebase/Functions error can embed a console link or a
 * stack, which is developer noise a customer must never see — fall back to the friendly default.
 */
function messageOf(error: unknown, fallback: string): string {
  const raw =
    typeof error === 'string'
      ? error
      : typeof (error as { message?: unknown })?.message === 'string'
        ? (error as { message: string }).message
        : '';
  const trimmed = raw.trim();
  if (!trimmed || /https?:\/\//i.test(trimmed)) return fallback;
  return trimmed;
}
