import { createAsyncThunk } from '@reduxjs/toolkit';
import { httpsCallable } from 'firebase/functions';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared';
import type { OrderProps } from '@barakath/shared';
import { db, functions } from '@/lib/firebaseConfig';
import { readableMessage } from '@/lib/toast';
import { CloudFunctions } from '@/config/cloudFunctions';
import { openCheckout, type RazorpaySuccessResponse } from '@/lib/commerce/razorpay';
import type { TotalsBreakdown } from '@/lib/commerce/totals';
import type { CartItem } from '@/types/cart';

/**
 * Order placement — the ONE callable for both payment paths (WEB_BATCH3_NOTES.md §6). There is no
 * separate `walletOnlyOrder` function: `createPaymentOrder` prices the cart, reserves stock, spends
 * the coupon and debits the wallet, and creates the `orders/{orderId}` document itself, all inside one
 * transaction, BEFORE a Razorpay order is even opened. It returns `razorpayOrderId: null` when the
 * wallet covered the whole total (order already `Paid`) or a real Razorpay order id when a balance
 * remains (order `Pending`, awaiting `confirmPayment`).
 *
 * WHY these thunks live in `features/checkout/api/` and not a global `src/store/`: this repo's
 * established convention (see `WEB_BATCH1_NOTES.md`/the react-nextjs skill, and every other feature
 * already in this repo) is `features/<feature>/api/` for Firestore reads + Cloud Function wrappers,
 * with the feature's OWN `stores/` slice consuming them via `extraReducers`. C0 builds this api layer;
 * C2 owns `features/checkout/stores/checkoutSlice.ts` and the UI that dispatches these.
 *
 * WHY `CartItem`/`RazorpaySuccessResponse`/`TotalsBreakdown` cross into this file without violating
 * the no-cross-feature-import ESLint rule: `CartItem` lives in `src/types/cart.ts` (shared, not inside
 * `features/cart`), and the other two are shared libs (`lib/commerce/*`) — see `src/types/cart.ts`'s
 * header comment for why that split exists.
 */

// ---- createPaymentOrder ------------------------------------------------------------------------

interface CreatePaymentOrderResponse {
  orderId: string;
  razorpayOrderId: string | null;
  amount: number;
  key_id: string;
}

export interface PlaceOrderArgs {
  items: CartItem[];
  addressId: string;
  /** Omit for no coupon applied. */
  couponCode?: string;
  /** The customer's contact info for Razorpay's prefill — never used to decide identity or amount. */
  prefill?: { name?: string; contact?: string; email?: string };
  /** What the UI showed just before the customer tapped Pay — the reconciliation baseline. */
  displayedTotals: TotalsBreakdown;
  /**
   * Called ONLY when a Razorpay payment is still due AND the server's `amount` differs materially
   * (> 50 paisa) from `displayedTotals.razorpayAmount` — e.g. a coupon expired or a price changed
   * between page load and checkout. Must resolve `true` to continue to Razorpay with the server's real
   * amount, or `false` to abandon (the thunk then discards the Pending draft `createPaymentOrder`
   * already created, releasing its reservations). Omit to always proceed silently. NEVER called for a
   * wallet-only order: that one is already a real, Paid order by the time the response arrives, so
   * there is nothing a "Cancel" could undo — see `placeOrder`.
   *
   * WHY a callback function is an acceptable thunk argument in THIS store specifically: `stores/
   * store.ts`'s `serializableCheck.isSerializable` override treats any non-plain-object value
   * (including a function) as serializable — documented there. A different app's default RTK
   * serializableCheck would flag this; here it is a deliberate, already-existing exception.
   */
  onReconcileRequired?: (server: { amount: number; displayed: number }) => Promise<boolean>;
}

export interface PlaceOrderResult {
  orderId: string;
  /** true = the wallet covered the whole total; the order is already `Paid`, nothing left to confirm. */
  done: boolean;
  /** Present only when `done` is false — hand this straight to `confirmPayment`. */
  razorpaySuccess: RazorpaySuccessResponse | null;
}

