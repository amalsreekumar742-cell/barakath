import { createAsyncThunk } from '@reduxjs/toolkit';
import { doc, getDoc } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { GeneralSettingsProps, VariablesSettings } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';
import { DEFAULT_SETTINGS, GENERAL_DOC_ID, VARIABLES_DOC_ID, mergeSettings } from './defaults';

/**
 * fetchGeneralSettings — load the Settings tabs' data. Tabs 2–6 live in the single `general/config`
 * document; the Variables tab (colours + variant groups) lives in its OWN `variables/config` document
 * (spec §1.21), so both are read in parallel and stitched into one GeneralSettingsProps.
 *
 * WHY fall back to DEFAULT_SETTINGS when a doc is missing: on a fresh project neither doc exists yet;
 * the form must still render controlled inputs. The first save of each tab creates its doc (the update
 * thunks use setDoc(..., { merge: true })). Stored fields are spread over the defaults so a partially-
 * written doc never yields `undefined` on a field the form binds to.
 *
 * WHY the `general.variables` fallback: earlier builds stored variables inside `general/config`; if the
 * new `variables/config` doc doesn't exist yet, we keep showing whatever the old doc held so nothing is
 * lost — the next Variables save migrates it to the dedicated collection.
 */
export const fetchGeneralSettings = createAsyncThunk<
  GeneralSettingsProps,
  void,
  { rejectValue: string }
>('settings/fetch', async (_, { rejectWithValue }) => {
  try {
    const [genSnap, varSnap] = await Promise.all([
      getDoc(doc(db, FirestoreCollections.general, GENERAL_DOC_ID)),
      getDoc(doc(db, FirestoreCollections.variables, VARIABLES_DOC_ID)),
    ]);

    const base = genSnap.exists()
      ? mergeSettings(genSnap.data() as Partial<GeneralSettingsProps>)
      : DEFAULT_SETTINGS;

    if (!varSnap.exists()) return base; // dedicated doc not created yet — keep migrated/base variables

    const v = varSnap.data() as Partial<VariablesSettings>;
    return {
      ...base,
      variables: {
        colors: v.colors ?? base.variables.colors,
        variantGroups: v.variantGroups ?? base.variables.variantGroups,
      },
    };
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not load settings');
  }
});
