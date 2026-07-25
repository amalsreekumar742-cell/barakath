import { createAsyncThunk } from '@reduxjs/toolkit';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type {
  ColorUnit,
  GeneralSettingsProps,
  VariantGroup,
} from '@barakath/shared/types';
import type { RootState } from '@/stores/store';
import { db } from '@/lib/firebaseConfig';
import {
  DEFAULT_SETTINGS,
  GENERAL_DOC_ID,
  SECRETS_DOC_ID,
  VARIABLES_DOC_ID,
  mergeSettings,
} from './defaults';

/**
 * The six Settings update thunks (spec §1.21 — "All tabs save independently"). Each writes ONLY its own
 * tab's map to the shared `general/config` document with `{ merge: true }` (so the doc is created on the
 * first save and other tabs' maps are never clobbered — merge deep-merges maps), stamps a top-level
 * `updatedAt`, then re-reads and returns the full merged settings so the slice replaces its state with
 * server-resolved values.
 *
 * WHY re-read instead of returning the patch: `serverTimestamp()` is a write sentinel, not a value —
 * the legal tabs' "Last updated" stamp and `updatedAt` are only known after the server resolves them.
 */

/** Persist a partial (per-tab map) patch to the config doc, then return the full merged settings. */
async function writeAndRead(patch: Record<string, unknown>): Promise<GeneralSettingsProps> {
  const ref = doc(db, FirestoreCollections.general, GENERAL_DOC_ID);
  await setDoc(ref, { ...patch, updatedAt: serverTimestamp() }, { merge: true });
  const snap = await getDoc(ref);
  return mergeSettings(snap.data() as Partial<GeneralSettingsProps>);
}

/**
 * Tab 1 — Variables: colour units + variant groups. UNLIKE the other tabs, these persist to their OWN
 * `variables/config` document (a dedicated collection — see FirestoreCollections.variables), not to
 * `general/config`. The full settings object is rebuilt from current state with the new variables so the
 * slice keeps every other tab's values (no re-read of `general/config` needed).
 */
export const updateVariables = createAsyncThunk<
  GeneralSettingsProps,
  { colors: ColorUnit[]; variantGroups: VariantGroup[] },
  { state: RootState; rejectValue: string }
>('settings/updateVariables', async (input, { getState, rejectWithValue }) => {
  try {
    const ref = doc(db, FirestoreCollections.variables, VARIABLES_DOC_ID);
    await setDoc(
      ref,
      { colors: input.colors, variantGroups: input.variantGroups, updatedAt: serverTimestamp() },
      { merge: true },
    );
    const current = getState().settings.settings ?? DEFAULT_SETTINGS;
    return {
      ...current,
      variables: { colors: input.colors, variantGroups: input.variantGroups },
    };
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not save variables');
  }
});

/** Tab 2 — Delivery & Tax. */
export const updateDeliveryTax = createAsyncThunk<
  GeneralSettingsProps,
  {
    standardDeliveryFee: number;
    freeDeliveryThreshold: number;
    gstPercentage: number;
    gstin: string;
    pricesIncludeTax: boolean;
  },
  { rejectValue: string }
>('settings/updateDeliveryTax', async (input, { rejectWithValue }) => {
  try {
    return await writeAndRead({ delivery: { ...input } });
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not save delivery & tax');
  }
});

/** Tab 3 — Payment Gateway (Razorpay credentials + toggles). */
export const updatePaymentGateway = createAsyncThunk<
  GeneralSettingsProps,
  {
    razorpayKeyId: string;
    razorpayKeySecret: string;
    razorpayConnected: boolean;
    walletPaymentsEnabled: boolean;
  },
  { rejectValue: string }
>('settings/updatePaymentGateway', async (input, { rejectWithValue }) => {
  try {
    const { razorpayKeySecret, ...publishable } = input;

    // The SECRET goes to its own admin-only document. `general/config` is world-readable — the customer
    // app reads delivery/GST/support/version from it before sign-in — so a secret stored there would be
    // downloadable by anyone. `razorpayKeyId` stays in the public doc on purpose: it's the publishable
    // key the client checkout SDK needs.
    //
    // WHY only when non-empty: the secret is write-only — it is never read back into the form, so the
    // field is blank on every revisit. Writing that blank through would silently wipe a working gateway
    // the moment someone toggled wallet payments. Blank means "leave it alone".
    // TODO: move to a Cloud Function for production — secrets should not be written from a client at all.
    if (razorpayKeySecret.trim()) {
      await setDoc(
        doc(db, FirestoreCollections.general, SECRETS_DOC_ID),
        { razorpayKeySecret: razorpayKeySecret.trim(), updatedAt: serverTimestamp() },
        { merge: true },
      );
    }
    return await writeAndRead({ payment: { ...publishable } });
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not save payment gateway');
  }
});

/** Tab 4 — Privacy Policy (auto-stamps its own "Last updated"). */
export const updatePrivacyPolicy = createAsyncThunk<
  GeneralSettingsProps,
  { privacyPolicy: string },
  { rejectValue: string }
>('settings/updatePrivacyPolicy', async (input, { rejectWithValue }) => {
  try {
    return await writeAndRead({
      privacy: {
        privacyPolicy: input.privacyPolicy,
        privacyPolicyUpdatedAt: serverTimestamp(),
      },
    });
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not save privacy policy');
  }
});

/** Tab 5 — Terms & Conditions (auto-stamps its own "Last updated"). */
export const updateTermsConditions = createAsyncThunk<
  GeneralSettingsProps,
  { termsAndConditions: string },
  { rejectValue: string }
>('settings/updateTermsConditions', async (input, { rejectWithValue }) => {
  try {
    return await writeAndRead({
      terms: {
        termsAndConditions: input.termsAndConditions,
        termsUpdatedAt: serverTimestamp(),
      },
    });
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not save terms & conditions');
  }
});

/** Tab 6 — Help & Support (contact us). */
export const updateHelpSupport = createAsyncThunk<
  GeneralSettingsProps,
  { helpPhone: string; helpWhatsApp: string; helpEmail: string },
  { rejectValue: string }
>('settings/updateHelpSupport', async (input, { rejectWithValue }) => {
  try {
    return await writeAndRead({ contactus: { ...input } });
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not save help & support');
  }
});