export type PlaceOrderFailureReason =
  | 'reconcile-declined'
  | 'dismissed'
  | 'payment-failed'
  | 'gateway-unavailable'
  | 'server-error';

export interface PlaceOrderFailure {
  /** Non-null whenever `createPaymentOrder` itself succeeded — the order exists (Pending, stock
   *  reserved) even though payment did not complete. The caller routes to
   *  `/payment-failed?orderId=<id>` for every reason except `server-error` (order was never created). */
  orderId: string | null;
  reason: PlaceOrderFailureReason;
  message: string;
}

const FAILURE_MESSAGES: Record<PlaceOrderFailureReason, string> = {
  'reconcile-declined': 'Order not placed — the amount changed and you chose not to continue.',
  dismissed: 'Payment was not completed.',
  'payment-failed': 'Your payment could not be completed. You have not been charged.',
  'gateway-unavailable': 'Could not load the payment gateway. Check your connection and try again.',
  'server-error': 'Could not place your order. Please try again.',
};

/**
 * Places the order (wallet-only or Razorpay) and, when a Razorpay leg remains, opens Checkout and
 * waits for the browser-side outcome. Never clears the cart itself on the Razorpay-pending path — only
 * on a path that reached a genuinely final state (`done: true` here, or `confirmPayment`'s `'paid'`).
 */
export const placeOrder = createAsyncThunk<PlaceOrderResult, PlaceOrderArgs, { rejectValue: PlaceOrderFailure }>(
  'checkout/placeOrder',
  async (args, { dispatch, rejectWithValue }) => {
    let orderId: string | null = null;
    try {
      const call = httpsCallable<
        {
          items: { productId: string; variantId: string; quantity: number }[];
          addressId: string;
          couponCode?: string;
          walletAmountToUse?: number;
        },
        CreatePaymentOrderResponse
      >(functions, CloudFunctions.createPaymentOrder);

      const walletAmountToUse = args.displayedTotals.walletAmountUsed;
      const res = await call({
        items: args.items.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity })),
        addressId: args.addressId,
        ...(args.couponCode ? { couponCode: args.couponCode } : {}),
        ...(walletAmountToUse > 0 ? { walletAmountToUse } : {}),
      });
      const { orderId: newOrderId, razorpayOrderId, amount, key_id } = res.data;
      orderId = newOrderId;

      // WALLET-ONLY FIRST, before any reconcile prompt. No Razorpay order means the wallet covered the
      // whole total and `createPaymentOrder` has ALREADY written a real `orders/{orderId}` document,
      // `Paid`, with the wallet debited inside the same transaction — there is no draft left to
      // discard. Offering "Cancel order" here used to call `discardOrderDraft` (which can't touch a
      // real order), report "Order not placed", and leave the customer debited for an order they were
      // told didn't exist. Nothing needs confirming either: the server debits at most the
      // `walletAmountToUse` the screen showed and collects ₹0 by Razorpay, so the customer can only
      // have paid what they agreed to or less (the mismatch here is a price that DROPPED far enough for
      // the wallet to cover it all).
      //
      // `!razorpayOrderId` rather than `=== null`: the callable documents `null`, but the order doc
      // itself stores `''` for the same case — either way there is no payment leg to open.
      //
      // Clear the cart HERE (not left to the consuming slice) so it happens exactly once, at the moment
      // success is certain. Dispatched by RAW action type (not the `clearCart` action creator) because
      // `features/checkout` may not import `features/cart` — the same cross-feature-import boundary
      // `ProductExperience.tsx` already works around for `cart/addItem`. `cartSlice`'s type is stable
      // (`createSlice({ name: 'cart', ... })` always produces `'cart/clearCart'`).
      if (!razorpayOrderId) {
        dispatch({ type: 'cart/clearCart' });
        return { orderId, done: true, razorpaySuccess: null };
      }

      // RECONCILE (Razorpay leg only): what exists at this point is an `orderDrafts` document with its
      // stock/coupon/wallet reservations held — not yet an order. This step decides whether to CONTINUE
      // to payment for the server's real amount; declining discards the draft (`releaseOrder`) so the
      // reservations come back immediately instead of waiting for `expireUnpaidOrders`.
      const materiallyDifferent = Math.abs(args.displayedTotals.razorpayAmount - amount) > 0.5;
      if (materiallyDifferent && args.onReconcileRequired) {
        const proceed = await args.onReconcileRequired({ amount, displayed: args.displayedTotals.razorpayAmount });
        if (!proceed) {
          await releaseOrder(orderId);
          return rejectWithValue({ orderId, reason: 'reconcile-declined', message: FAILURE_MESSAGES['reconcile-declined'] });
        }
      }

      const razorpaySuccess = await new Promise<RazorpaySuccessResponse>((resolve, reject) => {
        openCheckout({
          razorpayOrderId,
          keyId: key_id,
          amount,
          prefill: args.prefill,
          onSuccess: (response) => resolve(response),
          onDismiss: () => reject({ reason: 'dismissed' as const }),
          onFailure: () => reject({ reason: 'payment-failed' as const }),
        }).catch(() => reject({ reason: 'gateway-unavailable' as const }));
      });

      return { orderId, done: false, razorpaySuccess };
    } catch (err) {
      if (isKnownFailureReason(err)) {
        // The customer walked away without ever attempting payment — release the order NOW rather
        // than leaving it to expireUnpaidOrders' 10-minute sweep, which would hold their items (and
        // everyone else's chance to buy them) for no reason.
        //
        // Only for the two reasons where NO payment was attempted: 'dismissed' (sheet closed) and
        // 'gateway-unavailable' (the sheet never opened). Deliberately NOT for 'payment-failed' — an
        // actual declined attempt means Razorpay WILL send a payment.failed webhook, which performs
        // the very same reversal; cancelling here too would restore the stock twice.
        if (orderId && (err.reason === 'dismissed' || err.reason === 'gateway-unavailable')) {
          await releaseOrder(orderId);
        }
        return rejectWithValue({ orderId, reason: err.reason, message: FAILURE_MESSAGES[err.reason] });
      }
      // A rejected createPaymentOrder/cancelOrder call — its HttpsError message is already written for
      // the customer ("Only 2 left of X", "You have already used this coupon"), so surface it verbatim
      // instead of the generic fallback.
      return rejectWithValue({
        orderId,
        reason: 'server-error',
        message: readableMessage(err) ?? FAILURE_MESSAGES['server-error'],
      });
    }
  },
);

