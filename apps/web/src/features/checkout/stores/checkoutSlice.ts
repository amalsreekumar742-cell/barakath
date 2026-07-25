import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { doc, getDoc } from 'firebase/firestore';
import { FirestoreCollections, FirestoreDocs } from '@barakath/shared';
import { db } from '@/lib/firebaseConfig';
import type { TotalsSettings } from '@/lib/commerce/totals';
import { placeOrder, confirmPayment, type PlaceOrderFailure } from '../api/checkoutThunks';

/**
 * checkoutSlice — UI-only state for the checkout section of `/cart`: whether an order-placement
 * sequence is in flight (so the "Place order" button can never be double-clicked into two orders),
 * the reconciliation dialog's numbers when the server's real amount disagrees with what was displayed,
 * the last failure to show inline, and `general/config`'s delivery/payment settings that
 * `lib/commerce/totals.ts`'s `computeTotals` needs.
 *
 * WHY this does NOT duplicate cart data: `items`/`appliedCoupon`/`walletApplied`/`selectedAddressId`
 * all already live in `state.cart` (cartSlice, C0) — this slice only reads them via `useAppSelector`
 * from the component, never copies them in here.
 *
 * WHY the `general/config` fetch is a thunk defined IN THIS FILE rather than in
 * `features/checkout/api/checkoutThunks.ts`: this session's assigned surface is exactly
 * `features/checkout/components/**` and this new `stores/checkoutSlice.ts` — `api/checkoutThunks.ts`
 * is C0's already-complete, reviewed file (placeOrder/confirmPayment) and is deliberately left
 * untouched. The read itself is a single bounded `getDoc` (not a list — no pagination applies), and
 * `general/config` is world-readable per `firestore.rules` (WEB_BATCH1_NOTES.md §2.4), so a direct
 * client read is correct here the same way `features/address/api/addresses.ts` reads directly rather
 * than through a Cloud Function.
 *
 * WHY the Razorpay-success->confirmPayment handoff and the reconcile-dialog PROMISE RESOLVER are NOT
 * stored here: a promise resolver is a function closure tied to one in-flight call, not durable UI
 * state — it lives in a `useRef` inside `CheckoutSection`. This slice only carries the numbers the
 * dialog needs to RENDER (`reconcile`), which the component reads to decide whether to show it.
 */

export interface ReconcileNumbers {
  amount: number;
  displayed: number;
}

export interface CheckoutState {
  /** True for the ENTIRE placeOrder sequence: order creation -> possible Razorpay sheet -> return.
   *  Keeps the Place Order button disabled/loading the whole way through (skill: never double-submit). */
  isPlacingOrder: boolean;
  /** True while `confirmPayment` (verifyPayment -> possible onSnapshot fallback) is in flight. */
  isConfirmingPayment: boolean;
  /** Non-null while the "the amount changed" confirmation dialog should be showing. */
  reconcile: ReconcileNumbers | null;
  /** The last `placeOrder` failure, for an inline message alongside the toast. */
  lastFailure: PlaceOrderFailure | null;
  /** `general/config`'s delivery + payment settings — null until loaded. */
  settings: TotalsSettings | null;
  settingsLoading: boolean;
  settingsError: string | null;
}

const initialState: CheckoutState = {
  isPlacingOrder: false,
  isConfirmingPayment: false,
  reconcile: null,
  lastFailure: null,
  settings: null,
  settingsLoading: true,
  settingsError: null,
};

/**
 * Fetch `general/config`'s `delivery` + `payment` fields — the two `computeTotals` needs to price
 * delivery/GST and to know whether wallet payments are enabled. A single doc read, bounded by
 * definition (one document), so no cursor pagination applies here.
 */
export const fetchCheckoutSettings = createAsyncThunk<TotalsSettings | null>(
  'checkout/fetchSettings',
  async () => {
    const snap = await getDoc(doc(db, FirestoreCollections.general, FirestoreDocs.generalConfig));
    if (!snap.exists()) return null;
    const data = snap.data() as { delivery?: TotalsSettings['delivery']; payment?: TotalsSettings['payment'] };
    if (!data.delivery || !data.payment) return null;
    return { delivery: data.delivery, payment: data.payment };
  },
);

const checkoutSlice = createSlice({
  name: 'checkout',
  initialState,
  reducers: {
    /** Opens the reconcile dialog with the server's real amount vs what was on screen. */
    openReconcile(state, action: PayloadAction<ReconcileNumbers>) {
      state.reconcile = action.payload;
    },
    /** Closes the dialog once the customer has answered (the resolver itself lives in the component). */
    closeReconcile(state) {
      state.reconcile = null;
    },
    clearFailure(state) {
      state.lastFailure = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCheckoutSettings.pending, (state) => {
        state.settingsLoading = true;
        state.settingsError = null;
      })
      .addCase(fetchCheckoutSettings.fulfilled, (state, action) => {
        state.settingsLoading = false;
        state.settings = action.payload;
      })
      .addCase(fetchCheckoutSettings.rejected, (state) => {
        state.settingsLoading = false;
        state.settingsError = 'Could not load checkout settings.';
      })
      // placeOrder's own pending/fulfilled/rejected already drive Razorpay + the reconcile callback
      // (all inside checkoutThunks.ts); this slice only mirrors the lifecycle into a loading flag and
      // the last failure, for the button and an inline error message.
      .addCase(placeOrder.pending, (state) => {
        state.isPlacingOrder = true;
        state.lastFailure = null;
      })
      .addCase(placeOrder.fulfilled, (state) => {
        state.isPlacingOrder = false;
      })
      .addCase(placeOrder.rejected, (state, action) => {
        state.isPlacingOrder = false;
        state.reconcile = null; // any open dialog is moot once the thunk has settled
        state.lastFailure = action.payload ?? {
          orderId: null,
          reason: 'server-error',
          message: 'Could not place your order. Please try again.',
        };
      })
      .addCase(confirmPayment.pending, (state) => {
        state.isConfirmingPayment = true;
      })
      .addCase(confirmPayment.fulfilled, (state) => {
        state.isConfirmingPayment = false;
      })
      .addCase(confirmPayment.rejected, (state) => {
        state.isConfirmingPayment = false;
      });
  },
});

export const { openReconcile, closeReconcile, clearFailure } = checkoutSlice.actions;
export default checkoutSlice.reducer;
