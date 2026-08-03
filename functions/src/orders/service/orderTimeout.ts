/**
 * How long an unpaid order stays alive before `expireUnpaidOrders` cancels it and returns its
 * reserved stock, coupon slot and wallet debit.
 *
 * Mirrors packages/shared/src/config/orderTimeout.ts (Cloud Functions cannot import the workspace
 * package at runtime — same arrangement as src/config/collections.ts). KEEP THE TWO IN LOCKSTEP:
 * the customer-facing countdown on the payment screens reads the shared copy, and this one decides
 * when the order actually dies. If they disagree, a customer watches a timer that means nothing.
 */
export const ORDER_PAYMENT_TIMEOUT_MINUTES = 10;

export const ORDER_PAYMENT_TIMEOUT_MS = ORDER_PAYMENT_TIMEOUT_MINUTES * 60 * 1000;
