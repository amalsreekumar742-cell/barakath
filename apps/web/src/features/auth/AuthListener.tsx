'use client';

import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { FirestoreCollections, type UserProps } from '@barakath/shared';

import { auth, db } from '@/lib/firebaseConfig';
import { useAppDispatch } from '@/stores/store';
import { setAuthResolved, setUser } from '@/features/auth/stores/authSlice';
import { clearSession, postSession } from '@/features/auth/utils/session';

/**
 * AuthListener — the single subscription that turns Firebase auth state into Redux state, keeps the
 * signed-in customer's `users/{uid}` document live, and holds the Edge session cookie in sync.
 *
 * WHY a mounted component and not a thunk: `onAuthStateChanged` / `onSnapshot` are long-lived
 * subscriptions with a lifecycle (subscribe on mount, tear down on unmount / uid change), which is
 * exactly what a `createAsyncThunk` (resolves once) cannot model — the web skill is explicit that a
 * listener belongs in a hook/component that owns its cleanup, not a thunk.
 *
 * WHY it renders nothing and sits high in the tree (mounted in providers.tsx): the user doc must be
 * subscribed ONCE, right after auth resolves, so every feature reads the live user from Redux
 * instead of re-fetching it. Placing it in the app-wide provider layer guarantees that single mount.
 */
export function AuthListener(): null {
  const dispatch = useAppDispatch();

  useEffect(() => {
    // Holds the current user-doc subscription so a new auth event (or unmount) can tear it down
    // before starting the next — otherwise a sign-out-then-in would leak the previous listener.
    let unsubDoc: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (fbUser) => {
      unsubDoc?.();
      unsubDoc = null;

      if (!fbUser) {
        // Signed out (cold guest load, sign-out button, or another tab). Mark auth resolved so the
        // header stops showing a loading state, and clear the cookie so the middleware agrees the
        // visitor is a guest. The full multi-slice wipe on an explicit logout is W2's concern.
        dispatch(setAuthResolved({ uid: null }));
        void clearSession();
        return;
      }

      // Signed in. Resolve auth immediately (uid is known) so guards can proceed, then refresh the
      // cookie from a fresh ID token so a session restored from IndexedDB on a cold load re-arms the
      // middleware cookie (which may have expired independently of the SDK session).
      dispatch(setAuthResolved({ uid: fbUser.uid }));
      try {
        const idToken = await fbUser.getIdToken();
        await postSession(idToken);
      } catch {
        // A cookie-refresh failure must not drop the user to signed-out — the SDK session is intact
        // and Firestore rules remain the real gate. The cookie re-syncs on the next auth event.
      }

      // Live subscription to the customer's own document: an admin credit, a status change or a
      // profile edit from another device lands in Redux without a manual refetch.
      unsubDoc = onSnapshot(
        doc(db, FirestoreCollections.users, fbUser.uid),
        (snap) => {
          dispatch(
            setUser(snap.exists() ? ({ ...snap.data(), id: snap.id } as UserProps) : null),
          );
        },
        () => {
          // A doc read error must not sign the user out — keep them authenticated and let the next
          // snapshot recover. Routing stays correct because `uid` is already resolved above.
        },
      );
    });

    return () => {
      unsubDoc?.();
      unsubAuth();
    };
  }, [dispatch]);

  return null;
}
