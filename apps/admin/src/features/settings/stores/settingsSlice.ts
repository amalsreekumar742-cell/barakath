import { createSlice, isAnyOf } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { GeneralSettingsProps } from '@barakath/shared/types';
import { fetchGeneralSettings } from '../api/fetchGeneralSettings';
import {
  updateVariables,
  updateDeliveryTax,
  updatePaymentGateway,
  updatePrivacyPolicy,
  updateTermsConditions,
  updateHelpSupport,
} from '../api/updateSettings';

/**
 * settingsSlice — the `general/config` document + the active Settings tab (spec §1.21).
 *
 * WHY `activeTab` lives here (not local component state): the single `/settings` route swaps tab bodies
 * from this index, and the unsaved-changes guard needs to intercept a tab switch — keeping the index in
 * Redux lets the page own that flow without prop-drilling. WHY one shared `saveLoading`: only one tab is
 * ever visible/saving at a time, so a single flag (set by ALL six update thunks via a matcher) drives
 * every Save button's spinner (skill button-loading rule) without a flag per tab.
 */
interface SettingsState {
  settings: GeneralSettingsProps | null;
  loading: boolean;
  error: string | null;
  saveLoading: boolean;
  /** 0–5 → Variables, Delivery & Tax, Payment, Privacy, Terms, Help & Support. */
  activeTab: number;
}

const initialState: SettingsState = {
  settings: null,
  loading: false,
  error: null,
  saveLoading: false,
  activeTab: 0,
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setActiveTab(state, action: PayloadAction<number>) {
      state.activeTab = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // --- fetch ---
      .addCase(fetchGeneralSettings.pending, (s) => {
        s.loading = true;
        s.error = null;
      })
      .addCase(fetchGeneralSettings.fulfilled, (s, a) => {
        s.loading = false;
        s.settings = a.payload;
      })
      .addCase(fetchGeneralSettings.rejected, (s, a) => {
        s.loading = false;
        s.error = a.payload ?? 'Could not load settings';
      });

    // --- the six tab saves share one loading flag; each replaces settings with the merged server doc ---
    const updateThunks = [
      updateVariables,
      updateDeliveryTax,
      updatePaymentGateway,
      updatePrivacyPolicy,
      updateTermsConditions,
      updateHelpSupport,
    ];
    builder
      .addMatcher(isAnyOf(...updateThunks.map((t) => t.pending)), (s) => {
        s.saveLoading = true;
      })
      .addMatcher(isAnyOf(...updateThunks.map((t) => t.fulfilled)), (s, a) => {
        s.saveLoading = false;
        s.settings = a.payload as GeneralSettingsProps;
      })
      .addMatcher(isAnyOf(...updateThunks.map((t) => t.rejected)), (s) => {
        s.saveLoading = false;
      });
  },
});

export const { setActiveTab } = settingsSlice.actions;
export default settingsSlice.reducer;
