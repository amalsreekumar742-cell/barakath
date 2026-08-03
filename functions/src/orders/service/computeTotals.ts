import type { DeliveryTaxConfig, OrderTotals, ResolvedItem } from './types';

/**
 * Pure checkout math (spec §2.13, §2.15). Takes server-resolved line items + the already-validated
 * coupon discount + the requested wallet amount + the delivery/tax config, and returns the full money
 * breakdown. WHY pure (no Firestore/req): the same math must be reproducible and testable, and it must
 * NEVER depend on any client-supplied amount — every input here was read by the server itself.
 */

/** Round to 2 decimals so rupee amounts never carry binary-float dust. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Rupees → integer paisa for the Razorpay API (amount is always the smallest currency unit). */
export function toPaisa(rupees: number): number {
  return Math.round(rupees * 100);
}

/**
 * Delivery charge: a combo product's own comboDeliveryCharge REPLACES the standard fee (spec §2.13);
 * otherwise the standard fee applies unless the subtotal clears the free-delivery threshold. When more
 * than one combo is present the largest comboDeliveryCharge wins (a single shipment).
 */
export function computeDeliveryCharge(
  items: ResolvedItem[],
  subtotal: number,
  config: DeliveryTaxConfig,
): number {
  const comboCharges = items.filter((i) => i.isCombo).map((i) => i.comboDeliveryCharge);
  if (comboCharges.length > 0) return round2(Math.max(...comboCharges));
  if (config.freeDeliveryThreshold > 0 && subtotal >= config.freeDeliveryThreshold) return 0;
  return round2(config.standardDeliveryFee);
}

/**
 * Per-line GST. Each line is taxed at ITS OWN rate on ITS OWN taxable value.
 *
 * WHY the coupon is apportioned by line: `couponDiscount` is an order-level amount with no per-line
 * attribution recorded anywhere, so the only defensible split is proportional to line value. Taxing
 * the undiscounted line would overcharge the customer; ignoring the rate difference between lines
 * would put the wrong figure on the tax invoice.
 *
 * WHY this is not a behaviour change for existing catalogues: when every line resolves to the same
 * rate (which is what the global-rate fallback produces), Σ(lineTaxable × pct) is the old
 * `(subtotal − discount) × pct` to the paisa, give or take per-line rounding.
 *
 * Returns the rupee GST for each line, index-aligned with `items`.
 */
export function computeLineGst(
  items: ResolvedItem[],
  subtotal: number,
  discount: number,
): number[] {
  return items.map((item) => {
    // Guard the divide: a zero subtotal means zero-value lines, hence zero tax.
    const share = subtotal > 0 ? item.subtotal / subtotal : 0;
    const taxable = item.subtotal - discount * share;
    return round2((Math.max(taxable, 0) * item.gstPercentage) / 100);
  });
}

/**
 * Assemble the full breakdown. `couponDiscount` and `walletAmountToUse` are pre-validated by the caller;
 * wallet is clamped here to [0, grandTotal] so razorpayAmount can never go negative and a full-wallet
 * order (spec §2.15 "Full wallet payment allowed") lands razorpayAmount exactly at 0.
 */
export function computeOrderTotals(
  items: ResolvedItem[],
  couponDiscount: number,
  walletAmountToUse: number,
  config: DeliveryTaxConfig,
): OrderTotals {
  const subtotal = round2(items.reduce((sum, i) => sum + i.subtotal, 0));
  const discount = round2(Math.min(Math.max(couponDiscount, 0), subtotal));
  const deliveryCharge = computeDeliveryCharge(items, subtotal, config);
  const lineGst = computeLineGst(items, subtotal, discount);
  const gstAmount = round2(lineGst.reduce((sum, g) => sum + g, 0));
  const grandTotal = round2(subtotal - discount + deliveryCharge + gstAmount);
  const walletAmountUsed = round2(Math.min(Math.max(walletAmountToUse, 0), grandTotal));
  const razorpayAmount = round2(grandTotal - walletAmountUsed);
  return {
    subtotal,
    couponDiscount: discount,
    deliveryCharge,
    gstAmount,
    lineGst,
    grandTotal,
    walletAmountUsed,
    razorpayAmount,
  };
}
