import { createAsyncThunk } from '@reduxjs/toolkit';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { UserAddressProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';

/**
 * fetchCustomerAddresses — a customer's saved delivery addresses (spec §1.8 Addresses tab). Read-only
 * for the admin. Bounded read: `limit(20)` — a person keeps only a handful of addresses, so a single
 * capped read is correct here (not a paginated list); the cap still honours the skill's "never read a
 * collection without a limit" rule.
 */
export const fetchCustomerAddresses = createAsyncThunk<
  UserAddressProps[],
  string,
  { rejectValue: string }
>('customers/fetchAddresses', async (userId, { rejectWithValue }) => {
  try {
    const snap = await getDocs(
      query(
        collection(db, FirestoreCollections.users, userId, FirestoreCollections.addresses),
        orderBy('createdAt', 'desc'),
        limit(20),
      ),
    );
    return snap.docs.map((d) => ({ ...d.data(), id: d.id }) as UserAddressProps);
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not load addresses');
  }
});
