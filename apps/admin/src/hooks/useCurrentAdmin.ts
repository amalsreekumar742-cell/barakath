import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import { SubAdminStatus } from '@barakath/shared/config/enums';
import type { SubAdminProps } from '@barakath/shared/types';
import { auth, db } from '@/lib/firebaseConfig';
import { useAppDispatch } from '@/stores/store';
import {
  setCurrentAdmin,
  setAuthResolved,
  clearCurrentAdmin,
} from '@/stores/currentAdminSlice';
import { logout } from '@/features/auth/stores/authSlice';

/**
 * useCurrentAdmin — mounts ONCE at the app root and keeps the signed-in admin's document live.
 *
 * WHY a hook, not a thunk (per the skill): onSnapshot is a long-lived subscription with a lifecycle;
 * createAsyncThunk resolves once. This hook owns subscribe/cleanup and just dispatches a plain slice
 * action on each update.
 *
 * WHY nest an auth listener + a doc listener: the uid isn't known until auth resolves, and it changes
 * on login/logout. onAuthStateChanged drives the outer lifecycle; for each uid we (re)subscribe to
 * `subAdmins/{uid}` and tear the previous one down. `setAuthResolved(true)` lets the RouteGuard stop
 * showing its checking-skeleton.
 *
 * WHY force logout on suspended: an admin suspended from another session must lose access in real
 * time, not just at next login — the live doc detects it here and signs them out with a toast
 * (spec §1.1, §1.20).
 */
export function useCurrentAdmin() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    let unsubDoc: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      // Tear down any previous doc subscription before wiring the new uid.
      unsubDoc?.();
      unsubDoc = null;

      if (!user) {
        dispatch(clearCurrentAdmin());
        dispatch(setAuthResolved(true));
        return;
      }

      // A user just appeared (fresh login or restored session) but their admin doc hasn't loaded yet.
      // WHY re-mark unresolved: otherwise the RouteGuard would see `currentUser` set + `admin` still
      // null and bounce to /login in the gap before the first snapshot. Flipping this false makes the
      // guard show its skeleton until the doc resolves below.
      dispatch(setAuthResolved(false));

      // Force-refresh the ID token so newly-granted custom claims (e.g. `admin: true`, which Storage
      // rules require for uploads) are picked up WITHOUT a manual re-login. A restored session may hold
      // a token minted before the claim was set; getIdToken(true) fetches a fresh one from Firebase.
      void user.getIdToken(true).catch(() => {});

      unsubDoc = onSnapshot(
        doc(db, FirestoreCollections.subAdmins, user.uid),
        (snap) => {
          if (!snap.exists()) {
            dispatch(setCurrentAdmin(null));
            dispatch(setAuthResolved(true));
            return;
          }

          const admin = { ...snap.data(), id: snap.id } as SubAdminProps;

          if (admin.status === SubAdminStatus.SUSPENDED) {
            // Real-time suspension: drop the session and inform the admin.
            toast.error('Your account has been suspended');
            void dispatch(logout());
            dispatch(clearCurrentAdmin());
            dispatch(setAuthResolved(true));
            return;
          }

          dispatch(setCurrentAdmin(admin));
          dispatch(setAuthResolved(true));
        },
        () => {
          // A listener error (e.g. rules denial) is treated as "no admin loaded".
          dispatch(setCurrentAdmin(null));
          dispatch(setAuthResolved(true));
        },
      );
    });

    return () => {
      unsubDoc?.();
      unsubAuth();
    };
  }, [dispatch]);
}
