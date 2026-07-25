import { OrderStatus } from '@barakath/shared/config/enums';

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

/** Whether `status` has been reached given the order's current status (for timeline completion). */
export function isStepComplete(step: OrderStatus, current: string): boolean {
  const si = FLOW_STEPS.indexOf(step);
  const ci = FLOW_STEPS.indexOf(current as OrderStatus);
  return ci !== -1 && si <= ci;
}
