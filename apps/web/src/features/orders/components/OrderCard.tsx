'use client';

import Link from 'next/link';
import { Loader2, Undo2 } from 'lucide-react';
import { OrderStatus, type OrderProps } from '@barakath/shared';
import { StatusBadge, toneForStatus } from '@/components/StatusBadge';
import { formatInr } from '@/components/catalog/PriceBlock';
import { orderReference, totalItems } from '../utils/orderFormat';

const THUMB_COUNT = 3;

export interface OrderCardProps {
  order: OrderProps;
  reordering: boolean;
  onReorder: (order: OrderProps) => void;
  /**
   * Status of the return raised against this order ('Pending' | 'Approved' | 'Rejected'), or
   * undefined when none was. Supplied by the page from one `fetchReturnStatusesByOrder` read for the
   * whole list — never fetched per card.
   */
  returnStatus?: string;
}

/**
 * The Return tag.
 *
 * WHY not a plain `StatusBadge`: it would read "Pending" sitting next to the order's own status
 * badge, which parses as THE ORDER being pending. The word "Return" has to be in the label, so this
 * borrows `toneForStatus` for colour but not the pill itself. An unrecognised status — including one
 * a newer admin build introduces — reads as still open, which is the safe thing to tell a customer.
 */
function ReturnTag({ status }: { status: string }) {
  const label =
    {
      approved: 'Return approved',
      rejected: 'Return rejected',
    }[status.trim().toLowerCase()] ?? 'Return requested';

  const tone = toneForStatus(status);
  const colour =
    tone === 'positive'
      ? 'bg-success-subtle text-success'
      : tone === 'negative'
        ? 'bg-error-subtle text-error'
        : 'bg-gold-subtle text-gold-strong';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${colour}`}
    >
      <Undo2 className="size-3" aria-hidden />
      {label}
    </span>
  );
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
export function OrderCard({ order, reordering, onReorder, returnStatus }: OrderCardProps) {
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
        <Link href={detailHref} className="min-w-0 truncate text-sm font-semibold text-foreground hover:underline">
          {orderReference(order.id)}
        </Link>
        <StatusBadge status={order.status} />
      </div>

      {/* Own line rather than beside the status badge: the reference truncates to make room, so a
          second pill up there would eat it on a narrow card. */}
      {returnStatus && (
        <div className="mt-2">
          <ReturnTag status={returnStatus} />
        </div>
      )}

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
          <span className="flex size-12 shrink-0 items-center justify-center rounded-md border border-border bg-subtle text-xs font-medium text-muted">
            +{extra}
          </span>
        )}
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          {totalItems(order)} {totalItems(order) === 1 ? 'item' : 'items'} ·{' '}
          <span className="font-semibold text-gold-strong">{formatInr(order.grandTotal)}</span>
        </p>

        <div className="flex flex-wrap items-center gap-3 text-xs font-medium">
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
