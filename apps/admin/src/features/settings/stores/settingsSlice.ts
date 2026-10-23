import { createSlice, isAnyOf } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { GeneralSettingsProps, Msg91Settings, PolicyProps } from '@barakath/shared/types';
import { fetchGeneralSettings } from '../api/fetchGeneralSettings';
import { fetchMsg91Settings } from '../api/fetchMsg91Settings';
import { updateMsg91Settings } from '../api/updateMsg91Settings';
import {
  updateVariables,
  updateDeliveryTax,
  updatePaymentGateway,
  updateHelpSupport,
} from '../api/updateSettings';
import { fetchPolicies } from '../api/fetchPolicies';
import { fetchPolicy } from '../api/fetchPolicy';
import { savePolicy } from '../api/savePolicy';
import { setPolicyStatus } from '../api/setPolicyStatus';
import { reorderPolicies } from '../api/reorderPolicies';
import { comparePolicies } from '../utils/policyOrder';
import { SettingsTab } from '../utils/settingsNav';

/**
 * settingsSlice — the `general/config` document, the Policies list + editor, and the active Settings tab
 * (spec §1.21).
 *
 * WHY `activeTab` lives here (not local component state): the single `/settings` route swaps tab bodies
 * from this index, the unsaved-changes guard needs to intercept a tab switch, and the policy editor (a
 * separate route) sends the admin back to the Policies tab by setting it before navigating. WHY one
 * shared `saveLoading`: only one config tab is ever visible/saving at a time, so a single flag (set by
 * the four `general/config` update thunks via a matcher) drives every Save button's spinner (skill
 * button-loading rule) without a flag per tab.
 *
 * WHY policies get their own explicit state (not part of `settings`): they are separate documents
 * (`policies/{id}`) with their own load/error lifecycle, so the Policies tab can render — or fail and
 * retry — independently of the config doc. `loaded` makes "empty" explicit (skill: loading | error |
 * empty | data) instead of inferring it from an empty array that might just mean "not fetched yet".
 */
interface PoliciesListState {
  items: PolicyProps[];
  loading: boolean;
  error: string | null;
  /** True once a fetch has succeeded and `items` reflects the server. */
  loaded: boolean;
}

interface PolicyEditorState {
  /** The policy id the editor asked for (guards against a stale response for another id). */
  id: string | null;
  data: PolicyProps | null;
  loading: boolean;
  error: string | null;
  /** The fetch succeeded but the document doesn't exist. */
  notFound: boolean;
}

/** The OTP tab's admin-only `general/msg91` doc — loaded only when that tab opens. */
interface Msg91State {
  data: Msg91Settings | null;
  loading: boolean;
  error: string | null;
}

interface SettingsState {
  settings: GeneralSettingsProps | null;
  loading: boolean;
  error: string | null;
  saveLoading: boolean;
  /** A `SettingsTab` index (Variables, Delivery & Tax, Payment, OTP, Policies, Help & Support). */
  activeTab: number;

  msg91: Msg91State;

  policies: PoliciesListState;
  policy: PolicyEditorState;
  policySaveLoading: boolean;
  policyReorderLoading: boolean;
  /** The policy whose enable/disable switch is in flight (null when none). */
  policyStatusUpdatingId: string | null;
}

const initialPolicyEditor: PolicyEditorState = {
  id: null,
  data: null,
  loading: false,
  error: null,
  notFound: false,
};

