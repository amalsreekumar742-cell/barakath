'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { XCircle } from 'lucide-react';
import { FirestoreCollections, type OrderProps } from '@barakath/shared';
import { db } from '@/lib/firebaseConfig';
import { Button } from '@/components/Button';
import { SkeletonText } from '@/components/Skeleton';

/**
 * /payment-failed?orderId=<id> — the terminal "it didn't work" screen (spec 3.21).
 *
 * WHY `orderId`, not `transactionId`: WEB_BATCH3_NOTES.md §9. There is no `transactionId` anywhere
 * in the schema and `payments/{paymentId}` is admin-read-only, so any "reason" worth showing has to
 * come from `orders/{orderId}` (owner-readable) — `cancelReason`/`paymentStatus`/`status`, never a
 * payment document.
 *
 * WHY the cart is NEVER cleared here (unlike order-success): the customer's items must still be in
 * the bag when they retry — this page does not import `features/cart` or dispatch any cart action.
 *
 * WHY the Paid-race guard exists: a genuine race is possible where the browser reaches this page via
 * Razorpay's dismiss/failure callback, but `verifyPayment` or the `razorpayWebhook` backstop settles
 * the SAME order as Paid moments later (checkoutThunks.ts / WEB_BATCH3_NOTES.md §7). Showing "payment
 * failed, no amount deducted" for an order that is in fact Paid would be actively wrong, not just
 * stale — so when `orderId` is present this page reads the order BEFORE rendering the failure
 * content at all, and redirects to `/order-success` if it turns out to have settled as Paid.
 */

const LOOKUP_RETRY_DELAYS_MS = [500]; // one retry — this page's own content is still useful without it

type ViewState = 'checking' | 'ready';

/**
 * WHY the Suspense wrapper: `useSearchParams()` (reading `?orderId=`) requires it so the route can
 * still prerender the shell — same pattern as `(auth)/login/page.tsx` and `order-success/page.tsx`.
 */
export default function PaymentFailedPage() {
  return (
    <Suspense fallback={<PaymentFailedSkeleton />}>
      <PaymentFailedContent />
    </Suspense>
  );
}

function PaymentFailedContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');

  const [state, setState] = useState<ViewState>(orderId ? 'checking' : 'ready');
  const [secondaryLine, setSecondaryLine] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;

    let cancelled = false;

    async function lookup() {
      for (let attempt = 0; attempt <= LOOKUP_RETRY_DELAYS_MS.length; attempt += 1) {
        if (cancelled) return;
        try {
          const snap = await getDoc(doc(db, FirestoreCollections.orders, orderId as string));
          if (snap.exists()) {
            const data = { ...snap.data(), id: snap.id } as OrderProps;
            if (cancelled) return;
            if (data.paymentStatus === 'Paid') {
              // The payment actually succeeded — never show a failure page for a Paid order.
              router.replace(`/order-success?orderId=${encodeURIComponent(data.id)}`);
              return;
            }
            setSecondaryLine(pickSecondaryLine(data));
            setState('ready');
            return;
          }
        } catch {
          // Reads can fail (permission-denied on a mismatched owner, a transient network error) —
          // this page's core content does not depend on the order, so degrade quietly.
        }
        if (attempt < LOOKUP_RETRY_DELAYS_MS.length) {
          await new Promise((r) => setTimeout(r, LOOKUP_RETRY_DELAYS_MS[attempt]));
        }
      }
      if (!cancelled) setState('ready');
    }

    lookup();
    return () => {
      cancelled = true;
    };
  }, [orderId, router]);

  if (state === 'checking') {
    return <PaymentFailedSkeleton />;
  }

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col items-center justify-center px-5 py-12 text-center">
      <span className="flex size-20 items-center justify-center rounded-full bg-error-subtle text-error">
        <XCircle className="size-10" strokeWidth={1.75} aria-hidden />
      </span>
      <h1 className="mt-6 font-display text-[28px] font-semibold tracking-tight text-foreground">
        Payment failed
      </h1>
      <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-muted">
        Your payment could not be processed. No amount has been deducted.
      </p>
      {secondaryLine && <p className="mt-1 max-w-sm text-sm text-faint">{secondaryLine}</p>}

      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <Button variant="primary" size="lg" onClick={() => router.push('/cart')}>
          Retry Payment
        </Button>
        <Link
          href="/cart"
          className="inline-flex h-12 items-center justify-center rounded-lg border border-border-strong bg-surface px-6 text-[15px] font-medium text-foreground transition hover:bg-subtle"
        >
          Back to Cart
        </Link>
      </div>
    </main>
  );
}

/**
 * A secondary line worth showing, or null. Must never contradict "no amount has been deducted" —
 * `cancelReason` is the only field that can carry customer-safe free text; `status`/`paymentStatus`
 * on their own would just restate "failed" in different words, so they are not surfaced here.
 */
function pickSecondaryLine(order: OrderProps): string | null {
  const reason = order.cancelReason?.trim();
  return reason ? reason : null;
}

function PaymentFailedSkeleton() {
  return (
    <main
      aria-busy="true"
      className="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col items-center justify-center px-5 py-12"
    >
      <div aria-hidden className="size-20 animate-pulse rounded-full bg-border" />
      <div className="mt-6 w-40">
        <SkeletonText width="w-full" className="h-6" />
      </div>
      <div className="mt-3 w-72">
        <SkeletonText />
      </div>
    </main>
  );
}
