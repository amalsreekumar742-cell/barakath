'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebaseConfig';
// `signedOut` comes from the root store's public surface, not the auth feature directly — the store
// re-exports it precisely so this composition-root hook needs no cross-feature import or suppression.
import { useAppDispatch, signedOut } from '@/stores/store';
import { toastError, toastSuccess } from '@/lib/toast';

/**
 * useLogout — the ONE sign-out path for the whole website (spec 3.23), imported by the header's
 * account menu and anywhere else that ends a session.
 *
 * WHY a shared hook rather than each caller wiring its own sign-out: signing out is three steps that
 * must ALL happen and happen in this order, and a caller that forgets one leaves the user in a broken
 * half-signed-out state. Centralising it means the sequence is written once and can't drift.
 *
 * The order, and why it matters:
 *  1. DELETE /api/session — clears the httpOnly `barakath_session` cookie the Edge middleware reads.
 *     Done FIRST: the Web SDK keeps its own session in IndexedDB the middleware cannot see, so the
 *     cookie is the only thing that would otherwise keep waving a signed-out visitor through /account.
 *     (Route owned by W3; this only calls it.)
 *  2. auth.signOut() — tears down the Firebase client session so onAuthStateChanged fires signed-out
 *     and the live user-doc listener detaches.
 *  3. dispatch(signedOut()) — wipes every per-user slice synchronously (the root reducer resets all of
 *     them) so no previous customer's orders/wallet flash before the auth listener catches up. Belt and
 *     braces alongside step 2, and it also clears state instantly for a snappy UI.
 * Then a success toast and a push to home.
 *
 * WHY try/catch around the network+SDK calls: a failed cookie clear or signOut must not leave the app
 * wedged with no feedback — the customer sees an error toast and can retry, rather than a dead button.
 */
export function useLogout() {
  const dispatch = useAppDispatch();
  const router = useRouter();

  const logout = useCallback(async () => {
    try {
      // Clear the httpOnly session cookie first (see step 1 above). credentials:'same-origin' so the
      // cookie is actually sent/cleared; the route lives on this same origin.
      await fetch('/api/session', { method: 'DELETE', credentials: 'same-origin' });
      await signOut(auth);
      dispatch(signedOut());
      toastSuccess('Signed out');
      router.push('/');
    } catch (error) {
      toastError(error, 'Could not sign you out. Please try again.');
    }
  }, [dispatch, router]);

  return logout;
}
