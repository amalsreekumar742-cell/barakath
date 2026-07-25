'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { doc, getDoc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { FirestoreCollections, type OrderProps } from '@barakath/shared';
import { db } from '@/lib/firebaseConfig';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import { Button } from '@/components/Button';
import { SkeletonText } from '@/components/Skeleton';

/**
 * /order-success?orderId=<id> — the terminal "it worked" screen (spec 3.9).
 *
 * WHY `orderId`, not `transactionId`, and why this reads `orders/{orderId}` directly rather than a
 * payment document: WEB_BATCH3_NOTES.md §7–§9 — `payments/{paymentId}` is admin-read-only, so a
 * client subscription to it would hang on a permission-denied error forever. `orders/{orderId}` is
 * owner-readable and already carries `paymentStatus`, which is everything this page needs.
 *
 * WHY a retry-then-redirect on not-found rather than an immediate redirect: `checkoutThunks.ts`
 * routes here the instant `createPaymentOrder`/`confirmPayment` resolve, but the order was written
 * moments earlier in a different request — a Firestore read-after-write can lag by a beat. A hard
 * "not found" on the very screen meant to reassure the customer their order went through would be a
 * bad first impression for something that resolves itself within a second or two.
 *
 * WHY the cart is cleared unconditionally on mount via a raw action type: `placeOrder`/`confirmPayment`
 * already clear it on their own success paths, but a customer who lands here via a shared link, a
 * refresh, or the webhook-fallback race might not have gone through either path in this tab. Clearing
 * an already-empty cart is a no-op (`cartSlice.ts`), so calling it unconditionally is safe, and this is
 * the one place guaranteed to run exactly once whenever this page is genuinely reached. Dispatched by
 * raw type — not the `clearCart` action creator — because `(checkout)` route files may not import
 * `features/cart` (the same cross-feature-import boundary `checkoutThunks.ts` already works around).
 *
 * NO INVOICE DOWNLOAD HERE — spec 3.9 explicitly removed it from this page; invoices only become
 * available once an order reaches Delivered. NO "arrives by" row either: `OrderProps` has no ETA-type
 * field (checked against `packages/shared/src/types/order.ts`), so one is omitted rather than invented.
 */

const NOT_FOUND_RETRY_DELAYS_MS = [400, 800]; // 3 attempts total (initial + these 2)
const CONFIRM_SOFT_TIMEOUT_MS = 60_000; // matches checkoutThunks.ts's own CONFIRM_TIMEOUT_MS

type ViewState = 'loading' | 'confirming' | 'ready' | 'redirecting';

/**
 * WHY the Suspense wrapper: `useSearchParams()` (reading `?orderId=`) requires it so the route can
 * still prerender the shell — same pattern as `(auth)/login/page.tsx`. Invisible in practice since
 * `OrderSuccessContent` renders a skeleton immediately anyway.
 */
export default function OrderSuccessPage() {
  return (
    <Suspense fallback={<OrderSuccessSkeleton />}>
      <OrderSuccessContent />
    </Suspense>
  );
}

function OrderSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const dispatch = useAppDispatch();
  const uid = useAppSelector((s) => s.auth.uid);
  const authLoading = useAppSelector((s) => s.auth.authLoading);

  const [order, setOrder] = useState<OrderProps | null>(null);
  const [state, setState] = useState<ViewState>('loading');
  const [confirmTimedOut, setConfirmTimedOut] = useState(false);
  const cartCleared = useRef(false);

  // Clear the cart exactly once per mount, unconditionally — see header comment.
  useEffect(() => {
    if (cartCleared.current) return;
    cartCleared.current = true;
    dispatch({ type: 'cart/clearCart' });
  }, [dispatch]);

  const redirectAway = useCallback(() => {
    setState('redirecting');
    router.replace('/account/orders');
  }, [router]);

  useEffect(() => {
    if (!orderId) {
      redirectAway();
      return;
    }
    // Wait for auth to resolve before deciding anything ownership-related — `uid` reads null for a
    // beat on every load, signed in or not, until AuthListener reports.
    if (authLoading) return;
    if (!uid) {
      redirectAway();
      return;
    }

    let cancelled = false;
    let unsubscribe: Unsubscribe | null = null;
    let confirmTimeoutHandle: ReturnType<typeof setTimeout> | null = null;

    function handleOrder(data: OrderProps) {
      if (cancelled) return;
      if (data.userId !== uid) {
        redirectAway();
        return;
      }
      if (data.paymentStatus === 'Failed') {
        // Defensive: this route should only ever be reached on success, but a stale/shared link
        // could land here after the order later settled as Failed. Never show a false "it worked".
        setState('redirecting');
        router.replace(`/payment-failed?orderId=${encodeURIComponent(data.id)}`);
        return;
      }
      if (data.paymentStatus === 'Pending') {
        setOrder(data);
        setState('confirming');
        subscribeToSettlement(data.id);
        return;
      }
      setOrder(data);
      setState('ready');
    }

    function subscribeToSettlement(id: string) {
      confirmTimeoutHandle = setTimeout(() => {
        if (!cancelled) setConfirmTimedOut(true);
      }, CONFIRM_SOFT_TIMEOUT_MS);

      unsubscribe = onSnapshot(
        doc(db, FirestoreCollections.orders, id),
        (snap) => {
          if (cancelled || !snap.exists()) return;
          const data = { ...snap.data(), id: snap.id } as OrderProps;
          if (data.paymentStatus === 'Paid') {
            setOrder(data);
            setState('ready');
            if (confirmTimeoutHandle) clearTimeout(confirmTimeoutHandle);
            unsubscribe?.();
          } else if (data.paymentStatus === 'Failed') {
            if (confirmTimeoutHandle) clearTimeout(confirmTimeoutHandle);
            unsubscribe?.();
            setState('redirecting');
            router.replace(`/payment-failed?orderId=${encodeURIComponent(id)}`);
          }
          // else still Pending — keep waiting, keep showing "confirming".
        },
        () => {
          // A listener error is not a payment failure — leave the "confirming" state up; the soft
          // timeout below still fires and gives the customer a way forward.
        },
      );
    }

    async function loadWithRetry() {
      for (let attempt = 0; attempt <= NOT_FOUND_RETRY_DELAYS_MS.length; attempt += 1) {
        if (cancelled) return;
        try {
          const snap = await getDoc(doc(db, FirestoreCollections.orders, orderId as string));
          if (snap.exists()) {
            handleOrder({ ...snap.data(), id: snap.id } as OrderProps);
            return;
          }
        } catch {
          // A transient read error is treated the same as not-found-yet — retry, then give up.
        }
        if (attempt < NOT_FOUND_RETRY_DELAYS_MS.length) {
          await new Promise((r) => setTimeout(r, NOT_FOUND_RETRY_DELAYS_MS[attempt]));
        }
      }
      if (!cancelled) redirectAway();
    }

    loadWithRetry();

    return () => {
      cancelled = true;
      unsubscribe?.();
      if (confirmTimeoutHandle) clearTimeout(confirmTimeoutHandle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- redirectAway closes over a stable router; re-running this effect on every render would restart the retry/subscription loop.
  }, [orderId, uid, authLoading]);

  if (state === 'confirming' && order) {
    return (
      <main className="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col items-center justify-center px-5 text-center">
        <span className="flex size-20 items-center justify-center rounded-full bg-primary-subtle text-primary">
          <Loader2 className="size-9 animate-spin" aria-hidden />
        </span>
        <h1 className="mt-6 font-display text-2xl font-semibold text-foreground">
          Confirming your payment
        </h1>
        <p className="mt-2 max-w-sm text-sm text-muted">
          {confirmTimedOut
            ? "This is taking longer than usual — your order is safe. Check My Orders shortly for the final status."
            : "Hang tight — we're confirming your payment with the bank. This only takes a moment."}
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Button variant="secondary" size="lg" onClick={() => router.push('/account/orders')}>
            Go to My Orders
          </Button>
        </div>
      </main>
    );
  }

  if (state === 'ready' && order) {
    const reference = `#${order.id.slice(0, 8)}`;
    return (
      <main className="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col items-center justify-center px-5 py-12 text-center">
        <span className="flex size-20 items-center justify-center rounded-full bg-primary-subtle text-primary">
          <CheckCircle2 className="size-10" strokeWidth={1.75} aria-hidden />
        </span>
        <h1 className="mt-6 font-display text-[28px] font-semibold tracking-tight text-foreground">
          Order placed
        </h1>
        <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-muted">
          We&apos;ll notify you as your Barakath order makes its way to you.
        </p>

        <div className="mt-8 w-full rounded-lg border border-border bg-surface p-6 text-left">
          <Row label="Order ID" value={reference} valueClassName="font-medium text-foreground" />
          <Row
            label="Amount paid"
            value={`₹${order.grandTotal.toFixed(2)}`}
            valueClassName="font-display font-semibold text-gold-strong"
          />
        </div>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Button variant="primary" size="lg" onClick={() => router.push(`/account/orders/${order.id}/track`)}>
            Track order
          </Button>
          <Link
            href="/"
            className="inline-flex h-12 items-center justify-center rounded-lg border border-border-strong bg-surface px-6 text-[15px] font-medium text-foreground transition hover:bg-subtle"
          >
            Continue shopping
          </Link>
        </div>
      </main>
    );
  }

  return <OrderSuccessSkeleton />;
}

function Row({
  label,
  value,
  valueClassName = '',
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-muted">{label}</span>
      <span className={valueClassName}>{value}</span>
    </div>
  );
}

function OrderSuccessSkeleton() {
  return (
    <main
      aria-busy="true"
      className="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col items-center justify-center px-5 py-12"
    >
      <div aria-hidden className="size-20 animate-pulse rounded-full bg-border" />
      <div className="mt-6 w-48">
        <SkeletonText width="w-full" className="h-6" />
      </div>
      <div className="mt-3 w-64">
        <SkeletonText />
      </div>
      <div className="mt-8 w-full space-y-3 rounded-lg border border-border bg-surface p-6">
        <SkeletonText />
        <SkeletonText width="w-2/3" />
      </div>
    </main>
  );
}
