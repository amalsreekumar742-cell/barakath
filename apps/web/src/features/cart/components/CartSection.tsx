'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ChevronRight, ShoppingBag, Tag } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { SkeletonText } from '@/components/Skeleton';
import { toastSuccess } from '@/lib/toast';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { computeTotals } from '@/lib/commerce/totals';
import type { CartItem } from '@/types/cart';
import { removeItem, updateQuantity } from '../stores/cartSlice';
import { CartItemRow } from './CartItemRow';
import { OrderSummary } from './OrderSummary';
import { useLiveStock, lineKey } from './useLiveStock';
import { useCartGeneralSettings } from './useCartGeneralSettings';

/** One bag-row silhouette, matching `CartItemRow`'s real shape (thumbnail + two text lines + a
 *  stepper-width bar) — the Loading State Policy requires a skeleton shaped like the content it
 *  precedes, not a generic spinner. */
function CartRowSkeleton() {
  return (
    <div className="flex gap-4 border-b border-border py-4 last:border-b-0" aria-hidden>
      <div className="size-20 shrink-0 animate-pulse rounded-lg bg-border" />
      <div className="flex-1 space-y-2.5 pt-1">
        <SkeletonText width="w-2/3" />
        <SkeletonText width="w-1/3" />
        <SkeletonText width="w-1/4" className="h-8" />
      </div>
    </div>
  );
}

/**
 * CartSection — the whole `/cart` ("Your bag") screen (spec 2.11): a two-column layout — item list
 * with live stock re-validation on the left, a coupon summary + order summary + "Proceed to checkout"
 * sidebar on the right (design: a standalone screen, not fused with checkout — see `/cart/page.tsx`).
 *
 * WHY the full coupon-apply UI (code entry, eligible/locked lists) is NOT here: the design puts that
 * on the Checkout screen (`CouponPanel`, now rendered by `CheckoutSection`) — this screen only shows
 * a compact summary (applied coupon, or a link into checkout to apply one), matching the design's
 * collapsed "Apply a coupon →" row. `appliedCoupon` itself still lives in the shared `cart` Redux slice,
 * so this screen's own order summary reflects it correctly regardless of which screen applied it.
 *
 * WHY this stays mounted for guests: spec — a visitor builds a bag before signing in (the cart
 * persists to `localStorage` regardless of auth state, per `cartSlice.ts`) — `/cart` is deliberately
 * NOT in `middleware.ts`'s `PROTECTED_PREFIXES`. Only "Proceed to checkout" requires sign-in
 * (`useRequireAuth`), matching how `ProductExperience`'s "Add to bag" gates one action on an otherwise
 * browsable page.
 */
export function CartSection() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { requireAuth } = useRequireAuth();

  const items = useAppSelector((s) => s.cart.items);
  const appliedCoupon = useAppSelector((s) => s.cart.appliedCoupon);
  const walletApplied = useAppSelector((s) => s.cart.walletApplied);
  const isHydrating = useAppSelector((s) => s.cart.isHydrating);
  const walletBalance = useAppSelector((s) => s.auth.user?.walletBalance ?? 0);

  const { stockByKey, isChecking } = useLiveStock(items);
  const { generalSettings, loading: settingsLoading } = useCartGeneralSettings();

  const [itemPendingRemoval, setItemPendingRemoval] = useState<CartItem | null>(null);
  const [removing, setRemoving] = useState(false);

  const sectionLoading = isHydrating || isChecking;

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const hasOutOfStockItem = items.some((i) => stockByKey[lineKey(i.productId, i.variantId)] === 0);
  // Lines excluded from money math the moment their live stock reads 0 — spec: greyed + kept, never
  // auto-removed, but never counted toward what the customer would pay either.
  const inStockItems = items.filter((i) => stockByKey[lineKey(i.productId, i.variantId)] !== 0);

  const totals = computeTotals({
    items: inStockItems,
    coupon: appliedCoupon,
    walletBalance,
    walletApplied,
    generalSettings,
  });

  function onQuantityChange(item: CartItem, quantity: number) {
    dispatch(updateQuantity({ productId: item.productId, variantId: item.variantId, quantity }));
  }

  function onConfirmRemove() {
    if (!itemPendingRemoval) return;
    setRemoving(true);
    try {
      dispatch(
        removeItem({ productId: itemPendingRemoval.productId, variantId: itemPendingRemoval.variantId }),
      );
      toastSuccess('Removed from bag.');
      setItemPendingRemoval(null);
    } finally {
      setRemoving(false);
    }
  }

  function onProceed() {
    requireAuth(() => router.push('/checkout'));
  }

  if (sectionLoading) {
    return (
      <section aria-label="Your bag" aria-busy="true" className="rounded-xl border border-border bg-surface p-6">
        <SkeletonText width="w-40" className="h-5" />
        <div className="mt-4">
          <CartRowSkeleton />
          <CartRowSkeleton />
        </div>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section aria-label="Your bag" className="rounded-xl border border-border bg-surface">
        <EmptyState
          icon={<ShoppingBag size={40} />}
          title="Your bag is empty"
          subtitle="Items you add to your bag will show up here."
        />
      </section>
    );
  }

  const proceedDisabledReason = hasOutOfStockItem
    ? 'Remove the out-of-stock item(s) below to continue.'
    : null;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px] lg:items-start">
      <section aria-label="Your bag" className="rounded-xl border border-border bg-surface p-6">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-display text-lg font-extrabold text-foreground">Your bag</p>
          <span className="text-sm font-medium text-muted">
            {itemCount} item{itemCount === 1 ? '' : 's'}
          </span>
        </div>

        <div className="mt-3">
          {items.map((item) => (
            <CartItemRow
              key={lineKey(item.productId, item.variantId)}
              item={item}
              liveStock={stockByKey[lineKey(item.productId, item.variantId)]}
              onQuantityChange={(q) => onQuantityChange(item, q)}
              onRequestRemove={() => setItemPendingRemoval(item)}
            />
          ))}
        </div>
      </section>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-20">
        {/* Compact coupon summary (design: a collapsed row, not the full apply UI — that lives on
            /checkout, which "Proceed to checkout" leads to). */}
        <button
          type="button"
          onClick={onProceed}
          className="flex items-center gap-2.5 rounded-xl border border-border bg-surface px-4 py-3.5 text-left transition hover:bg-subtle"
        >
          <Tag size={16} className="shrink-0 text-primary" aria-hidden />
          <span className="flex-1 text-sm font-medium text-foreground">
            {appliedCoupon ? `${appliedCoupon.code} applied` : 'Apply a coupon'}
          </span>
          <ChevronRight size={16} className="shrink-0 text-faint" aria-hidden />
        </button>

        <OrderSummary totals={totals} loading={settingsLoading} />

        <div>
          <Button variant="primary" size="lg" fullWidth disabled={hasOutOfStockItem} onClick={onProceed}>
            Proceed to checkout
          </Button>
          {proceedDisabledReason && (
            <p className="mt-2 flex items-center justify-center gap-1.5 text-xs font-medium text-error">
              <AlertTriangle size={13} aria-hidden /> {proceedDisabledReason}
            </p>
          )}
        </div>
      </aside>

      <ConfirmDialog
        isOpen={itemPendingRemoval !== null}
        title="Remove this item?"
        description={itemPendingRemoval ? `Remove "${itemPendingRemoval.name}" from your bag?` : undefined}
        confirmLabel="Remove"
        destructive
        loading={removing}
        onConfirm={onConfirmRemove}
        onClose={() => setItemPendingRemoval(null)}
      />
    </div>
  );
}
