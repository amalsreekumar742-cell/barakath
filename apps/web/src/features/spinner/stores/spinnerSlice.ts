import { createSlice } from '@reduxjs/toolkit';
import type { SpinnerCampaignProps } from '@barakath/shared';
import { fetchActiveCampaign } from '../api/fetchActiveCampaign';
import { fetchSpinAllowance } from '../api/fetchSpinAllowance';
import { submitSpin, type SpinWheelResponse } from '../api/submitSpin';

/**
 * Spin & Win (spec §3.14).
 *
 * WHY `lastResult` is typed as `SpinWheelResponse` (the callable's own response) and not a bespoke
 * shape: an earlier scaffold of this slice (`won`/`slotId`/`label`/`couponCode: string | null`) predates
 * verifying `functions/src/growth/spinWheel.ts` against WEB_BATCH4_NOTES.md §8 — the real callable
 * returns `{ resultType, slotLabel, couponCode?, couponDetails? }` with no `offerId`/`slotId` at all,
 * and the win card needs `couponDetails` (min order, expiry) to render conditions, which the old shape
 * had no room for. Reusing the callable's own response type keeps this slice unable to invent data the
 * server never sent.
 *
 * WHY the outcome is never decided here: the client must never pick the winning slot — that is a
 * server decision taken by `spinWheel`, which also enforces the spin allowance and writes the coupon.
 * `lastResult` is what the server SAID, held only so the wheel can animate to it.
 *
 * WHY `spinsRemaining`/`nextSpinAt` are server-reported (`fetchSpinAllowance`) rather than a local
 * decrement: the allowance is a lifetime cap plus an optional cooldown, shared across tabs/devices — a
 * local counter could drift from what `spinWheel` will actually accept.
 *
 * WHY there is no `coupons`/`couponsLoading`/`couponsHasMore` state (present in the earlier scaffold,
 * removed here): D0's `CouponWallet` (`features/coupons`, rendered with `variant="embedded"` by the
 * `/spin-win` ROUTE — see that page's own header comment on why the import lives there and not in this
 * feature) already owns the entire won-coupon list end-to-end, including its own pagination. Keeping a
 * second, unused copy of that state here would be exactly the competing reward-listing mechanism
 * WEB_BATCH4_NOTES.md §8 warns against building. Confirmed safe to drop: only `stores/store.ts` imports
 * this slice (its default reducer export), so nothing else referenced the removed fields/actions.
 */
export interface SpinnerState {
  /** The single live campaign, or null when none is currently running. */
  campaign: SpinnerCampaignProps | null;
  campaignLoading: boolean;
  spinsRemaining: number;
  /** Epoch millis when the next spin becomes available, or null when one is available now. A
   *  client-side UX hint only (greys the button) — `spinWheel` itself is the real enforcement. */
  nextSpinAt: number | null;
  /** True only while the `spinWheel` callable is in flight. The wheel's own landing ANIMATION runs
   *  after this flips back to `false` — `SpinWinExperience` tracks that separately (`animating`) so the
   *  button stays disabled through both phases without conflating "server responded" with "the wheel
   *  has visibly finished". */
  spinning: boolean;
  lastResult: SpinWheelResponse | null;
  error: string | null;
}

const initialState: SpinnerState = {
  campaign: null,
  campaignLoading: false,
  spinsRemaining: 0,
  nextSpinAt: null,
  spinning: false,
  lastResult: null,
  error: null,
};

const spinnerSlice = createSlice({
  name: 'spinner',
  initialState,
  reducers: {
    /** Clears the previous result — dispatched right as a new spin starts, so a stale win/loss card
     *  can never flash on screen before the fresh wheel animation lands. */
    clearSpinResult(state) {
      state.lastResult = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchActiveCampaign.pending, (state) => {
        state.campaignLoading = true;
        state.error = null;
      })
      .addCase(fetchActiveCampaign.fulfilled, (state, action) => {
        state.campaign = action.payload;
        state.campaignLoading = false;
      })
      .addCase(fetchActiveCampaign.rejected, (state, action) => {
        state.campaignLoading = false;
        state.error = action.error.message ?? 'Could not load the wheel. Please try again.';
      })
      .addCase(fetchSpinAllowance.fulfilled, (state, action) => {
        state.spinsRemaining = action.payload.spinsRemaining;
        state.nextSpinAt = action.payload.nextSpinAt;
      })
      .addCase(submitSpin.pending, (state) => {
        state.spinning = true;
        state.error = null;
      })
      .addCase(submitSpin.fulfilled, (state, action) => {
        state.spinning = false;
        state.lastResult = action.payload;
      })
      .addCase(submitSpin.rejected, (state, action) => {
        state.spinning = false;
        state.error = action.payload ?? action.error.message ?? 'Could not spin right now. Please try again.';
      });
  },
});

export const { clearSpinResult } = spinnerSlice.actions;
export default spinnerSlice.reducer;
