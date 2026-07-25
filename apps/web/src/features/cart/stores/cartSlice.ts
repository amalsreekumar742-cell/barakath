import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { REHYDRATE } from 'redux-persist';
import { Constants } from '@/config/constants';
import type { CartItem, AppliedCoupon } from '@/types/cart';

/**
 * The bag and the checkout selections applied to it.
 *
 * WHY this replaces the earlier draft of this file (predates `WEB_BATCH3_NOTES.md`'s corrections,
 * written 2026-07-23 before the notes existed): that draft had `appliedSpinRewardCouponCode` as a
 * separate field, but §3 of the notes is explicit — a spin win IS an ordinary coupon (mints a normal
 * `coupons` doc with `createdBy` set to the winner), applied through the exact same `applyCoupon`
 * path as any other code. There is no `spinRewards` collection and no "stack a coupon + a spin
 * reward" rule to model — `createPaymentOrder` accepts exactly one `couponCode`. `AppliedCoupon`'s
 * `isSpinWon` flag (see `src/types/cart.ts`) is the only trace of "this came from a spin" the cart
 * needs, purely for a UI badge.
 *
 * WHY items carry NO trusted price: the client must never decide what something costs.
 * `createPaymentOrder` re-prices every line against the catalogue server-side and rejects the order
 * if stock disagrees. `unitPrice`/`mrp` here are display-only, so the bag can render before any
 * network round trip.
 *
 * WHY `walletApplied` is a boolean toggle, not a rupee amount: the amount that actually gets spent
 * (capped at the grand total, capped at the live wallet balance) is a DERIVED figure —
 * `lib/commerce/totals.ts`'s `walletAmountUsed` — computed fresh from the toggle plus whatever the
 * wallet balance is at render time. Storing a remembered rupee amount here would go stale the moment
 * the cart total changes and double as a second source of truth for money the server also computes.
 *
 * WHY `isHydrating`: the cart is persisted to `localStorage` (see `stores/store.ts`'s
 * `persistReducer` around this slice, keyed `Constants.STORAGE_KEY_CART`) rather than synced to
 * Firestore — confirmed against `apps/app/lib/features/cart/data/datasources/cart_local_datasource.dart`,
 * whose own header states "The cart lives entirely on-device"; there is no Firestore cart collection
 * or field anywhere in the schema for either client to sync through. `isHydrating` starts `true` so
 * the first paint (before `redux-persist` has read `localStorage`) never flashes an empty bag over a
 * guest's real one; it flips to `false` on redux-persist's `REHYDRATE` action, which fires exactly
 * once per load regardless of whether this slice is nested- or root-persisted.
 *
 * WHY the delivery rule is spelled out here rather than just in `lib/commerce/totals.ts`: it is the
 * one piece of money logic every consumer of `CartItem` needs to know is coming — a combo product's
 * charge REPLACES the standard fee (not adds to it), the LARGEST combo charge wins when several are
 * present, and the free-delivery threshold only applies when no combo charge is in play. Getting this
 * wrong shipped a wrong total in the Flutter app once already.
 */
export interface CartState {
  items: CartItem[];
  appliedCoupon: AppliedCoupon | null;
  walletApplied: boolean;
  selectedAddressId: string | null;
  isHydrating: boolean;
}

const initialState: CartState = {
  items: [],
  appliedCoupon: null,
  walletApplied: false,
  selectedAddressId: null,
  isHydrating: true,
};

/** A line is identified by product AND variant — the same perfume in 30ml and 100ml is two lines. */
const sameLine = (a: CartItem, productId: string, variantId: string) =>
  a.productId === productId && a.variantId === variantId;

/** Clamp a requested quantity to [1, min(CART_MAX_QTY, the stock snapshot at add-time)]. The stock
 *  snapshot is advisory only (fresher stock is re-checked server-side at checkout) — it exists purely
 *  so the stepper doesn't let a customer dial up to 10 of something that had 2 left when they added it. */
function clampQty(requested: number, stockAtAdd: number): number {
  const cap = Math.max(1, Math.min(Constants.CART_MAX_QTY, stockAtAdd || Constants.CART_MAX_QTY));
  return Math.min(cap, Math.max(1, Math.trunc(requested) || 1));
}

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    /** Add a line, or bump quantity if the same (product, variant) pair is already in the bag. */
    addItem(state, action: PayloadAction<CartItem>) {
      const existing = state.items.find((i) =>
        sameLine(i, action.payload.productId, action.payload.variantId),
      );
      if (existing) {
        existing.quantity = clampQty(existing.quantity + action.payload.quantity, existing.stockAtAdd);
      } else {
        state.items.push({ ...action.payload, quantity: clampQty(action.payload.quantity, action.payload.stockAtAdd) });
      }
    },
    /** Set a line's quantity directly (the ± stepper), clamped to [1, 10] (spec §2.11) — never removes
     *  the line at 0; that is `removeItem`'s job so "delete" is always an explicit, separate action. */
    updateQuantity(
      state,
      action: PayloadAction<{ productId: string; variantId: string; quantity: number }>,
    ) {
      const { productId, variantId, quantity } = action.payload;
      const line = state.items.find((i) => sameLine(i, productId, variantId));
      if (!line) return;
      line.quantity = clampQty(quantity, line.stockAtAdd);
    },
    removeItem(state, action: PayloadAction<{ productId: string; variantId: string }>) {
      state.items = state.items.filter(
        (i) => !sameLine(i, action.payload.productId, action.payload.variantId),
      );
    },
    /** After a successful order, or an explicit "empty my bag". Coupon/wallet/address selections are
     *  order-scoped, so they reset too — carrying them into the next bag would apply stale state. */
    clearCart() {
      return { ...initialState, isHydrating: false };
    },
    applyCoupon(state, action: PayloadAction<AppliedCoupon>) {
      state.appliedCoupon = action.payload;
    },
    removeCoupon(state) {
      state.appliedCoupon = null;
    },
    /** @param action Explicit true/false when the caller knows the target state; omitted to flip. */
    toggleWallet(state, action: PayloadAction<boolean | undefined>) {
      state.walletApplied = action.payload ?? !state.walletApplied;
    },
    selectAddress(state, action: PayloadAction<string | null>) {
      state.selectedAddressId = action.payload;
    },
  },
  extraReducers: (builder) => {
    // redux-persist dispatches this once rehydration completes (see store.ts's persistReducer around
    // this slice). The persisted values are already merged into `state` by the time this reducer body
    // runs — this case exists purely to flip the loading flag, not to copy any data.
    builder.addCase(REHYDRATE, (state) => {
      state.isHydrating = false;
    });
  },
});

export const {
  addItem,
  updateQuantity,
  removeItem,
  clearCart,
  applyCoupon,
  removeCoupon,
  toggleWallet,
  selectAddress,
} = cartSlice.actions;

export default cartSlice.reducer;
