import type { OrderItemProps, OrderProps } from '../types/order';

/**
 * Rate-wise GST breakup for a tax invoice — one row per distinct GST rate on the order.
 *
 * WHY a shared helper: the admin's printable Tax Invoice and the customer's in-app invoice must state
 * the SAME figures for the same order. Two independent implementations of tax arithmetic is exactly
 * how an invoice ends up disagreeing with itself.
 *
 * WHY it reads per-line `gstAmount` rather than recomputing from the rate: the line amounts were fixed
 * by `computeOrderTotals` at checkout and are what the customer actually paid. Recomputing here would
 * re-derive them from a rate that may since have changed, and per-line rounding would drift from the
 * order's stored `gstAmount`.
 */
export interface GstBreakdownRow {
  /** The GST rate, as a percentage (18 = 18%). */
  percentage: number;
  /** Value the tax was charged on — the line subtotal net of its share of any coupon discount. */
  taxableValue: number;
  /** Rupee GST at this rate. */
  gstAmount: number;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** True when every line carries the per-line tax fields a rate-wise breakup needs. */
export function hasLineGst(items: readonly OrderItemProps[]): boolean {
  return (
    items.length > 0 &&
    items.every((i) => typeof i.gstPercentage === 'number' && typeof i.gstAmount === 'number')
  );
}

/**
 * Groups the order's lines by GST rate.
 *
 * Returns an EMPTY array for an order placed before per-line GST existed. Those orders carry only the
 * order-level `gstAmount`, and inventing a breakdown for them — by assuming the current global rate
 * applied to a historic order — would put a fabricated figure on a tax document. The caller falls back
 * to the single total instead.
 */
export function gstBreakdown(
  order: Pick<OrderProps, 'items' | 'subtotal' | 'couponDiscount'>,
): GstBreakdownRow[] {
  const items = order.items ?? [];
  if (!hasLineGst(items)) return [];

  const subtotal = order.subtotal || items.reduce((sum, i) => sum + i.subtotal, 0);
  const discount = order.couponDiscount ?? 0;

  const byRate = new Map<number, GstBreakdownRow>();
  for (const item of items) {
    const percentage = item.gstPercentage as number;
    // Same apportionment the server used when it charged the tax (functions computeLineGst).
    const share = subtotal > 0 ? item.subtotal / subtotal : 0;
    const taxable = Math.max(item.subtotal - discount * share, 0);

    const row = byRate.get(percentage) ?? { percentage, taxableValue: 0, gstAmount: 0 };
    row.taxableValue += taxable;
    row.gstAmount += item.gstAmount as number;
    byRate.set(percentage, row);
  }

  return Array.from(byRate.values())
    .map((r) => ({
      percentage: r.percentage,
      taxableValue: round2(r.taxableValue),
      gstAmount: round2(r.gstAmount),
    }))
    .sort((a, b) => a.percentage - b.percentage);
}
