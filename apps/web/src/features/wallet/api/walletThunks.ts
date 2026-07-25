import { createAsyncThunk } from '@reduxjs/toolkit';
import { httpsCallable } from 'firebase/functions';
import {
  collection,
  doc,
  getAggregateFromServer,
  getDoc,
  query,
  sum,
  where,
} from 'firebase/firestore';
import { FirestoreCollections, FirestoreDocs, WalletSource, type GeneralSettingsProps } from '@barakath/shared';
import { db, functions } from '@/lib/firebaseConfig';
import { CloudFunctions } from '@/config/cloudFunctions';
import { openCheckout, type RazorpaySuccessResponse } from '@/lib/commerce/razorpay';

/**
 * Wallet Cloud Function wrappers + non-paginated reads (Batch 4 brief §1-§2). The paginated ledger
 * itself lives in `./wallet.ts` (feeds `usePaginatedCollection` directly, per that hook's own pattern —
 * see `CouponWallet.tsx`); everything here is either a single-doc settings read, a server-side
 * aggregation, or a Cloud-Function-backed mutation, none of which that hook is built for.
 */

// ---- Store settings: general/config.payment.walletPaymentsEnabled ------------------------------

/**
 * Reads ONLY the one flag the wallet tab needs to gate "Add money" — same store-wide switch
 * `PaymentMethodBlock`/`computeTotals` read at checkout (`general/config.payment.walletPaymentsEnabled`,
 * WEB_BATCH3_NOTES.md §5), verified server-side again by `createWalletTopUpOrder` itself, so a client
 * that raced this read can never actually top up while the flag is off.
 *
 * WHY its own thunk rather than reusing `checkout/fetchCheckoutSettings`: `features/checkout` and
 * `features/wallet` may not import one another (no ESLint exception exists for that pair, and adding
 * one for a single boolean would be a wider hole than this feature needs) — the skill's "single source
 * of truth" is the `general/config` DOCUMENT, not any one feature's thunk reading it. A second, narrow
 * read of the same doc costs one extra Firestore read on this page, once.
 */
export const fetchWalletSettings = createAsyncThunk<boolean | null>('wallet/fetchSettings', async () => {
  const snap = await getDoc(doc(db, FirestoreCollections.general, FirestoreDocs.generalConfig));
  if (!snap.exists()) return null;
  const data = snap.data() as { payment?: GeneralSettingsProps['payment'] };
  return data.payment?.walletPaymentsEnabled ?? null;
});

// ---- Breakdown: Rewards + Refunds, both via sum() aggregation -----------------------------------

export interface WalletBreakdownResult {
  rewardsTotal: number;
  refundsTotal: number;
}

/**
 * Lifetime Rewards + Refunds, entirely server-side `sum()` aggregations — never a client loop over the
 * ledger (mandatory per the skill's aggregation-queries rule). Backed by the existing
 * `(userId ASC, type ASC, source ASC, amount ASC)` composite index in `firebase/firestore.indexes.json`
 * ("Wallet 'Rewards received' tile") — one index serves every source value since `source` is an
 * EQUALITY filter, so no new index is needed for the Refunds sum.
 *
 * WHY "Rewards" sums BOTH `Reward` and `Admin` sources, not `Reward` alone: this mirrors the reasoning
 * already written into this feature's own `walletSlice.ts` (present before this session) and the
 * Flutter app's identical choice (`wallet_remote_datasource.dart`'s `_rewardSources`) — an admin "Add
 * money" credit is the STORE handing the customer money, same as a spin win, as opposed to money the
 * customer added themselves (`UPI top-up`) or got back on a cancellation (`Refund`). `Refunds` is exactly
 * one source, `Refund`.
 *
 * WHY the real wire values (`WalletSource.REWARD` = 'Reward', not "Spin reward"; `WalletSource.REFUND` =
 * 'Refund'): the Batch 4 prompt text guessed `source: 'Spin reward'` for the Rewards sum. Checked live —
 * `functions/src/growth/spinWheel.ts` (and every other wallet-credit call site under `functions/src/`)
 * only ever writes `source: 'Reward'`; nothing has ever written `'Spin reward'`. A sum filtered on the
 * wrong string does not error — it silently returns 0, which is exactly the kind of bug this project's
 * batches keep finding. `packages/shared/src/config/enums.ts`'s own `WalletSource` map documents this.
 */
export const fetchWalletBreakdown = createAsyncThunk<WalletBreakdownResult, string>(
  'wallet/fetchBreakdown',
  async (uid) => {
    const sumFor = async (source: string) => {
      const snap = await getAggregateFromServer(
        query(
          collection(db, FirestoreCollections.walletTransactions),
          where('userId', '==', uid),
          where('type', '==', 'Credit'),
          where('source', '==', source),
        ),
        { total: sum('amount') },
      );
      return snap.data().total ?? 0;
    };

    const [rewardTotal, adminTotal, refundsTotal] = await Promise.all([
      sumFor(WalletSource.REWARD),
      sumFor(WalletSource.ADMIN),
      sumFor(WalletSource.REFUND),
    ]);

    return { rewardsTotal: rewardTotal + adminTotal, refundsTotal };
  },
);

