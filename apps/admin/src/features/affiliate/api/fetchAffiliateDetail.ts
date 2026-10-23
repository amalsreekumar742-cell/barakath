import { createAsyncThunk } from '@reduxjs/toolkit';
import { doc, getDoc } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { UserProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';

/**
 * fetchAffiliateDetail — one affiliate's user document, for the header of the affiliate detail page
 * (spec §1.14). Read here rather than linking to the Customers feature, so an admin who holds only the
 * Affiliate permission can still open it.
 */
export const fetchAffiliateDetail = createAsyncThunk<UserProps, string, { rejectValue: string }>(
  'affiliate/fetchDetail',
  async (userId, { rejectWithValue }) => {
    try {
      const snap = await getDoc(doc(db, FirestoreCollections.users, userId));
      if (!snap.exists()) return rejectWithValue('Affiliate not found');
      return { ...snap.data(), id: snap.id } as UserProps;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Could not load affiliate');
    }
  },
);
