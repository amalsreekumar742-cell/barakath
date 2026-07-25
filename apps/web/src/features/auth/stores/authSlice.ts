import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { UserProps } from '@barakath/shared';

/**
 * Authentication and the signed-in customer's own document.
 *
 * WHY `user` is a serialisable snapshot rather than the Firebase `User` object: Redux state must be
 * serialisable, and the Firebase user carries methods and a live token. W3 keeps the SDK object in
 * a ref/context and mirrors only the fields the UI needs.
 *
 * WHY the OTP step lives in Redux and not local component state: the flow spans a page (phone →
 * OTP → profile), a route handler (the session cookie) and the header (which must stop showing
 * "guest" the instant sign-in lands. Component state cannot reach any of those.
 *
 * WHY `authLoading` starts TRUE: on a cold load nobody knows yet whether a session exists. Starting
 * at false means the header renders "Login", then flips to the customer's name a beat later — the
 * flash of the wrong state that W5 explicitly checks for. It becomes false once the auth listener
 * has reported for the first time, signed in or not.
 *
 * The user document is kept live by an `onSnapshot` hook (per the web skill: a subscription is not
 * a thunk), so an admin credit or a status change lands here without a refetch.
 */
export type OtpStep = 'phone' | 'otp' | 'profile';

export interface AuthState {
  /** The Firestore `users/{uid}` document. Null while signed out or still loading. */
  user: UserProps | null;
  uid: string | null;
  isAuthenticated: boolean;
  /** A visitor with no session. Guests browse the whole catalog (spec 3.3). */
  isGuest: boolean;
  authLoading: boolean;
  otpStep: OtpStep;
  /** E.164, e.g. +919000000001 — what the OTP was sent to. */
  otpPhone: string;
  /** Epoch millis after which "Resend OTP" is allowed again. */
  resendAt: number | null;
  submitting: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  uid: null,
  isAuthenticated: false,
  isGuest: true,
  authLoading: true,
  otpStep: 'phone',
  otpPhone: '',
  resendAt: null,
  submitting: false,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    /** Dispatched by the onSnapshot hook on every change to `users/{uid}`. */
    setUser(state, action: PayloadAction<UserProps | null>) {
      state.user = action.payload;
    },
    /** Dispatched by the auth listener — the single place `authLoading` is cleared. */
    setAuthResolved(state, action: PayloadAction<{ uid: string | null }>) {
      state.uid = action.payload.uid;
      state.isAuthenticated = action.payload.uid !== null;
      state.isGuest = action.payload.uid === null;
      state.authLoading = false;
    },
    setOtpStep(state, action: PayloadAction<OtpStep>) {
      state.otpStep = action.payload;
      state.error = null;
    },
    setOtpPhone(state, action: PayloadAction<string>) {
      state.otpPhone = action.payload;
    },
    setResendAt(state, action: PayloadAction<number | null>) {
      state.resendAt = action.payload;
    },
    setSubmitting(state, action: PayloadAction<boolean>) {
      state.submitting = action.payload;
    },
    setAuthError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
    /** Full reset on sign-out. Every other slice is reset by the root reducer — see store.ts. */
    signedOut() {
      return { ...initialState, authLoading: false };
    },
  },
});

export const {
  setUser,
  setAuthResolved,
  setOtpStep,
  setOtpPhone,
  setResendAt,
  setSubmitting,
  setAuthError,
  signedOut,
} = authSlice.actions;

export default authSlice.reducer;
