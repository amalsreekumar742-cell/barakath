import { createAsyncThunk } from '@reduxjs/toolkit';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { FirestoreCollections, FirestoreDocs } from '@barakath/shared/config/collections';
import type { Msg91Settings } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';
import { DEFAULT_MSG91_SETTINGS } from './defaults';

/**
 * updateMsg91Settings — save the OTP tab to `general/msg91`, then re-read it so `updatedAt` is the
 * server-resolved value. The OTP Cloud Functions read this doc on every call, so the change is live for
 * the next sign-in with no redeploy — and from the first save on, functions/.env is ignored.
 *
 * WHY every field is written (blank included): blank is meaningful here — a blank web widget means
 * "use the app widget", a blank reviewer pair turns the Play bypass off.
 */
export const updateMsg91Settings = createAsyncThunk<
  Msg91Settings,
  Omit<Msg91Settings, 'updatedAt'>,
  { rejectValue: string }
>('settings/updateMsg91', async (input, { rejectWithValue }) => {
  try {
    const ref = doc(db, FirestoreCollections.general, FirestoreDocs.generalMsg91);
    await setDoc(ref, { ...input, updatedAt: serverTimestamp() }, { merge: true });
    const snap = await getDoc(ref);
    return { ...DEFAULT_MSG91_SETTINGS, ...(snap.data() as Partial<Msg91Settings>) };
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not save OTP settings');
  }
});
