import { createAsyncThunk } from '@reduxjs/toolkit';
import { doc, getDoc } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { UserProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';

/**
 * fetchCustomerDetail — one customer document for the detail page (spec §1.8).
 *
 * WHY a one-shot getDoc (not onSnapshot): the admin views a customer to inspect/act; a live listener per
 * viewed customer would bill a read per change for no UX gain. Actions (block, add wallet) patch the
 * slice locally on success, so the view stays correct without a subscription.
 */
export const fetchCustomerDetail = createAsyncThunk<UserProps, string, { rejectValue: string }>(
  'customers/fetchDetail',
  async (userId, { rejectWithValue }) => {
    try {
      const snap = await getDoc(doc(db, FirestoreCollections.users, userId));
      if (!snap.exists()) return rejectWithValue('Customer not found');
      return { ...snap.data(), id: snap.id } as UserProps;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Could not load customer');
    }
  },
);
