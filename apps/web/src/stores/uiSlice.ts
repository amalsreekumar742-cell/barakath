import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

/**
 * App-wide UI state: which global overlay is open.
 *
 * WHY this is app-wide rather than feature-scoped: the same overlay is opened from several
 * features. The logout dialog is triggered by both the header menu (W1) and the account sidebar
 * (Batch 4); the mega menu is owned by the header but closed by a route change from anywhere. A
 * feature may not import another feature, so the only place they can meet is here.
 *
 * WHY named booleans rather than one `openModal: string | null`: two overlays can legitimately be
 * open at once — the mobile filter drawer over a listing page while the mega menu closes behind it —
 * and a single slot would silently evict one.
 *
 * The reusable <Modal> owns its own focus, scroll-lock and Escape handling; this slice only records
 * WHETHER something is open, never how it renders.
 */
export interface UiState {
  isMegaMenuOpen: boolean;
  /**
   * The guest login prompt (`components/layout/LoginSheet.tsx`).
   *
   * WHY it lives here rather than in the auth feature: it is opened from the bottom nav (a shared
   * layout component), and will be opened from product cards and the wishlist heart — none of which
   * may import the auth feature under `import/no-restricted-paths`. This slice is the only place
   * they can meet. It replaced `isMobileNavOpen` when the left header drawer was removed in favour
   * of the bottom navigation.
   */
  isLoginSheetOpen: boolean;
  isFilterDrawerOpen: boolean;
  isLogoutDialogOpen: boolean;
}

const initialState: UiState = {
  isMegaMenuOpen: false,
  isLoginSheetOpen: false,
  isFilterDrawerOpen: false,
  isLogoutDialogOpen: false,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setMegaMenuOpen(state, action: PayloadAction<boolean>) {
      state.isMegaMenuOpen = action.payload;
    },
    setLoginSheetOpen(state, action: PayloadAction<boolean>) {
      state.isLoginSheetOpen = action.payload;
    },
    setFilterDrawerOpen(state, action: PayloadAction<boolean>) {
      state.isFilterDrawerOpen = action.payload;
    },
    setLogoutDialogOpen(state, action: PayloadAction<boolean>) {
      state.isLogoutDialogOpen = action.payload;
    },
    /**
     * Close everything — dispatched on route change.
     * WHY one action instead of four: a navigation should never leave a menu hanging over the new
     * page, and remembering to close each overlay individually is how one gets missed.
     */
    closeAllOverlays(state) {
      state.isMegaMenuOpen = false;
      state.isLoginSheetOpen = false;
      state.isFilterDrawerOpen = false;
    },
  },
});

export const {
  setMegaMenuOpen,
  setLoginSheetOpen,
  setFilterDrawerOpen,
  setLogoutDialogOpen,
  closeAllOverlays,
} = uiSlice.actions;

export default uiSlice.reducer;
