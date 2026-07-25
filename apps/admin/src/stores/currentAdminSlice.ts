import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { SubAdminProps } from '@barakath/shared/types';

/**
 * currentAdminSlice — the app-wide, live-synced signed-in admin (spec §1.1, skill "current user doc").
 *
 * WHY app-wide (not inside the auth feature): per the skill, the current user's own document is
 * subscribed to ONCE high in the tree and every feature reads it from Redux instead of re-fetching.
 * The sidebar reads `permissions` from here to hide modules; the top bar reads name/role; the guard
 * reads it to allow access. It is kept live via `useCurrentAdmin` (onSnapshot), so an admin who is
 * suspended or has permissions changed in another tab reflects here in real time.
 *
 * WHY `authResolved`: on first load we can't tell "signed out" from "auth still checking" — the guard
 * must show a skeleton until Firebase reports the initial auth state, then decide. This flips true
 * once onAuthStateChanged fires the first time.
 */
interface CurrentAdminState {
  admin: SubAdminProps | null;
  authResolved: boolean;
}

const initialState: CurrentAdminState = {
  admin: null,
  authResolved: false,
};

const currentAdminSlice = createSlice({
  name: 'currentAdmin',
  initialState,
  reducers: {
    // Written by the onSnapshot listener on each update (null when signed out / doc missing).
    setCurrentAdmin(state, action: PayloadAction<SubAdminProps | null>) {
      state.admin = action.payload;
    },
    // Flipped true once the initial Firebase auth state is known.
    setAuthResolved(state, action: PayloadAction<boolean>) {
      state.authResolved = action.payload;
    },
    // Cleared on sign-out.
    clearCurrentAdmin(state) {
      state.admin = null;
    },
  },
});

export const { setCurrentAdmin, setAuthResolved, clearCurrentAdmin } = currentAdminSlice.actions;
export default currentAdminSlice.reducer;
