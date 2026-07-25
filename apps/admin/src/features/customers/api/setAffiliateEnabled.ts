import { createAsyncThunk } from '@reduxjs/toolkit';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebaseConfig';

/**
 * setAffiliateEnabled — the Customer detail page's "Affiliate marketing" toggle (spec §1.8). Unlike
 * `toggleCustomerStatus`/`addWalletMoney`, this goes through a Cloud Function rather than a direct
 * `updateDoc`: turning the toggle on for a customer with no `affiliateCode` yet also mints one, and code
 * generation needs a server-side uniqueness guarantee (see `functions/src/growth/setAffiliateEnabled.ts`).
 */
export const setAffiliateEnabled = createAsyncThunk<
  { userId: string; affiliateCode: string | null; affiliateEnabled: boolean },
  { userId: string; enabled: boolean },
  { rejectValue: string }
>('customers/setAffiliateEnabled', async ({ userId, enabled }, { rejectWithValue }) => {
  try {
    const call = httpsCallable<
      { userId: string; enabled: boolean },
      { affiliateCode: string | null; affiliateEnabled: boolean }
    >(functions, 'setAffiliateEnabled');
    const res = await call({ userId, enabled });
    return { userId, ...res.data };
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not update affiliate access');
  }
});
