import { createAsyncThunk } from '@reduxjs/toolkit';
import { doc, getDoc } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { BannerProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';

/**
 * fetchBannerDetail — load a single banner by id for the Edit page (spec §1.15 click card to edit).
 * WHY a one-shot getDoc (not onSnapshot): the edit form takes an initial snapshot to hydrate its fields
 * and current image; it does not need live updates while the admin edits, so a single read is cheaper.
 */
export const fetchBannerDetail = createAsyncThunk<BannerProps, string, { rejectValue: string }>(
  'banners/fetchDetail',
  async (bannerId, { rejectWithValue }) => {
    try {
      const snap = await getDoc(doc(db, FirestoreCollections.banners, bannerId));
      if (!snap.exists()) return rejectWithValue('Banner not found');
      return { ...snap.data(), id: snap.id } as BannerProps;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Could not load banner');
    }
  },
);
