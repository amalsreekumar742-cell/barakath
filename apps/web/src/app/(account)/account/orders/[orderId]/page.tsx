'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ChevronRight, PackageX } from 'lucide-react';
import { OrderStatus } from '@barakath/shared';
import { Breadcrumb } from '@/components/Breadcrumb';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonText } from '@/components/Skeleton';
import { StatusBadge } from '@/components/StatusBadge';
import { useAppSelector } from '@/stores/store';
import { toastError, toastSuccess } from '@/lib/toast';
import { cancelOrderCall } from '@/features/orders/api/orders';
import { useOrder } from '@/features/orders/hooks/useOrder';
import { useItemReplacementState } from '@/features/orders/hooks/useItemReplacementState';
import { SummaryRow } from '@/features/orders/components/SummaryRow';
import {
  estimatedDelivery,
  formatDate,
  formatDateShort,
  money,
  orderReference,
  paymentMethodLabel,
  savings,
} from '@/features/orders/utils/orderFormat';

/**
 * /account/orders/[orderId] — Order Detail (spec 3.11 §2).
 *
 * Guards (spec): a missing order OR one that belongs to someone else redirect to /account/orders.
 * `fetchOrder` deliberately returns null for both (never distinguishes them to the client), matching
 * `cancelOrder`'s own "Order not found" masking for a non-owner (WEB_BATCH4_NOTES.md §3).
 *
 * PRICE SUMMARY FIELD NOTE: the brief's field list (Subtotal, Discounts, Wallet used, Delivery, Taxable
 * value, CGST, SGST, Total) does not match the stored `OrderProps` 1:1 — the document has one
 * `gstAmount`, no `taxableValue`/`cgst`/`sgst` columns (verified against `packages/shared/src/types/
 * order.ts`). The Flutter app's own Order Detail renders a single "GST" line for exactly this reason.
 * This page instead derives Taxable value / CGST / SGST the SAME way the deployed `generateInvoicePDF`
 * Cloud Function already does for the PDF (`taxable = grandTotal - gstAmount`, `CGST = SGST =
 * gstAmount / 2`, an intra-state assumption since no place-of-supply field exists) — chosen over
 * Flutter's simpler single line so this screen and the Invoice screen (which must show the split to
 * match the downloaded PDF) never disagree with each other for the same order. Never recomputed from
 * catalogue prices — always derived from the order's own stored `gstAmount`/`grandTotal`.
 */
