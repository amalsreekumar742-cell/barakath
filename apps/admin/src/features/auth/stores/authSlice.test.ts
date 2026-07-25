import { describe, it, expect, vi } from 'vitest';

// Mock the Firebase client so importing the slice (which pulls in the api thunks -> firebaseConfig)
// never initializes a real Firebase app in the test environment. The thunks are not executed here;
// we only exercise the reducer against the actions they would dispatch.
vi.mock('@/lib/firebaseConfig', () => ({ auth: {}, db: {}, storage: {}, functions: {} }));

import authReducer, { clearAuthError, resetForgotPassword } from './authSlice';
import { loginAdmin } from '../api/loginAdmin';
import { forgotPassword } from '../api/forgotPassword';
import { logout } from './authSlice';
import type { SubAdminProps } from '@barakath/shared/types';

const initialState = {
  admin: null,
  loading: false,
  error: null,
  forgotPasswordSuccess: false,
};

const fakeAdmin = { id: 'a1', fullName: 'Aisha Khan', role: 'Super admin' } as SubAdminProps;

describe('authSlice', () => {
  it('returns the initial state', () => {
    expect(authReducer(undefined, { type: '@@INIT' })).toEqual(initialState);
  });

  describe('loginAdmin lifecycle', () => {
    it('pending sets loading and clears error', () => {
      const state = authReducer(
        { ...initialState, error: 'old' },
        { type: loginAdmin.pending.type },
      );
      expect(state.loading).toBe(true);
      expect(state.error).toBeNull();
    });

    it('fulfilled stores the admin and stops loading', () => {
      const state = authReducer(
        { ...initialState, loading: true },
        { type: loginAdmin.fulfilled.type, payload: fakeAdmin },
      );
      expect(state.loading).toBe(false);
      expect(state.admin).toEqual(fakeAdmin);
    });

    it('rejected surfaces the error string and stops loading', () => {
      const state = authReducer(
        { ...initialState, loading: true },
        { type: loginAdmin.rejected.type, payload: 'Your account has been suspended' },
      );
      expect(state.loading).toBe(false);
      expect(state.error).toBe('Your account has been suspended');
    });
  });

  describe('forgotPassword lifecycle', () => {
    it('fulfilled flips the success flag', () => {
      const state = authReducer(
        { ...initialState, loading: true },
        { type: forgotPassword.fulfilled.type },
      );
      expect(state.loading).toBe(false);
      expect(state.forgotPasswordSuccess).toBe(true);
    });

    it('rejected surfaces the error', () => {
      const state = authReducer(
        { ...initialState, loading: true },
        { type: forgotPassword.rejected.type, payload: 'Could not send reset link' },
      );
      expect(state.error).toBe('Could not send reset link');
    });
  });

  describe('sync reducers', () => {
    it('clearAuthError clears the error', () => {
      const state = authReducer({ ...initialState, error: 'boom' }, clearAuthError());
      expect(state.error).toBeNull();
    });

    it('resetForgotPassword resets the flag and error', () => {
      const state = authReducer(
        { ...initialState, forgotPasswordSuccess: true, error: 'x' },
        resetForgotPassword(),
      );
      expect(state.forgotPasswordSuccess).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  it('logout.fulfilled clears the admin', () => {
    const state = authReducer(
      { ...initialState, admin: fakeAdmin },
      { type: logout.fulfilled.type },
    );
    expect(state.admin).toBeNull();
  });
});
