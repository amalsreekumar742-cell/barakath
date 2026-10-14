import { OrderStatus, PaymentStatus } from '@barakath/shared/config/enums';

/**
 * Order status flow (spec §1.7): a strict linear progression the admin advances one step at a time.
 * WHY centralize: the detail page's action button, the timeline, and the update thunk's validation all
 * must agree on "what comes next" and "can this be cancelled" — one source of truth prevents drift.
 *
 *   Pending → Accepted → Packed → Shipped → Out for delivery → Delivered
 *
 * Cancel is allowed ONLY at Pending. Delivered and Cancelled are terminal (no next step).
 */
export const FLOW_STEPS: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.ACCEPTED,
  OrderStatus.PACKED,
  OrderStatus.SHIPPED,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERED,
];

/** The single next status in the flow, or null at a terminal state (Delivered / Cancelled). */
export function nextStatus(current: string): OrderStatus | null {
  const i = FLOW_STEPS.indexOf(current as OrderStatus);
  if (i === -1 || i >= FLOW_STEPS.length - 1) return null;
  return FLOW_STEPS[i + 1] ?? null;
}

/** The action-button label for advancing from the current status (null at a terminal state). */
export function nextActionLabel(current: string): string | null {
  switch (current) {
    case OrderStatus.PENDING:
      return 'Accept Order';
    case OrderStatus.ACCEPTED:
      return 'Mark as Packed';
    case OrderStatus.PACKED:
      return 'Mark as Shipped';
    case OrderStatus.SHIPPED:
      return 'Out for Delivery';
    case OrderStatus.OUT_FOR_DELIVERY:
      return 'Mark as Delivered';
    default:
      return null;
  }
}

/**
 * The bulk-bar label for advancing MANY orders that all sit at `current` (null at a terminal state).
 * WHY a separate map from `nextActionLabel`: that one is singular ("Accept Order"); the bulk bar acts on
 * a selection, so it reads in the plural.
 */
export function bulkActionLabel(current: string): string | null {
  switch (current) {
    case OrderStatus.PENDING:
      return 'Accept orders';
    case OrderStatus.ACCEPTED:
      return 'Mark as packed';
    case OrderStatus.PACKED:
      return 'Mark as shipped';
    case OrderStatus.SHIPPED:
      return 'Out for delivery';
    case OrderStatus.OUT_FOR_DELIVERY:
      return 'Mark as delivered';
    default:
      return null;
  }
}

/** Cancel is permitted only while the order is still Pending (spec §1.7). */
export function canCancel(current: string): boolean {
  return current === OrderStatus.PENDING;
}

/**
 * Can an order at `status` take part in a bulk action at all? Only if it has SOMETHING to do — a next
 * step or a cancel. Delivered and Cancelled are terminal, so their checkboxes stay disabled.
 */
export function isBulkActionable(status: string): boolean {
  return nextStatus(status) !== null || canCancel(status);
}

/**
 * Bulk selection is same-status only: the first ticked order fixes the status, and only orders at that
 * status stay tickable. WHY: the flow is strictly linear, so "the next step" only means one thing when
 * every selected order is at the same step — a mixed selection has no single action to offer.
 */
export function isBulkSelectable(status: string, selectionStatus: string | null): boolean {
  return isBulkActionable(status) && (selectionStatus === null || status === selectionStatus);
}

/**
 * Has the money actually been collected? Only `Paid` counts. `Refunded` is deliberately excluded —
 * a refunded order has had its money returned, so it must not be pushed further through fulfilment
 * either.
 */
export function isOrderPaid(paymentStatus: string): boolean {
  return paymentStatus === PaymentStatus.PAID;
}

/**
 * Why an unpaid order may not be advanced — shown on the disabled action button and returned by the
 * update thunk. Unpaid checkouts now live in `orderDrafts` until paid, so an unpaid order here is a
 * legacy (pre-draft) or Failed/Refunded document; accepting it would ship goods no one paid for.
 * Cancelling remains available and is the right way to clear one — the `cancelOrder` callable gives
 * back whatever it still holds.
 */
export function unpaidAdvanceReason(paymentStatus: string): string {
  if (paymentStatus === PaymentStatus.FAILED)
    return 'Payment failed for this order — it cannot be processed. Cancel it to release the stock.';
  if (paymentStatus === PaymentStatus.REFUNDED)
    return 'This order has been refunded — it cannot be processed further.';
  return 'Payment is not complete for this order — it cannot be processed. Cancel it to release the stock.';
}

/**
 * The FIRST timeline entry for each status — when the order actually reached it.
 *
 * WHY first, not last: the timeline is append-only and a status can recur. `approveReplacement` appends
 * an entry carrying the order's CURRENT status (Delivered) plus a refund note, so a last-wins map would
 * replace the real Delivered step's time with the refund's.
 */
export function firstEntryByStatus<T extends { status: string }>(
  timeline: readonly T[] | null | undefined,
): Map<string, T> {
  const byStatus = new Map<string, T>();
  for (const entry of timeline ?? []) {
    if (!byStatus.has(entry.status)) byStatus.set(entry.status, entry);
  }
  return byStatus;
}

/** Whether `status` has been reached given the order's current status (for timeline completion). */
export function isStepComplete(step: OrderStatus, current: string): boolean {
  const si = FLOW_STEPS.indexOf(step);
  const ci = FLOW_STEPS.indexOf(current as OrderStatus);
  return ci !== -1 && si <= ci;
}
