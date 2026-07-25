import { createAsyncThunk } from '@reduxjs/toolkit';
import { collection, query, where, getCountFromServer } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import { db } from '@/lib/firebaseConfig';

export interface CustomerCounts {
  total: number;
  affiliates: number;
}

/**
 * fetchCustomerCount — the header summary "N registered · M affiliates" (spec §1.8 listing).
 *
 * WHY getCountFromServer (not reading docs): the header needs collection-wide totals, not just the
 * loaded page — server-side counts are cheap and exact. Affiliates = users with a non-empty
 * `affiliateCode`; approximated as `affiliateCode != ''` which the != operator supports.
 */
export const fetchCustomerCount = createAsyncThunk<CustomerCounts, void, { rejectValue: string }>(
  'customers/fetchCount',
  async (_, { rejectWithValue }) => {
    try {
      const users = collection(db, FirestoreCollections.users);
      const [total, affiliates] = await Promise.all([
        getCountFromServer(users),
        getCountFromServer(query(users, where('affiliateCode', '!=', ''))),
      ]);
      return { total: total.data().count, affiliates: affiliates.data().count };
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Could not load customer count');
    }
  },
);