// ---- Add money: createWalletTopUpOrder -> Razorpay Checkout -> verifyWalletTopUp ----------------

export interface TopUpResult {
  amount: number;
  newBalance: number;
}

export type TopUpFailureReason = 'dismissed' | 'payment-failed' | 'gateway-unavailable' | 'not-verified' | 'server-error';

export interface TopUpFailure {
  reason: TopUpFailureReason;
  message: string;
}

const TOP_UP_FAILURE_MESSAGES: Record<TopUpFailureReason, string> = {
  dismissed: 'Payment was not completed.',
  'payment-failed': 'Your payment could not be completed. No money was taken.',
  'gateway-unavailable': 'Could not load the payment gateway. Check your connection and try again.',
  'not-verified':
    'We could not confirm that payment. If money left your account it will be returned, or contact ' +
    'support with your payment id.',
  'server-error': 'Could not start the top-up. Please try again.',
};

interface CreateWalletTopUpOrderResponse {
  topUpId: string;
  razorpayOrderId: string;
  amount: number;
  key_id: string;
}

interface VerifyWalletTopUpResponse {
  verified: boolean;
  amount: number;
  newBalance: number;
}

/**
 * The whole "Add money" sequence (Batch 4 brief §2), verified against WEB_BATCH4_NOTES.md §7 rather
 * than the pasted prompt doc, which describes `createPaymentOrder` + `addWalletMoney` — NEITHER exists
 * for a customer top-up (`addWalletMoney` is admin-only, per `config/cloudFunctions.ts`'s own note).
 *
 * Step 1: `createWalletTopUpOrder({ amount })` — the server fixes the amount and opens a bare Razorpay
 *   order BEFORE any payment happens; nothing is credited yet.
 * Step 2: open Razorpay Checkout (C0's shared `openCheckout` loader — the same one checkout itself
 *   uses, not a second script tag) with the SERVER's `razorpayOrderId`/`amount`/`key_id`.
 * Step 3: on the SDK's success callback, `verifyWalletTopUp({...})` — HMAC-verifies server-side and,
 *   only on a valid signature, credits `walletBalance` and appends the ledger entry in one transaction.
 *   `{ verified: false }` is a normal 200 response (a bad signature), NOT a thrown error — checked
 *   explicitly here rather than assumed from a resolved promise.
 *
 * WHAT THIS THUNK DELIBERATELY DOES NOT DO: write `walletBalance` anywhere, or bump any Redux field with
 * the new balance. `AuthListener`'s `onSnapshot` on `users/{uid}` is the ONLY writer of the balance the
 * UI reads (`state.auth.user.walletBalance`) — an optimistic bump here would be a second writer for one
 * number, and the two would visibly disagree for the instant before the snapshot catches up.
 */
export const topUpWallet = createAsyncThunk<
  TopUpResult,
  { amount: number; prefill?: { name?: string; contact?: string; email?: string } },
  { rejectValue: TopUpFailure }
>('wallet/topUp', async ({ amount, prefill }, { rejectWithValue }) => {
  try {
    const orderCall = httpsCallable<{ amount: number }, CreateWalletTopUpOrderResponse>(
      functions,
      CloudFunctions.createWalletTopUpOrder,
    );
    const orderRes = await orderCall({ amount });
    const { razorpayOrderId, amount: serverAmount, key_id: keyId } = orderRes.data;

    const razorpaySuccess = await new Promise<RazorpaySuccessResponse>((resolve, reject) => {
      openCheckout({
        razorpayOrderId,
        keyId,
        // The SERVER's amount, never the value typed into the field — Razorpay rejects a Checkout
        // session whose amount differs from the order it was created against.
        amount: serverAmount,
        description: 'Wallet top-up',
        prefill,
        onSuccess: (response) => resolve(response),
        onDismiss: () => reject({ reason: 'dismissed' as const }),
        onFailure: () => reject({ reason: 'payment-failed' as const }),
      }).catch(() => reject({ reason: 'gateway-unavailable' as const }));
    });

    const verifyCall = httpsCallable<
      { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string },
      VerifyWalletTopUpResponse
    >(functions, CloudFunctions.verifyWalletTopUp);
    const verifyRes = await verifyCall({
      razorpay_order_id: razorpaySuccess.razorpay_order_id,
      razorpay_payment_id: razorpaySuccess.razorpay_payment_id,
      razorpay_signature: razorpaySuccess.razorpay_signature,
    });

    if (!verifyRes.data.verified) {
      return rejectWithValue({ reason: 'not-verified', message: TOP_UP_FAILURE_MESSAGES['not-verified'] });
    }

    return { amount: verifyRes.data.amount, newBalance: verifyRes.data.newBalance };
  } catch (err) {
    const reason = isKnownFailureReason(err) ? err.reason : 'server-error';
    return rejectWithValue({ reason, message: TOP_UP_FAILURE_MESSAGES[reason] });
  }
});

function isKnownFailureReason(err: unknown): err is { reason: TopUpFailureReason } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'reason' in err &&
    typeof (err as { reason: unknown }).reason === 'string'
  );
}
