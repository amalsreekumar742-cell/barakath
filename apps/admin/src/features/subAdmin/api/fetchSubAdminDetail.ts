import { createAsyncThunk } from '@reduxjs/toolkit';
import { doc, getDoc } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { SubAdminProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';

/**
 * fetchSubAdminDetail — load a single sub-admin document for the Edit page (spec §1.20 editable after
 * creation). WHY a one-shot getDoc (not the live list): the edit form needs the current values once, to
 * hydrate its fields; it is not a live view. Rejects with a message the route maps to an error state.
 */
export const fetchSubAdminDetail = createAsyncThunk<SubAdminProps, string, { rejectValue: string }>(
  'subAdmin/fetchDetail',
  async (id, { rejectWithValue }) => {
    try {
      const snap = await getDoc(doc(db, FirestoreCollections.subAdmins, id));
      if (!snap.exists()) return rejectWithValue('Sub-admin not found');
      return { ...snap.data(), id: snap.id } as SubAdminProps;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Could not load sub-admin');
    }
  },
);