export default function OrderDetailPage() {
  const router = useRouter();
  const { orderId } = useParams<{ orderId: string }>();
  const uid = useAppSelector((s) => s.auth.uid);
  const authLoading = useAppSelector((s) => s.auth.authLoading);

  const { order, loading, error, notFound, refresh } = useOrder(orderId, uid);
  const { canReplace, replacementFor } = useItemReplacementState(order, uid);

  const [showCancel, setShowCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (notFound) {
      toastError(null, 'That order could not be found.');
      router.replace('/account/orders');
    }
  }, [notFound, router]);

  async function handleCancel() {
    if (!order) return;
    setCancelling(true);
    try {
      await cancelOrderCall(order.id);
      toastSuccess('Your order has been cancelled');
      setShowCancel(false);
      refresh();
    } catch (e) {
      toastError(e, 'Could not cancel this order. Please try again.');
    } finally {
      setCancelling(false);
    }
  }

  const isLoading = authLoading || loading || (!order && !notFound && !error);

  if (error) {
    return (
      <EmptyState icon={<PackageX size={40} />} title="Could not load this order" subtitle={error} />
    );
  }

  if (isLoading || !order) {
    return (
      <div className="space-y-4" aria-busy="true">
        <SkeletonText width="w-1/3" />
        <div className="h-24 animate-pulse rounded-xl bg-subtle" />
        <div className="h-40 animate-pulse rounded-xl bg-subtle" />
        <div className="h-24 animate-pulse rounded-xl bg-subtle" />
      </div>
    );
  }

  const isDelivered = order.status === OrderStatus.DELIVERED;
  const isCancelled = order.status === OrderStatus.CANCELLED;
  const isPending = order.status === OrderStatus.PENDING;
  const eta = estimatedDelivery(order);
  const method = paymentMethodLabel(order);
  const saved = savings(order);
  const taxable = order.grandTotal - (order.gstAmount || 0);
  const cgst = (order.gstAmount || 0) / 2;
  const sgst = (order.gstAmount || 0) / 2;

  return (
    <div>
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'My Orders', href: '/account/orders' },
          { label: orderReference(order.id) },
        ]}
      />

      <div className="space-y-4">
        {/* Status banner */}
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center justify-between gap-3">
            <StatusBadge status={order.status} />
            {!isCancelled && (
              <Link
                href={`/account/orders/${order.id}/track`}
                className="inline-flex items-center gap-0.5 text-sm font-medium text-primary hover:underline"
              >
                Track <ChevronRight size={16} />
              </Link>
            )}
          </div>
          <p className="mt-2.5 font-display text-lg font-semibold text-foreground">
            {isDelivered
              ? `Delivered on ${formatDateShort(eta)}`
              : isCancelled
                ? 'This order was cancelled'
                : `Estimated delivery ${formatDateShort(eta)}`}
          </p>
          <p className="mt-1 text-xs text-muted">
            Order {orderReference(order.id)} · placed {formatDate(order.createdAt)}
          </p>
          {isCancelled && order.cancelReason && (
            <p className="mt-1.5 text-xs text-error">{order.cancelReason}</p>
          )}
        </div>

        {/* Items */}
        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="font-display text-base font-semibold text-foreground">Items</h2>
          <div className="mt-3 divide-y divide-border">
            {order.items.map((item, i) => {
              const existing = replacementFor(item.productId, item.variantId);
              const eligible = isDelivered && canReplace(item.productId) && !existing;

              return (
                <div key={`${item.productId}-${item.variantId}-${i}`} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.productImage}
                    alt=""
                    className="size-16 shrink-0 rounded-md border border-border bg-subtle object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-medium text-foreground">{item.productName}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {[item.variantName, item.variantColor].filter(Boolean).join(' · ')}
                      {item.variantName || item.variantColor ? ' · ' : ''}Qty {item.quantity}
                    </p>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="text-sm font-semibold text-gold-strong">{money(item.subtotal)}</span>
                      {item.mrp > item.offerPrice && (
                        <span className="text-xs text-faint line-through">{money(item.mrp * item.quantity)}</span>
                      )}
                    </div>
                    {isDelivered && (
                      <div className="mt-2">
                        {existing ? (
                          <span className="inline-flex items-center gap-2 text-xs">
                            <span className="font-medium text-muted">{existing.requestId || 'Return request'}</span>
                            <StatusBadge status={existing.status} />
                          </span>
                        ) : eligible ? (
                          <Link
                            href={`/account/orders/${order.id}/return?productId=${encodeURIComponent(item.productId)}&variantId=${encodeURIComponent(item.variantId)}`}
                            className="text-xs font-medium text-primary hover:underline"
                          >
                            Return / Replace
                          </Link>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Delivery address */}
        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="font-display text-base font-semibold text-foreground">Delivery address</h2>
          <p className="mt-2 text-sm font-medium text-foreground">{order.shippingAddress.fullName}</p>
          <p className="mt-1 text-sm text-muted">
            {[
              order.shippingAddress.addressLine1,
              order.shippingAddress.addressLine2,
              order.shippingAddress.landmark,
              order.shippingAddress.city,
              order.shippingAddress.state,
              order.shippingAddress.pincode,
            ]
              .filter((p) => p && p.trim())
              .join(', ')}
          </p>
          {order.shippingAddress.phone && <p className="mt-1 text-sm text-muted">{order.shippingAddress.phone}</p>}
        </section>

        {/* Payment */}
        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="font-display text-base font-semibold text-foreground">Payment</h2>
          <div className="mt-2">
            {method && <SummaryRow label="Method" value={method} />}
            <SummaryRow label="Status" value={order.paymentStatus} />
            {order.razorpayPaymentId && <SummaryRow label="Transaction ID" value={order.razorpayPaymentId} />}
          </div>
        </section>

        {/* Price summary */}
        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="font-display text-base font-semibold text-foreground">Price summary</h2>
          <div className="mt-2 divide-y divide-border">
            <SummaryRow label="Subtotal" value={money(order.subtotal)} />
            {order.couponDiscount > 0 && (
              <SummaryRow
                label={order.couponCode ? `Coupon (${order.couponCode})` : 'Coupon discount'}
                value={`− ${money(order.couponDiscount)}`}
                emphasis="discount"
              />
            )}
            {order.walletAmountUsed > 0 && (
              <SummaryRow label="Wallet used" value={`− ${money(order.walletAmountUsed)}`} emphasis="discount" />
            )}
            <SummaryRow label="Delivery" value={order.deliveryCharge <= 0 ? 'Free' : money(order.deliveryCharge)} />
            {order.gstAmount > 0 && (
              <>
                <SummaryRow label="Taxable value" value={money(taxable)} />
                <SummaryRow label="CGST" value={money(cgst)} />
                <SummaryRow label="SGST" value={money(sgst)} />
              </>
            )}
            <div className="pt-2">
              <SummaryRow label="Total paid" value={money(order.grandTotal)} emphasis="total" />
            </div>
          </div>
          {saved > 0 && <p className="mt-2 text-xs font-medium text-success">You saved {money(saved)} on this order</p>}
        </section>

        {isPending && (
          <Button variant="destructive" fullWidth onClick={() => setShowCancel(true)}>
            Cancel order
          </Button>
        )}
      </div>

      <ConfirmDialog
        isOpen={showCancel}
        title="Cancel this order?"
        description="The amount you paid is refunded to its original source. This cannot be undone."
        confirmLabel="Cancel order"
        cancelLabel="Keep order"
        destructive
        loading={cancelling}
        onConfirm={handleCancel}
        onClose={() => {
          if (!cancelling) setShowCancel(false);
        }}
      />
    </div>
  );
}