/**
 * Cancel an order the customer abandoned, giving back its reserved stock, coupon slot and wallet
 * debit immediately instead of waiting for `expireUnpaidOrders`.
 *
 * Best-effort by design: from the customer's point of view walking away has already succeeded, and a
 * failed release is not something they can act on. `cancelOrder` refuses anything that is not still
 * Pending, so this can never cancel an order that turned out to be paid; and if the call is lost the
 * 10-minute sweep is still the backstop.
 */
async function releaseOrder(orderId: string): Promise<void> {
  try {
    // `discardOrderDraft`, not `cancelOrder`: an unpaid checkout is an `orderDrafts` document that
    // has never been an order. The function re-checks ownership and that the draft is still Pending
    // inside its own transaction — so a payment that landed a beat before the sheet closed is left
    // for the webhook to settle rather than having its reservation pulled out from under it.
    await httpsCallable(functions, CloudFunctions.discardOrderDraft)({ orderId });
  } catch {
    // Swallowed on purpose — see above.
  }
}

function isKnownFailureReason(err: unknown): err is { reason: PlaceOrderFailureReason } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'reason' in err &&
    typeof (err as { reason: unknown }).reason === 'string'
  );
}

// ---- verifyPayment + the orders/{orderId} fallback ---------------------------------------------

export type ConfirmPaymentStatus = 'paid' | 'confirming' | 'failed';

export interface ConfirmPaymentResult {
  orderId: string;
  status: ConfirmPaymentStatus;
}

const CONFIRM_TIMEOUT_MS = 60_000;

