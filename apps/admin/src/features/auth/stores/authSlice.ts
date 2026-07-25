import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { signOut } from 'firebase/auth';
import type { SubAdminProps } from '@barakath/shared/types';
import { auth } from '@/lib/firebaseConfig';
import { loginAdmin } from '../api/loginAdmin';
import { forgotPassword } from '../api/forgotPassword';

/**
 * authSlice — owns the login / forgot-password / logout flow state.
 *
 * WHY explicit named state (loading/error rather than inferring from `admin == null`): per the skill,
 * every fetchable slice exposes loading|error|data as explicit fields so the UI renders the right
 * state deterministically (a null admin during an in-flight login is "loading", not "failed").
 */
interface AuthState {
  admin: SubAdminProps | null;
  loading: boolean;
  error: string | null;
  forgotPasswordSuccess: boolean;
}

const initialState: AuthState = {
  admin: null,
  loading: false,
  error: null,
  forgotPasswordSuccess: false,
};

/**
 * logout — sign out of Firebase Auth and clear local auth state.
 *
 * WHY a thunk: signOut is async; wrapping it lets the reducer clear `admin` in the fulfilled handler
 * after the session is actually torn down. The currentAdmin listener (useCurrentAdmin) also detaches
 * because auth.currentUser becomes null.
 */
export const logout = createAsyncThunk('auth/logout', async () => {
  await signOut(auth);
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // Clears any surfaced error (e.g. when the user edits the form to retry).
    clearAuthError(state) {
      state.error = null;
    },
    // Resets the forgot-password success flag (e.g. on leaving the page).
    resetForgotPassword(state) {
      state.forgotPasswordSuccess = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // --- login ---
      .addCase(loginAdmin.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginAdmin.fulfilled, (state, action) => {
        state.loading = false;
        state.admin = action.payload;
      })
      .addCase(loginAdmin.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Login failed';
      })
      // --- forgot password ---
      .addCase(forgotPassword.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.forgotPasswordSuccess = false;
      })
      .addCase(forgotPassword.fulfilled, (state) => {
        state.loading = false;
        state.forgotPasswordSuccess = true;
      })
      .addCase(forgotPassword.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Could not send reset link';
      })
      // --- logout ---
      .addCase(logout.fulfilled, (state) => {
        state.admin = null;
        state.error = null;
        state.forgotPasswordSuccess = false;
      });
  },
});

export const { clearAuthError, resetForgotPassword } = authSlice.actions;
export default authSlice.reducer;
