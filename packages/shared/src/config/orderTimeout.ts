/**
 * How long an unpaid order stays alive before it is auto-cancelled and its reserved stock,
 * coupon slot and wallet debit are returned.
 *
 * WHY this is shared: `createPaymentOrder` reserves stock BEFORE the customer pays, so an
 * abandoned checkout holds inventory nobody can buy. `expireUnpaidOrders` reclaims it on this
 * deadline, and the customer-facing countdown on the payment screens must promise exactly the same
 * number. A UI that says "10:00" against a backend that waits 30 minutes is a lie in one direction;
 * a UI that says "10:00" against a backend that waits 5 is a lie in the far worse direction.
 *
 * `functions/src/orders/service/orderTimeout.ts` mirrors this value — Cloud Functions cannot import
 * this workspace package at runtime. KEEP THE TWO IN LOCKSTEP.
 *
 * Note the sweeper runs on a schedule, so an order lives AT LEAST this long and at most this plus
 * one sweep interval. Erring long is the safe direction: an order is never cancelled while the
 * customer still believes they have time.
 */
export const ORDER_PAYMENT_TIMEOUT_MINUTES = 10;

export const ORDER_PAYMENT_TIMEOUT_MS = ORDER_PAYMENT_TIMEOUT_MINUTES * 60 * 1000;

/**
 * Milliseconds left before `createdAt + ORDER_PAYMENT_TIMEOUT_MS`, floored at 0.
 * Both clients drive their countdown from this so the arithmetic exists once.
 */
export function msUntilOrderExpiry(createdAtMs: number, nowMs: number): number {
  return Math.max(0, createdAtMs + ORDER_PAYMENT_TIMEOUT_MS - nowMs);
}
