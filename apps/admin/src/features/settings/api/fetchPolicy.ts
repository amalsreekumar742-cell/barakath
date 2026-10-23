import { createAsyncThunk } from '@reduxjs/toolkit';
import { doc, getDoc } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { PolicyProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';

/**
 * fetchPolicy — one policy for the editor (`/settings/policies/:policyId`); resolves `null` when the doc
 * doesn't exist so the page can show a "not found" state rather than an error.
 *
 * WHY re-read instead of reusing the list row: the editor saves the whole document, so it must start
 * from the freshest content — another admin may have edited it since the list was loaded. It is one
 * document read.
 */
export const fetchPolicy = createAsyncThunk<PolicyProps | null, string, { rejectValue: string }>(
  'settings/fetchPolicy',
  async (policyId, { rejectWithValue }) => {
    try {
      const snap = await getDoc(doc(db, FirestoreCollections.policies, policyId));
      if (!snap.exists()) return null;
      return { ...snap.data(), id: snap.id } as PolicyProps;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Could not load the policy');
    }
  },
);