/**
 * The client's handoff right after Razorpay's success callback. Calls `verifyPayment`
 * (HMAC-verifies the signature server-side and flips the order to `Paid` synchronously on success —
 * this is the fast path and normally resolves before any Firestore read is needed).
 *
 * `{ verified: false }` is a real 200 response meaning the signature did NOT match — per
 * WEB_BATCH3_NOTES.md §7 this is "something is wrong", not "still processing", so it resolves as
 * `'failed'` directly rather than falling into the onSnapshot fallback.
 *
 * A THROWN error (network drop, function timeout — genuinely NOT a signature mismatch) falls back to
 * watching `orders/{orderId}` until `paymentStatus` leaves `'Pending'`, because `razorpayWebhook` is
 * the authoritative backstop that will eventually settle it either way. Soft-timeout at 60s into
 * `'confirming'`, never an error — the payment may still complete via the webhook after the UI stops
 * watching.
 *
 * WHY `orders/{orderId}`, never `payments/{paymentId}`: `payments` is `allow read: if isAdmin()` only
 * (WEB_BATCH3_NOTES.md §8) — a client `onSnapshot` on it would be permission-denied and hang forever,
 * which is worse than an error. `orders/{orderId}` is owner-readable and carries `paymentStatus`.
 */
export const confirmPayment = createAsyncThunk<
  ConfirmPaymentResult,
  RazorpaySuccessResponse & { orderId: string },
  { rejectValue: string }
>('checkout/confirmPayment', async (args, { dispatch }) => {
  try {
    const call = httpsCallable<
      { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string },
      { verified: boolean; orderId?: string }
    >(functions, CloudFunctions.verifyPayment);
    const res = await call({
      razorpay_order_id: args.razorpay_order_id,
      razorpay_payment_id: args.razorpay_payment_id,
      razorpay_signature: args.razorpay_signature,
    });

    if (res.data.verified) {
      const orderId = res.data.orderId ?? args.orderId;
      // See placeOrder's matching comment on why this is a raw action type, not an imported creator.
      dispatch({ type: 'cart/clearCart' });
      return { orderId, status: 'paid' };
    }
    return { orderId: args.orderId, status: 'failed' };
  } catch {
    // A genuine call failure (not a signature mismatch) — fall back to the webhook backstop.
    const result = await awaitOrderSettled(args.orderId);
    if (result.status === 'paid') dispatch({ type: 'cart/clearCart' });
    return result;
  }
});

/**
 * Wait for the checkout to settle, or 60s.
 *
 * TWO listeners, because success and failure now live in different collections. Until payment
 * succeeds the checkout is an `orderDrafts` document; `orders/{orderId}` does not exist at all. So:
 *   - success = the ORDER appearing (promoteDraftToOrder creates it already `Paid`);
 *   - failure = the DRAFT going `Failed`/`Cancelled`, which is where a declined or released checkout
 *     ends up and where no order will ever be created.
 * Watching only `orders` would leave a genuine failure spinning until the soft timeout.
 */
function awaitOrderSettled(orderId: string): Promise<ConfirmPaymentResult> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (status: ConfirmPaymentStatus) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutHandle);
      unsubscribeOrder();
      unsubscribeDraft();
      resolve({ orderId, status });
    };

    const timeoutHandle = setTimeout(() => finish('confirming'), CONFIRM_TIMEOUT_MS);

    const unsubscribeOrder = onSnapshot(
      doc(db, FirestoreCollections.orders, orderId),
      (snap) => {
        const data = snap.data() as OrderProps | undefined;
        if (!data) return; // not promoted yet — the draft listener may still resolve this
        if (data.paymentStatus === 'Paid') finish('paid');
        else if (data.paymentStatus === 'Failed') finish('failed');
      },
      () => finish('confirming'), // a listener error is not a payment failure — surface as "still confirming"
    );

    const unsubscribeDraft = onSnapshot(
      doc(db, FirestoreCollections.orderDrafts, orderId),
      (snap) => {
        const data = snap.data() as OrderProps | undefined;
        if (!data) return; // gone means promoted — the order listener handles it
        if (data.paymentStatus === 'Failed' || data.status === 'Cancelled') finish('failed');
      },
      () => {
        /* ignore — the order listener is the one that decides success */
      },
    );
  });
}
