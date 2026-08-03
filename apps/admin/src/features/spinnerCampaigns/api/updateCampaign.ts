import { createAsyncThunk } from '@reduxjs/toolkit';
import { doc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { SpinnerCampaignProps } from '@barakath/shared/types';
import keywordsBuilder from '@barakath/shared/utils/keywordsBuilder';
import { db } from '@/lib/firebaseConfig';
import type { CampaignInput } from '../types';
import { probabilitiesValid, slotInputToDoc } from '../utils/slots';

/**
 * updateCampaign — edit an existing spinner campaign (spec F13 editable after creation).
 *
 * Re-guards the wheel invariant (probabilities sum to 100). Keywords are rebuilt only if the name changed
 * (the sole searchable field). `totalSpins`/`totalWins` are NEVER written here — they are server-owned
 * spin counters and the admin edit must not clobber them. updatedAt is stamped server-side.
 *
 * WHY pass the previous campaign in: it lets us diff the name (to decide whether to rebuild keywords) and
 * carry the server-owned counters/createdAt through into the returned object without a re-read.
 */
export const updateCampaign = createAsyncThunk<
  SpinnerCampaignProps,
  { campaignId: string; input: CampaignInput; previous: SpinnerCampaignProps; adminId: string; adminName: string },
  { rejectValue: string }
>('spinnerCampaigns/update', async ({ campaignId, input, previous, adminId, adminName }, { rejectWithValue }) => {
  try {
    if (!probabilitiesValid(input.slots)) {
      return rejectWithValue('Slot probabilities must sum to exactly 100%');
    }

    const nameChanged = input.name.trim() !== previous.name;
    const keywords = nameChanged ? keywordsBuilder(input.name) : previous.keywords;
    const startDate = Timestamp.fromDate(input.startDate);
    const endDate = Timestamp.fromDate(input.endDate);

    const patch = {
      name: input.name.trim(),
      description: input.description.trim(),
      slots: input.slots.map(slotInputToDoc),
      maxSpinsPerUser: input.maxSpinsPerUser,
      spinCooldownHours: input.spinCooldownHours,
      couponValidityDays: input.couponValidityDays,
      couponValidityHours: input.couponValidityHours,
      isActive: input.isActive,
      startDate,
      endDate,
      createdBy: adminId,
      createdByName: adminName,
      keywords,
      updatedAt: serverTimestamp(),
    };

    await updateDoc(doc(db, FirestoreCollections.spinnerCampaigns, campaignId), patch);

    // Return the merged campaign (keeping the server-owned totalSpins/totalWins/createdAt from `previous`).
    return { ...previous, ...patch, id: campaignId, updatedAt: Timestamp.now() } as SpinnerCampaignProps;
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not update campaign');
  }
});
