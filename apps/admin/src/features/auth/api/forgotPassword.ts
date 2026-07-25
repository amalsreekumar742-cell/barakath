import { createAsyncThunk } from '@reduxjs/toolkit';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebaseConfig';

/**
 * forgotPassword — send a Firebase password-reset email (spec §1.1).
 *
 * WHY a thunk (not a direct call in the component): keeps the Firebase Auth call out of the UI and
 * gives the slice an explicit pending/fulfilled/rejected lifecycle for the button loading + toast.
 * WHY we don't reveal whether the email exists: returning the same success message regardless avoids
 * leaking which emails are registered admins (account-enumeration hardening). Firebase also does not
 * error for an unknown address by default.
 */
export const forgotPassword = createAsyncThunk<string, { email: string }, { rejectValue: string }>(
  'auth/forgotPassword',
  async ({ email }, { rejectWithValue }) => {
    try {
      await sendPasswordResetEmail(auth, email.trim());
      return 'Reset link sent to your email';
    } catch (err) {
      const code = (err as { code?: string })?.code ?? '';
      if (code === 'auth/invalid-email') {
        return rejectWithValue('Please enter a valid email address');
      }
      return rejectWithValue(
        err instanceof Error ? err.message : 'Could not send reset link. Please try again',
      );
    }
  },
);
