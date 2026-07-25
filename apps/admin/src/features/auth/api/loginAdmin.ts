import { createAsyncThunk } from '@reduxjs/toolkit';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import { SubAdminStatus } from '@barakath/shared/config/enums';
import type { SubAdminProps } from '@barakath/shared/types';
import { auth, db } from '@/lib/firebaseConfig';

interface LoginArgs {
  email: string;
  password: string;
}

/**
 * loginAdmin — authenticate an admin and load their subAdmins profile.
 *
 * WHAT: signs in with Firebase Auth, then reads the matching `subAdmins/{uid}` document and returns
 * it as a typed SubAdminProps. A suspended admin is signed back out and rejected.
 *
 * WHY the profile read lives here (in the thunk): per the skill's "Firestore-reads-in-thunks" rule,
 * the admin identity/role/permissions come from Firestore, not just the auth token — so the login
 * flow that owns this state also owns the read. WHY sign out on suspended: Security Rules gate data,
 * but blocking a suspended admin at the UI boundary (and dropping their session immediately) gives a
 * clear message and prevents a half-authenticated state lingering in the tab (spec §1.1, §1.20).
 * WHY rejectWithValue(string): the slice stores a serializable error string; a raw exception must
 * never reach the component.
 */
export const loginAdmin = createAsyncThunk<SubAdminProps, LoginArgs, { rejectValue: string }>(
  'auth/loginAdmin',
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);

      const snap = await getDoc(doc(db, FirestoreCollections.subAdmins, cred.user.uid));
      if (!snap.exists()) {
        await signOut(auth);
        return rejectWithValue('No admin profile found for this account');
      }

      const admin = { ...snap.data(), id: snap.id } as SubAdminProps;

      if (admin.status === SubAdminStatus.SUSPENDED) {
        await signOut(auth);
        return rejectWithValue('Your account has been suspended');
      }

      return admin;
    } catch (err) {
      // Convert Firebase's auth errors into a friendly, serializable message.
      const code = (err as { code?: string })?.code ?? '';
      if (
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found'
      ) {
        return rejectWithValue('Invalid email or password');
      }
      if (code === 'auth/too-many-requests') {
        return rejectWithValue('Too many attempts. Please try again later');
      }
      return rejectWithValue(
        err instanceof Error ? err.message : 'Something went wrong. Please try again',
      );
    }
  },
);
