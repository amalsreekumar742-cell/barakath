import { createAsyncThunk } from '@reduxjs/toolkit';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebaseConfig';

/**
 * resetSubAdminPassword — send a Firebase password-reset email to a sub-admin (spec §1.20: password can
 * be changed after creation). WHY the built-in reset email (not a client-set password): the admin should
 * never see or set another user's password, and `sendPasswordResetEmail` is a safe, unprivileged flow —
 * Firebase mails a secure link and the sub-admin sets their own new password.
 *
 * WHY it takes the email (not a uid): the reset email is addressed by email, which is the sub-admin's
 * immutable login identity. Returns the email so the component can toast "sent to <email>".
 */
export const resetSubAdminPassword = createAsyncThunk<string, string, { rejectValue: string }>(
  'subAdmin/resetPassword',
  async (email, { rejectWithValue }) => {
    try {
      await sendPasswordResetEmail(auth, email);
      return email;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Could not send reset email');
    }
  },
);
