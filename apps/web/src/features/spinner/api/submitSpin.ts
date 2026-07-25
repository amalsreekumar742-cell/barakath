import { createAsyncThunk } from '@reduxjs/toolkit';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebaseConfig';
import { CloudFunctions } from '@/config/cloudFunctions';

/**
 * The `spinWheel` callable's real response shape — verified directly against
 * `functions/src/growth/spinWheel.ts` (and cross-checked with WEB_BATCH4_NOTES.md §8): there is NO
 * `offerId`. `slotLabel` is the only thing identifying which wedge won; `couponDetails.validUntil` is
 * an epoch-ms number (the ONE deliberate exception to "Timestamp, never number" — it crosses a Cloud
 * Function response boundary, not a Firestore document, so there is no native Timestamp to preserve).
 */
export interface SpinWheelResponse {
  resultType: 'Coupon' | 'Better luck';
  slotLabel: string;
  couponCode?: string;
  couponDetails?: {
    code: string;
    discountType: 'Percentage' | 'Fixed';
    discountValue: number;
    minimumOrderAmount: number;
    maximumDiscount: number;
    validUntil: number;
  };
}

/**
 * Runs one spin. THE CLIENT NEVER PICKS THE OUTCOME — `spinWheel` validates the remaining-spins/
 * cooldown gate, draws the weighted-random winner, and (on a win) mints the coupon, all server-side
 * with the Admin SDK; this thunk only relays the request and returns whatever the server decided.
 *
 * WHY `rejectWithValue` carries the raw error message: `spinWheel`'s `HttpsError`s are already written
 * for a customer to read ("Please wait 3 hours", "Maximum spins reached", "This campaign has ended") —
 * surfacing them directly is more useful than the generic fallback `toastError` would otherwise show.
 */
export const submitSpin = createAsyncThunk<SpinWheelResponse, { campaignId: string }, { rejectValue: string }>(
  'spinner/submitSpin',
  async ({ campaignId }, { rejectWithValue }) => {
    try {
      const call = httpsCallable<{ campaignId: string }, SpinWheelResponse>(functions, CloudFunctions.spinWheel);
      const res = await call({ campaignId });
      return res.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not spin right now. Please try again.';
      return rejectWithValue(message);
    }
  },
);
