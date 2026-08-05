'use client';

import { ShieldCheck } from 'lucide-react';
import { CheckoutSection } from '@/features/checkout/components/CheckoutSection';
import { CircleBackButton } from '@/components/CircleBackButton';

/**
 * /checkout — the design's standalone "Checkout" screen: `Bag · Checkout · Payment` breadcrumb (this
 * step bold) + "Secure checkout" branding, then `CheckoutSection`'s address/coupon/payment/summary
 * cards. "Payment" (the third breadcrumb step) is the Razorpay Checkout sheet itself — spec §2.15's
 * Razorpay architecture is a modal overlay, not a fourth route.
 *
 * Auth: protected at the edge (`middleware.ts`'s `PROTECTED_PREFIXES` includes `/checkout`) — a guest
 * is redirected to `/login?next=/checkout` before this ever renders, matching spec §2.4 ("Cannot: buy").
 * `CheckoutSection`'s own guest fallback stays as a defensive second layer for the brief window before
 * the client's Firebase auth state has rehydrated (see that component's doc comment).
 */
export default function CheckoutPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-6 md:px-10">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <ol className="flex items-center gap-1.5 text-[13px] font-medium text-muted" aria-label="Checkout progress">
          <li>Bag</li>
          <li aria-hidden="true">·</li>
          <li aria-current="step" className="text-foreground">
            Checkout
          </li>
          <li aria-hidden="true">·</li>
          <li>Payment</li>
        </ol>
        <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted">
          <ShieldCheck size={15} className="text-success" />
          Secure checkout
        </span>
      </div>

      {/* No Breadcrumb on this page, and the bottom nav is deliberately hidden mid-payment
          (mobileNavRoutes.NAV_HIDDEN_ON) — so without this the only way out on a phone is the
          browser's own gesture. */}
      <div className="mb-5 flex items-center gap-3">
        <CircleBackButton href="/cart" className="lg:hidden" />
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">Checkout</h1>
      </div>

      <CheckoutSection />
    </main>
  );
}
