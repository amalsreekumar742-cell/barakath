'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Copy, PackageX, X as XIcon } from 'lucide-react';
import { OrderStatus } from '@barakath/shared';
import { Breadcrumb } from '@/components/Breadcrumb';
import { EmptyState } from '@/components/EmptyState';
import { Modal } from '@/components/Modal';
import { SkeletonText } from '@/components/Skeleton';
import { StatusBadge } from '@/components/StatusBadge';
import { useAppSelector } from '@/stores/store';
import { toastError, toastSuccess } from '@/lib/toast';
import { useOrder } from '@/features/orders/hooks/useOrder';
import { useItemReplacementState } from '@/features/orders/hooks/useItemReplacementState';
import { StatusTimeline } from '@/features/orders/components/StatusTimeline';
import {
  estimatedDelivery,
  formatDateShort,
  formatDateTime,
  orderReference,
  savings,
  money,
  timestampFor,
} from '@/features/orders/utils/orderFormat';

/**
 * /account/orders/[orderId]/track — Track Order (spec 3.11 §3).
 *
 * NO rider distance: spec 3.11 explicitly drops it for the website even though the app's tracking page
 * shows related detail — this page renders only the six-step timeline and the courier block.
 */
export default function TrackOrderPage() {
  const router = useRouter();
  const { orderId } = useParams<{ orderId: string }>();
  const uid = useAppSelector((s) => s.auth.uid);
  const authLoading = useAppSelector((s) => s.auth.authLoading);

  const { order, loading, error, notFound } = useOrder(orderId, uid);
  const { canReplace, replacementFor } = useItemReplacementState(order, uid);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (notFound) {
      toastError(null, 'That order could not be found.');
      router.replace('/account/orders');
    }
  }, [notFound, router]);

  const isLoading = authLoading || loading || (!order && !notFound && !error);

  if (error) {
    return <EmptyState icon={<PackageX size={40} />} title="Could not load this order" subtitle={error} />;
  }

  if (isLoading || !order) {
    return (
      <div className="space-y-4" aria-busy="true">
        <SkeletonText width="w-1/3" />
        <div className="h-28 animate-pulse rounded-xl bg-subtle" />
        <div className="h-64 animate-pulse rounded-xl bg-subtle" />
      </div>
    );
  }

  const isCancelled = order.status === OrderStatus.CANCELLED;
  const isDelivered = order.status === OrderStatus.DELIVERED;
  const eta = estimatedDelivery(order);
  const saved = savings(order);
  const totalCount = order.items.reduce((s, i) => s + i.quantity, 0);
  const cancelledAt = timestampFor(order, OrderStatus.CANCELLED) ?? order.updatedAt;

  const eligibleItems = isDelivered
    ? order.items.filter((item) => canReplace(item.productId) && !replacementFor(item.productId, item.variantId))
    : [];

  function returnHref(productId: string, variantId: string) {
    return `/account/orders/${order!.id}/return?productId=${encodeURIComponent(productId)}&variantId=${encodeURIComponent(variantId)}`;
  }

  async function copyTrackingId() {
    try {
      await navigator.clipboard.writeText(order!.trackingId);
      toastSuccess('Tracking ID copied');
    } catch {
      toastError(null, 'Could not copy the tracking ID.');
    }
  }

  return (
    <div>
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'My Orders', href: '/account/orders' },
          { label: orderReference(order.id), href: `/account/orders/${order.id}` },
          { label: 'Track' },
        ]}
      />

      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-surface p-5">
          <StatusBadge status={order.status} />
          <p className="mt-2.5 font-display text-xl font-semibold text-foreground">
            {isDelivered
              ? `Delivered on ${formatDateShort(eta)}`
              : isCancelled
                ? 'This order was cancelled'
                : `Estimated delivery ${formatDateShort(eta)}`}
          </p>
          <p className="mt-1 text-sm text-muted">
            {totalCount} {totalCount === 1 ? 'item' : 'items'} · {money(order.grandTotal)}
          </p>
          {saved > 0 && (
            <span className="mt-2 inline-flex rounded-full bg-success-subtle px-2.5 py-1 text-xs font-semibold text-success">
              You saved {money(saved)}
            </span>
          )}
        </div>

        {isCancelled ? (
          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="font-display text-base font-semibold text-foreground">Status</h2>
            <div className="mt-3 flex items-start gap-3">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-error">
                <XIcon className="size-3 text-white" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">Cancelled</p>
                <p className="mt-0.5 text-xs text-muted">{formatDateTime(cancelledAt)}</p>
                {order.cancelReason && <p className="mt-0.5 text-xs text-faint">{order.cancelReason}</p>}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="font-display text-base font-semibold text-foreground">Status</h2>
            <div className="mt-3">
              <StatusTimeline order={order} />
            </div>
          </div>
        )}

        {(order.courierName || order.trackingId) && (
          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="font-display text-base font-semibold text-foreground">Courier</h2>
            {order.courierName && (
              <p className="mt-2 text-sm font-semibold tracking-wide text-foreground uppercase">{order.courierName}</p>
            )}
            {order.trackingId && (
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-muted">{order.trackingId}</span>
                <button
                  type="button"
                  onClick={copyTrackingId}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-subtle"
                >
                  <Copy size={13} aria-hidden /> Copy
                </button>
              </div>
            )}
          </div>
        )}

        {eligibleItems.length > 0 &&
          (eligibleItems.length === 1 && eligibleItems[0] ? (
            <Link
              href={returnHref(eligibleItems[0].productId, eligibleItems[0].variantId)}
              className="block w-full rounded-lg border border-border-strong bg-surface py-3 text-center text-sm font-medium text-foreground hover:bg-subtle"
            >
              Return product
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="block w-full rounded-lg border border-border-strong bg-surface py-3 text-center text-sm font-medium text-foreground hover:bg-subtle"
            >
              Return product
            </button>
          ))}
      </div>

      <Modal isOpen={pickerOpen} onClose={() => setPickerOpen(false)} maxWidth="max-w-md" labelledBy="return-picker-heading">
        <div className="rounded-xl border border-border bg-surface p-5 shadow-lg">
          <h2 id="return-picker-heading" className="font-display text-base font-semibold text-foreground">
            Which item?
          </h2>
          <div className="mt-3 divide-y divide-border">
            {eligibleItems.map((item) => (
              <Link
                key={`${item.productId}-${item.variantId}`}
                href={returnHref(item.productId, item.variantId)}
                className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 hover:bg-subtle"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.productImage} alt="" className="size-11 shrink-0 rounded-md border border-border object-cover" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{item.productName}</p>
                  <p className="text-xs text-muted">
                    {item.variantName ? `${item.variantName} · ` : ''}Qty {item.quantity}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}
