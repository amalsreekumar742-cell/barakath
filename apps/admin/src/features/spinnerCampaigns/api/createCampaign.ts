import { createAsyncThunk } from '@reduxjs/toolkit';
import { collection, doc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { SpinnerCampaignProps } from '@barakath/shared/types';
import keywordsBuilder from '@barakath/shared/utils/keywordsBuilder';
import { db } from '@/lib/firebaseConfig';
import type { CampaignInput } from '../types';
import { probabilitiesValid, slotInputToDoc } from '../utils/slots';

/**
 * createCampaign — create a new spinner-campaign document (spec F13 Create Campaign).
 *
 * Guards the wheel invariant: slot probabilities MUST sum to exactly 100 (else the wheel odds are
 * meaningless), rejecting with a message the form surfaces. Writes with totalSpins/totalWins seeded to 0
 * (server-owned counters the customer app bumps), keywords precomputed from the name (so list search
 * works), and createdAt/updatedAt stamped by the SERVER clock (skill: serverTimestamp is immune to a
 * wrong client clock).
 *
 * WHY pre-generate the ref + store `id` IN the doc: the customer app reads campaigns by their `id` field,
 * so it must be present in the document — not only as the Firestore doc key. Pre-generating the ref lets
 * us write the id in the same single set, no follow-up update.
 *
 * WHY return a client Timestamp.now() for created/updated: serverTimestamp() resolves to null until the
 * write round-trips, but the slice prepends this object immediately — Timestamp.now() gives it a sortable,
 * displayable value without a re-fetch. The persisted doc still holds the true server time.
 */
export const createCampaign = createAsyncThunk<
  SpinnerCampaignProps,
  { input: CampaignInput; adminId: string; adminName: string },
  { rejectValue: string }
>('spinnerCampaigns/create', async ({ input, adminId, adminName }, { rejectWithValue }) => {
  try {
    if (!probabilitiesValid(input.slots)) {
      return rejectWithValue('Slot probabilities must sum to exactly 100%');
    }

    const keywords = keywordsBuilder(input.name);
    const startDate = Timestamp.fromDate(input.startDate);
    const endDate = Timestamp.fromDate(input.endDate);

    const ref = doc(collection(db, FirestoreCollections.spinnerCampaigns));
    const docData = {
      id: ref.id,
      name: input.name.trim(),
      description: input.description.trim(),
      slots: input.slots.map(slotInputToDoc),
      maxSpinsPerUser: input.maxSpinsPerUser,
      spinCooldownHours: input.spinCooldownHours,
      couponValidityDays: input.couponValidityDays,
      couponValidityHours: input.couponValidityHours,
      isActive: input.isActive,
      totalSpins: 0,
      totalWins: 0,
      startDate,
      endDate,
      createdBy: adminId,
      createdByName: adminName,
      keywords,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(ref, docData);

    // Client-side mirror for optimistic list prepend (server holds the real timestamps).
    const now = Timestamp.now();
    return { ...docData, createdAt: now, updatedAt: now } as SpinnerCampaignProps;
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not create campaign');
  }
});
