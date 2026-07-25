import { createAsyncThunk } from '@reduxjs/toolkit';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import { db } from '@/lib/firebaseConfig';

/**
 * toggleCampaignActive — flip a campaign's `isActive` flag from the list/detail (spec F13 status toggle).
 * WHY only isActive + updatedAt are written: activation is a single low-risk field flip; nothing else can
 * be disturbed (it can't touch the spin counters or dates). updatedAt is server-stamped.
 * WHY it returns {campaignId, isActive}: the slice patches just that row's flag in place — no re-fetch —
 * and the component recomputes the status badge from it.
 */
export const toggleCampaignActive = createAsyncThunk<
  { campaignId: string; isActive: boolean },
  { campaignId: string; isActive: boolean },
  { rejectValue: string }
>('spinnerCampaigns/toggleActive', async ({ campaignId, isActive }, { rejectWithValue }) => {
  try {
    await updateDoc(doc(db, FirestoreCollections.spinnerCampaigns, campaignId), {
      isActive,
      updatedAt: serverTimestamp(),
    });
    return { campaignId, isActive };
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not update campaign');
  }
});
