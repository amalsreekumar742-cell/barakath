import { createAsyncThunk } from '@reduxjs/toolkit';
import { doc, getDoc } from 'firebase/firestore';
import { FirestoreCollections, FirestoreDocs } from '@barakath/shared/config/collections';
import type { Msg91Settings } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';
import { DEFAULT_MSG91_SETTINGS } from './defaults';

/**
 * fetchMsg91Settings — load the OTP tab's admin-only `general/msg91` document.
 *
 * WHY its own read (not part of fetchGeneralSettings): `general/config` is world-readable and is loaded
 * for every tab; this doc holds widget tokens, so it is fetched only when an admin opens the OTP tab.
 * A missing doc is not an error — it means the functions are still on their functions/.env fallback.
 */
export const fetchMsg91Settings = createAsyncThunk<Msg91Settings, void, { rejectValue: string }>(
  'settings/fetchMsg91',
  async (_, { rejectWithValue }) => {
    try {
      const snap = await getDoc(doc(db, FirestoreCollections.general, FirestoreDocs.generalMsg91));
      if (!snap.exists()) return DEFAULT_MSG91_SETTINGS;
      return { ...DEFAULT_MSG91_SETTINGS, ...(snap.data() as Partial<Msg91Settings>) };
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Could not load OTP settings');
    }
  },
);
