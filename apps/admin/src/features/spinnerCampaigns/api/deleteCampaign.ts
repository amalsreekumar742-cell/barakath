import { createAsyncThunk } from '@reduxjs/toolkit';
import { doc, deleteDoc } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import { db } from '@/lib/firebaseConfig';

/**
 * deleteCampaign — hard-delete a spinner-campaign document (spec F13 / §1.22: hard deletes throughout,
 * with a confirmation dialog + toast handled in the component).
 * WHY it returns the id: the slice removes the row from the list in place without a re-fetch, keeping the
 * paginated list intact.
 */
export const deleteCampaign = createAsyncThunk<string, string, { rejectValue: string }>(
  'spinnerCampaigns/delete',
  async (campaignId, { rejectWithValue }) => {
    try {
      await deleteDoc(doc(db, FirestoreCollections.spinnerCampaigns, campaignId));
      return campaignId;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Could not delete campaign');
    }
  },
);