const initialState: SettingsState = {
  settings: null,
  loading: false,
  error: null,
  saveLoading: false,
  activeTab: SettingsTab.VARIABLES,

  msg91: { data: null, loading: false, error: null },

  policies: { items: [], loading: false, error: null, loaded: false },
  policy: initialPolicyEditor,
  policySaveLoading: false,
  policyReorderLoading: false,
  policyStatusUpdatingId: null,
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setActiveTab(state, action: PayloadAction<number>) {
      state.activeTab = action.payload;
    },
    /**
     * Clear the editor's loaded policy when the editor unmounts. WHY: the editor form seeds itself once
     * from `policy.data`; without clearing, re-opening the same policy would render the previous visit's
     * (possibly stale) copy for a frame before the fresh fetch's `pending` lands.
     */
    resetPolicyEditor(state) {
      state.policy = initialPolicyEditor;
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

    // --- OTP (MSG91) — its own doc; the save shares `saveLoading` since only one tab is visible ---
    builder
      .addCase(fetchMsg91Settings.pending, (s) => {
        s.msg91.loading = true;
        s.msg91.error = null;
      })
      .addCase(fetchMsg91Settings.fulfilled, (s, a) => {
        s.msg91 = { data: a.payload, loading: false, error: null };
      })
      .addCase(fetchMsg91Settings.rejected, (s, a) => {
        s.msg91.loading = false;
        s.msg91.error = a.payload ?? 'Could not load OTP settings';
      })
      .addCase(updateMsg91Settings.pending, (s) => {
        s.saveLoading = true;
      })
      .addCase(updateMsg91Settings.fulfilled, (s, a) => {
        s.saveLoading = false;
        s.msg91.data = a.payload;
      })
      .addCase(updateMsg91Settings.rejected, (s) => {
        s.saveLoading = false;
      });

    // --- Policies list ---
    builder
      .addCase(fetchPolicies.pending, (s) => {
        s.policies.loading = true;
        s.policies.error = null;
      })
      .addCase(fetchPolicies.fulfilled, (s, a) => {
        s.policies = { items: [...a.payload].sort(comparePolicies), loading: false, error: null, loaded: true };
      })
      .addCase(fetchPolicies.rejected, (s, a) => {
        s.policies.loading = false;
        s.policies.error = a.payload ?? 'Could not load policies';
      })
      // Enable/disable: patch the row in place — the write is the whole change, no refetch needed.
      .addCase(setPolicyStatus.pending, (s, a) => {
        s.policyStatusUpdatingId = a.meta.arg.id;
      })
      .addCase(setPolicyStatus.fulfilled, (s, a) => {
        s.policyStatusUpdatingId = null;
        const row = s.policies.items.find((p) => p.id === a.payload.id);
        if (row) {
          row.status = a.payload.status;
          row.updatedAt = a.payload.updatedAt;
          row.updatedBy = a.payload.updatedBy;
        }
      })
      .addCase(setPolicyStatus.rejected, (s) => {
        s.policyStatusUpdatingId = null;
      })
      // Reorder: apply the (≤2) committed order changes, then re-sort with the same comparator as fetch.
      .addCase(reorderPolicies.pending, (s) => {
        s.policyReorderLoading = true;
      })
      .addCase(reorderPolicies.fulfilled, (s, a) => {
        s.policyReorderLoading = false;
        for (const c of a.payload) {
          const row = s.policies.items.find((p) => p.id === c.id);
          if (row) row.order = c.to;
        }
        s.policies.items.sort(comparePolicies);
      })
      .addCase(reorderPolicies.rejected, (s) => {
        s.policyReorderLoading = false;
      });

    // --- Policy editor ---
    builder
      .addCase(fetchPolicy.pending, (s, a) => {
        s.policy = { ...initialPolicyEditor, id: a.meta.arg, loading: true };
      })
      .addCase(fetchPolicy.fulfilled, (s, a) => {
        if (s.policy.id !== a.meta.arg) return; // a newer request (or an unmount) superseded this one
        s.policy = { id: a.meta.arg, data: a.payload, loading: false, error: null, notFound: !a.payload };
      })
      .addCase(fetchPolicy.rejected, (s, a) => {
        if (s.policy.id !== a.meta.arg) return;
        s.policy.loading = false;
        s.policy.error = a.payload ?? 'Could not load the policy';
      })
      .addCase(savePolicy.pending, (s) => {
        s.policySaveLoading = true;
      })
      // WHY mark the list unloaded instead of patching it: the save stamped server timestamps (and a new
      // policy has an id the list has never seen), so the Policies tab refetches on mount — with a
      // skeleton rather than flashing the pre-save rows first.
      .addCase(savePolicy.fulfilled, (s) => {
        s.policySaveLoading = false;
        s.policies.loaded = false;
      })
      .addCase(savePolicy.rejected, (s) => {
        s.policySaveLoading = false;
      });

    // --- the four `general/config` tab saves share one loading flag; each replaces settings with the
    // merged server doc ---
    const updateThunks = [updateVariables, updateDeliveryTax, updatePaymentGateway, updateHelpSupport];
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

export const { setActiveTab, resetPolicyEditor } = settingsSlice.actions;
export default settingsSlice.reducer;
