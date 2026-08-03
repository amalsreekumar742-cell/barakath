/**
 * computeReplacementRefund — how much a return request refunds to the customer's wallet.
 *
 * Mirrors packages/shared/src/utils/replacementRefund.ts (functions can't import the workspace package
 * at runtime, so the contract is duplicated here — same arrangement as src/config/collections.ts).
 * KEEP THE TWO IN LOCKSTEP: the admin panel uses the shared copy to PREVIEW the amount before an admin
 * clicks Approve, and this copy WRITES it. A drift between them is a money discrepancy the customer
 * sees. The value computed here is the authoritative one.
 *
 * The refund is the line's own value, adjusted so it can never exceed what the customer actually paid
 * for that line:
 *   + line price x returned quantity           (repriced, NOT copied from item.subtotal)
 *   - that line's proportional share of the order's coupon discount
 *   + that line's proportional share of the order's GST
 *   - nothing for delivery
 *
 * WHY reprice instead of using `item.subtotal`: `createPaymentOrder` writes `subtotal` for the FULL
 *   ordered quantity, so a partial-quantity return must recompute or it over-refunds.
 * WHY the coupon is apportioned: `computeOrderTotals` applies `couponDiscount` at the ORDER level
 *   against the whole subtotal and records no per-line attribution, so proportional-to-line-value is
 *   the only defensible split. Ignoring it would refund more than was paid on any couponed order.
 * WHY proportional GST is exact (not an approximation): `gstAmount = (subtotal - discount) * pct/100`,
 *   and under proportional discount apportionment `lineNet / (subtotal - discount)` equals
 *   `lineGross / subtotal`. So `gstAmount * share` is algebraically identical to recomputing the
 *   line's own tax — and it needs no config read, so it stays correct even if the GST rate has
 *   changed since the order was placed.
 * WHY delivery is never refunded: it pays for a shipment that was made, it is order-level, and a
 *   combo charge REPLACES the standard fee, so no per-line share is even well-defined.
 *
 * Sanity check — a single-line order returned in full yields
 * `subtotal - discount + gst`, i.e. exactly `grandTotal - deliveryCharge`.
 */
import { round2 } from '../../orders/service/computeTotals';

/** The line-item fields this calculation needs (subset of OrderItemProps in packages/shared). */
export interface RefundOrderItem {
  productId: string;
  variantId: string;
  offerPrice: number;
  quantity: number;
  subtotal: number;
}

/** The order-level money fields this calculation needs. */
export interface RefundOrder {
  items?: RefundOrderItem[];
  subtotal?: number;
  couponDiscount?: number;
  gstAmount?: number;
}

export interface ReplacementRefundInput {
  productId: string;
  variantId: string;
  /** Units being returned. Clamped to [1, ordered quantity]. */
  quantity: number;
}

export interface ReplacementRefundBreakdown {
  /** What lands in the wallet. */
  refundAmount: number;
  /** Line price x returned quantity, before coupon/GST adjustment. */
  lineGross: number;
  /** Deducted — this line's share of the order-level coupon. */
  couponShare: number;
  /** Added — this line's share of the order-level GST. */
  gstShare: number;
  /** Units actually refunded (after clamping to what was ordered). */
  quantity: number;
}

/** Thrown when the request does not correspond to a line on the order — never guess an amount. */
export class ReplacementLineNotFoundError extends Error {
  constructor() {
    super('That item is not on the original order');
    this.name = 'ReplacementLineNotFoundError';
  }
}

/**
 * @throws ReplacementLineNotFoundError when no line matches. The caller MUST NOT fall back to the
 * whole basket: an unmatched variant used to silently mean "copy every item", which was harmless when
 * the output was a free order and would refund the entire order now that the output is money.
 */
export function computeReplacementRefund(
  order: RefundOrder,
  request: ReplacementRefundInput,
): ReplacementRefundBreakdown {
  const items = order.items ?? [];

  // Match on product + variant; fall back to variant alone for docs written before productId was
  // reliably stamped on the request. Never fall back to "all items".
  const line =
    items.find((i) => i.productId === request.productId && i.variantId === request.variantId) ??
    items.find((i) => i.variantId === request.variantId);
  if (!line) throw new ReplacementLineNotFoundError();

  const ordered = line.quantity > 0 ? line.quantity : 1;
  const qty = Math.min(Math.max(request.quantity || ordered, 1), ordered);

  // `offerPrice` is the per-unit price actually charged; the divide is a fallback for any legacy
  // document written without it.
  const unitPrice = line.offerPrice > 0 ? line.offerPrice : line.subtotal / ordered;
  const lineGross = round2(unitPrice * qty);

  const orderSubtotal = order.subtotal ?? 0;
  const base =
    orderSubtotal > 0 ? orderSubtotal : round2(items.reduce((sum, i) => sum + i.subtotal, 0));
  const share = base > 0 ? lineGross / base : 0;

  const couponShare = round2((order.couponDiscount ?? 0) * share);
  const gstShare = round2((order.gstAmount ?? 0) * share);

  const refundAmount = Math.max(0, round2(lineGross - couponShare + gstShare));

  return { refundAmount, lineGross, couponShare, gstShare, quantity: qty };
}
