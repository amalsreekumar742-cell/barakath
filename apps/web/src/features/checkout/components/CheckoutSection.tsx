'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingBag, Truck } from 'lucide-react';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonText } from '@/components/Skeleton';
import { toastError } from '@/lib/toast';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useAddresses } from '@/features/address/hooks/useAddresses';
import { computeTotals } from '@/lib/commerce/totals';
import { CouponPanel } from '@/features/cart/components/CouponPanel';
import { placeOrder, confirmPayment, type PlaceOrderFailure } from '../api/checkoutThunks';
import { fetchCheckoutSettings, openReconcile, closeReconcile, clearFailure } from '../stores/checkoutSlice';
import { AddressBlock } from './AddressBlock';
import { PaymentMethodBlock } from './PaymentMethodBlock';
import { OrderSummaryBlock } from './OrderSummaryBlock';
import { ConfirmOrderDialog } from './ConfirmOrderDialog';
import { ReconcileDialog } from './ReconcileDialog';

/**
 * CheckoutSection — the whole `/checkout` screen (design: a standalone step reached from `/cart`'s
 * "Proceed to checkout" — see that page's doc comment on why this overrides spec §3.8's "Same Page
 * Flow" text): a two-column layout — delivery address / apply coupon / delivery method / payment
 * method cards on the left, order summary + "Place order · ₹X" in a sticky sidebar on the right. This
 * is the highest-stakes surface in this batch (real Razorpay payments), so every routing decision below
 * follows WEB_BATCH3_NOTES.md §6-§9 exactly rather than the (superseded) spec text on the payment
 * architecture — see this feature's `api/checkoutThunks.ts` for the full flow those notes describe.
 *
 * WHY this gates on auth while `/cart` doesn't: a visitor builds a bag before signing in, but PLACING
 * an order needs an identity `createPaymentOrder` can bill a wallet/address against — `/checkout` IS in
 * `middleware.ts`'s `PROTECTED_PREFIXES`, so a guest is redirected before this ever mounts; the inline
 * "Sign in to check out" card below is a defensive second layer for the brief pre-hydration window
 * (see `/checkout/page.tsx`'s doc comment), not the primary gate.
 */
