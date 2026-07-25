import { createAsyncThunk } from '@reduxjs/toolkit';
import { doc, getDoc } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { SpinnerCampaignProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';

/**
 * fetchCampaignDetail — load a single campaign by id for the detail + edit screens (spec F13).
 * WHY a one-shot getDoc (not onSnapshot): the detail page and edit form take an initial snapshot; they
 * do not need live updates while viewing/editing, so a single read is cheaper and simpler.
 */
export const fetchCampaignDetail = createAsyncThunk<SpinnerCampaignProps, string, { rejectValue: string }>(
  'spinnerCampaigns/fetchDetail',
  async (campaignId, { rejectWithValue }) => {
    try {
      const snap = await getDoc(doc(db, FirestoreCollections.spinnerCampaigns, campaignId));
      if (!snap.exists()) return rejectWithValue('Campaign not found');
      return { ...snap.data(), id: snap.id } as SpinnerCampaignProps;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Could not load campaign');
    }
  },
);
