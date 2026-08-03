import { createAsyncThunk } from '@reduxjs/toolkit';
import { collection, query, where, getCountFromServer } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import { UserStatus } from '@barakath/shared/config/enums';
import { db } from '@/lib/firebaseConfig';

export interface CustomerCounts {
  total: number;
  active: number;
  blocked: number;
}

/**
 * fetchCustomerCount — the aggregate cards above the customer list (spec §1.8 listing).
 *
 * WHY getCountFromServer (not reading docs): these are collection-wide totals, not just the loaded
 * page — server-side counts are cheap, exact, and cost a fraction of a document read each. Counting
 * from `customers` in the store would only ever describe the rows paginated in so far.
 *
 * NOTE `total` is not necessarily `active + blocked`: a user document written before `status` was
 * seeded matches neither equality clause. The three are independent counts, presented as such.
 */
export const fetchCustomerCount = createAsyncThunk<CustomerCounts, void, { rejectValue: string }>(
  'customers/fetchCount',
  async (_, { rejectWithValue }) => {
    try {
      const users = collection(db, FirestoreCollections.users);
      const [total, active, blocked] = await Promise.all([
        getCountFromServer(users),
        getCountFromServer(query(users, where('status', '==', UserStatus.ACTIVE))),
        getCountFromServer(query(users, where('status', '==', UserStatus.BLOCKED))),
      ]);
      return {
        total: total.data().count,
        active: active.data().count,
        blocked: blocked.data().count,
      };
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Could not load customer count');
    }
  },
);