export function CheckoutSection() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { requireAuth, isAuthenticated } = useRequireAuth();

  const uid = useAppSelector((s) => s.auth.uid);
  const user = useAppSelector((s) => s.auth.user);
  const cart = useAppSelector((s) => s.cart);
  const checkout = useAppSelector((s) => s.checkout);

  const { addresses, loading: addressesLoading, mutating, add, remove } = useAddresses(uid);

  const [showConfirm, setShowConfirm] = useState(false);
  // The reconcile dialog's promise resolver — a closure, not durable state, so it lives in a ref
  // rather than the Redux slice (see checkoutSlice.ts's header comment on this split).
  const reconcileResolveRef = useRef<((proceed: boolean) => void) | null>(null);

  // Load `general/config`'s delivery/payment settings once — computeTotals reads them for delivery
  // fee, GST% and whether wallet payments are enabled.
  useEffect(() => {
    dispatch(fetchCheckoutSettings());
  }, [dispatch]);

  // "First address added becomes default and auto-selected" — reflect whatever `useAddresses` already
  // resolved (the promotion rule itself lives in `features/address/api/addresses.ts`). Runs whenever
  // the address list changes and the current selection no longer points at a real address.
  useEffect(() => {
    if (addressesLoading || addresses.length === 0) return;
    if (cart.selectedAddressId && addresses.some((a) => a.id === cart.selectedAddressId)) return;
    const next = addresses.find((a) => a.isDefault) ?? addresses[0];
    if (!next) return; // unreachable given the length check above; guards `noUncheckedIndexedAccess`
    // Raw action type: `features/checkout` may not import `features/cart` (import/no-restricted-paths)
    // — same established pattern as `checkoutThunks.ts`'s `dispatch({ type: 'cart/clearCart' })` and
    // `AddAllButton.tsx`'s `cart/addItem`. `cartSlice`'s reducer name is `selectAddress`.
    dispatch({ type: 'cart/selectAddress', payload: next.id });
  }, [addresses, addressesLoading, cart.selectedAddressId, dispatch]);

  if (!isAuthenticated) {
    return (
      <section aria-label="Checkout" className="rounded-xl border border-border bg-surface p-8 text-center">
        <p className="font-display text-lg font-extrabold text-foreground">Sign in to check out</p>
        <p className="mt-1 text-sm text-muted">Your bag is saved — sign in to add a delivery address and pay.</p>
        <Button
          variant="primary"
          size="md"
          className="mt-4"
          onClick={() => requireAuth(() => {})}
        >
          Sign in
        </Button>
      </section>
    );
  }

  // `/checkout` is reachable directly (a bookmark, a back-navigation) with nothing to buy — a broken-
  // looking address/payment form is worse than sending the visitor back to build a bag first.
  if (!cart.isHydrating && cart.items.length === 0) {
    return (
      <section aria-label="Checkout" className="rounded-xl border border-border bg-surface">
        <EmptyState
          icon={<ShoppingBag size={40} />}
          title="Your bag is empty"
          subtitle="Add something to your bag before checking out."
        />
      </section>
    );
  }

  const totals = computeTotals({
    items: cart.items,
    coupon: cart.appliedCoupon,
    walletBalance: user?.walletBalance ?? 0,
    walletApplied: cart.walletApplied,
    generalSettings: checkout.settings,
  });
  const selectedAddress = addresses.find((a) => a.id === cart.selectedAddressId) ?? null;
  const isBusy = checkout.isPlacingOrder || checkout.isConfirmingPayment;
  const canPlaceOrder = cart.items.length > 0 && selectedAddress !== null && !isBusy;

  /** Resolves once the customer answers the reconcile dialog — handed to `placeOrder` as `onReconcileRequired`. */
  function onReconcileRequired(server: { amount: number; displayed: number }): Promise<boolean> {
    return new Promise((resolve) => {
      reconcileResolveRef.current = resolve;
      dispatch(openReconcile(server));
    });
  }

  function handleReconcileDecision(proceed: boolean) {
    reconcileResolveRef.current?.(proceed);
    reconcileResolveRef.current = null;
    dispatch(closeReconcile());
  }

  /** Runs the whole placeOrder -> (maybe Razorpay) -> confirmPayment sequence and routes on every outcome. */
  async function runCheckout() {
    if (!selectedAddress) return;
    dispatch(clearFailure());

    const placeResult = await dispatch(
      placeOrder({
        items: cart.items,
        addressId: selectedAddress.id,
        couponCode: cart.appliedCoupon?.code,
        prefill: {
          name: user?.fullName || undefined,
          contact: user?.phone || undefined,
          email: user?.email || undefined,
        },
        displayedTotals: totals,
        onReconcileRequired,
      }),
    );

    if (placeOrder.rejected.match(placeResult)) {
      const failure = placeResult.payload as PlaceOrderFailure | undefined;
      toastError(failure?.message, 'Could not place your order. Please try again.');
      if (failure?.orderId) router.push(`/payment-failed?orderId=${failure.orderId}`);
      return;
    }

    const { orderId, done, razorpaySuccess } = placeResult.payload;
    if (done) {
      router.push(`/order-success?orderId=${orderId}`);
      return;
    }
    if (!razorpaySuccess) {
      // Should not happen (checkoutThunks always pairs done:false with a razorpaySuccess), but a
      // missing value here has nothing safe left to confirm — surface it rather than guessing.
      toastError(null, 'Something went wrong confirming your payment. Please check My Orders.');
      router.push(`/payment-failed?orderId=${orderId}`);
      return;
    }

    const confirmResult = await dispatch(confirmPayment({ ...razorpaySuccess, orderId }));
    if (confirmPayment.rejected.match(confirmResult)) {
      toastError(confirmResult.payload, 'Could not confirm your payment.');
      router.push(`/payment-failed?orderId=${orderId}`);
      return;
    }

    // 'paid' -> success. 'confirming' -> ALSO success (WEB_BATCH3_NOTES.md §9 / spec 3.9: the success
    // page itself tolerates a still-settling order). 'failed' -> payment-failed.
    if (confirmResult.payload.status === 'failed') {
      router.push(`/payment-failed?orderId=${orderId}`);
    } else {
      router.push(`/order-success?orderId=${orderId}`);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px] lg:items-start">
      <section aria-label="Checkout" className="space-y-5">
        <div className="rounded-xl border border-border bg-surface p-5 md:p-6">
          <AddressBlock
            addresses={addresses}
            selectedId={cart.selectedAddressId}
            loading={addressesLoading}
            mutating={mutating}
            onSelect={(id) => dispatch({ type: 'cart/selectAddress', payload: id })}
            onAdd={async (values) => {
              await add(values);
            }}
            onDelete={remove}
          />
        </div>

        <div className="rounded-xl border border-border bg-surface p-5 md:p-6">
          <CouponPanel items={cart.items} appliedCoupon={cart.appliedCoupon} uid={uid} isAuthenticated={isAuthenticated} />
        </div>

        <div className="rounded-xl border border-border bg-surface p-5 md:p-6">
          {/* Delivery method — Standard only, informational (spec §2.13): a single fixed row, not a choice. */}
          <div className="mb-5">
            <h3 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-muted">Delivery method</h3>
            <div className="flex items-center gap-3 rounded-lg border border-border-strong bg-subtle p-4">
              <Truck size={18} className="shrink-0 text-primary" />
              <div>
                <p className="text-sm font-extrabold text-foreground">Standard delivery</p>
                <p className="text-xs text-muted">Delivered in 3–5 business days.</p>
              </div>
            </div>
          </div>

          {checkout.settingsLoading ? (
            <div className="space-y-2" aria-busy="true">
              <SkeletonText width="w-1/4" />
              <SkeletonText width="w-full" className="h-14" />
            </div>
          ) : (
            <PaymentMethodBlock
              walletPaymentsEnabled={checkout.settings?.payment.walletPaymentsEnabled ?? null}
              walletBalance={user?.walletBalance ?? 0}
              walletApplied={cart.walletApplied}
              onToggleWallet={() => dispatch({ type: 'cart/toggleWallet', payload: undefined })}
              razorpayAmount={totals.razorpayAmount}
              walletAmountUsed={totals.walletAmountUsed}
            />
          )}
        </div>
      </section>

      <aside className="space-y-3 lg:sticky lg:top-20">
        <OrderSummaryBlock
          totals={totals}
          couponCode={cart.appliedCoupon?.code ?? null}
          disabled={!canPlaceOrder}
          loading={isBusy}
          onPlaceOrder={() => setShowConfirm(true)}
        />

        {checkout.lastFailure?.reason === 'server-error' && (
          <p role="alert" className="text-sm font-bold text-error">
            {checkout.lastFailure.message}
          </p>
        )}
      </aside>

      <ConfirmOrderDialog
        isOpen={showConfirm}
        grandTotal={totals.grandTotal}
        addressLabel={selectedAddress ? `${selectedAddress.label} — ${selectedAddress.city}` : null}
        loading={isBusy}
        onConfirm={() => {
          setShowConfirm(false);
          void runCheckout();
        }}
        onCancel={() => setShowConfirm(false)}
      />

      <ReconcileDialog
        reconcile={checkout.reconcile}
        onContinue={() => handleReconcileDecision(true)}
        onCancel={() => handleReconcileDecision(false)}
      />
    </div>
  );
}
