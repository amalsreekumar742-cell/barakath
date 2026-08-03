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

/** Cancel is permitted only while the order is still Pending (spec §1.7). */
export function canCancel(current: string): boolean {
  return current === OrderStatus.PENDING;
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
 * update thunk. Stock is reserved at checkout, BEFORE payment; `dailyCleanup` only reclaims it from
 * orders still sitting at `status == 'Pending'`. Accepting an unpaid order therefore strands that
 * stock permanently and ships goods no one paid for. Cancelling remains available and is the right
 * way to release an abandoned checkout.
 */
export function unpaidAdvanceReason(paymentStatus: string): string {
  if (paymentStatus === PaymentStatus.FAILED)
    return 'Payment failed for this order — it cannot be processed. Cancel it to release the stock.';
  if (paymentStatus === PaymentStatus.REFUNDED)
    return 'This order has been refunded — it cannot be processed further.';
  return 'Payment is not complete for this order — it cannot be processed. Cancel it to release the stock.';
}

/** Whether `status` has been reached given the order's current status (for timeline completion). */
export function isStepComplete(step: OrderStatus, current: string): boolean {
  const si = FLOW_STEPS.indexOf(step);
  const ci = FLOW_STEPS.indexOf(current as OrderStatus);
  return ci !== -1 && si <= ci;
}
