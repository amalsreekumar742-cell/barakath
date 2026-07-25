'use client';

import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { OrderStatus, type OrderProps } from '@barakath/shared';
import { StatusBadge } from '@/components/StatusBadge';
import { formatInr } from '@/components/catalog/PriceBlock';
import { orderReference, totalItems } from '../utils/orderFormat';

const THUMB_COUNT = 3;

export interface OrderCardProps {
  order: OrderProps;
  reordering: boolean;
  onReorder: (order: OrderProps) => void;
}

/**
 * One row of My Orders (spec 3.11). Unlike the Flutter card (one text-link action, since a phone card
 * has no room for more), the website surfaces every status-gated action as its own small link/button —
 * Track, Invoice, Reorder, Return / Replace, Cancel — because a desktop card has the width for it and
 * the brief explicitly lists all five as first-class actions here.
 *
 * WHY "Return / Replace" gates on Delivered only, not true per-item eligibility (product
 * `replacementAvailable` AND no existing request): that check needs a product read (+ a replacements
 * query) PER ITEM, which is fine for the one order Order Detail renders but not for a page of a dozen
 * order cards each doing N extra reads. The card is a coarse shortcut; Order Detail (spec 3.11 §2) does
 * the real per-item gating and is where a customer actually lands to raise the request.
 */
export function OrderCard({ order, reordering, onReorder }: OrderCardProps) {
  const detailHref = `/account/orders/${order.id}`;
  const isDelivered = order.status === OrderStatus.DELIVERED;
  const isCancelled = order.status === OrderStatus.CANCELLED;
  const isPending = order.status === OrderStatus.PENDING;
  const isActive = !isDelivered && !isCancelled;

  const images = order.items.map((i) => i.productImage).filter(Boolean);
  const shown = images.slice(0, THUMB_COUNT);
  const extra = images.length - shown.length;

  return (
    <div className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <Link href={detailHref} className="min-w-0 truncate text-sm font-extrabold text-foreground hover:underline">
          {orderReference(order.id)}
        </Link>
        <StatusBadge status={order.status} />
      </div>

      <Link href={detailHref} className="mt-3 flex gap-2">
        {shown.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={src}
            alt=""
            className="size-12 shrink-0 rounded-md border border-border bg-subtle object-cover"
          />
        ))}
        {extra > 0 && (
          <span className="flex size-12 shrink-0 items-center justify-center rounded-md border border-border bg-subtle text-xs font-bold text-muted">
            +{extra}
          </span>
        )}
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          {totalItems(order)} {totalItems(order) === 1 ? 'item' : 'items'} ·{' '}
          <span className="font-extrabold text-gold-strong">{formatInr(order.grandTotal)}</span>
        </p>

        <div className="flex flex-wrap items-center gap-3 text-xs font-bold">
          {isActive && (
            <Link href={`${detailHref}/track`} className="text-primary hover:underline">
              Track
            </Link>
          )}
          {isDelivered && (
            <>
              <Link href={`${detailHref}/invoice`} className="text-primary hover:underline">
                Invoice
              </Link>
              <button
                type="button"
                onClick={() => onReorder(order)}
                disabled={reordering}
                className="inline-flex items-center gap-1 text-primary hover:underline disabled:opacity-50"
              >
                {reordering && <Loader2 className="size-3 animate-spin" aria-hidden />}
                Reorder
              </button>
              <Link href={`${detailHref}/return`} className="text-primary hover:underline">
                Return / Replace
              </Link>
            </>
          )}
          {isPending && (
            <Link href={detailHref} className="text-error hover:underline">
              Cancel
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
