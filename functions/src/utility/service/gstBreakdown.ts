/**
 * Rate-wise GST breakup for an invoice — one row per distinct GST rate on the order.
 *
 * MIRRORS `packages/shared/src/utils/gstBreakdown.ts`. Cloud Functions can't import the workspace
 * package at runtime, so this is a deliberate copy (same pattern as
 * `functions/src/growth/service/replacementRefund.ts`). KEEP THE TWO IN LOCKSTEP: the PDF this
 * produces is downloaded from the same screen that renders the shared version, and the two must
 * never quote different numbers for the same order.
 */

export interface GstBreakdownRow {
  /** The GST rate, as a percentage (18 = 18%). */
  percentage: number;
  /** Value the tax was charged on — line subtotal net of its share of any coupon discount. */
  taxableValue: number;
  gstAmount: number;
}

interface GstLine {
  subtotal?: unknown;
  gstPercentage?: unknown;
  gstAmount?: unknown;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * Groups the order's lines by GST rate.
 *
 * Returns an EMPTY array for an order placed before per-line GST existed — those carry only the
 * order-level `gstAmount`, and deriving a split for them from today's shop rate would put a
 * fabricated figure on a tax document. The caller falls back to the single total.
 *
 * Reads each line's stored `gstAmount` rather than recomputing it from the rate: those amounts are
 * what the customer actually paid, and recomputing would drift from the order's `gstAmount`.
 */
export function gstBreakdown(order: {
  items?: unknown;
  subtotal?: unknown;
  couponDiscount?: unknown;
}): GstBreakdownRow[] {
  const items = (Array.isArray(order.items) ? order.items : []) as GstLine[];
  if (items.length === 0) return [];
  if (!items.every((i) => isNum(i.gstPercentage) && isNum(i.gstAmount))) return [];

  const lineSubtotal = (i: GstLine) => (isNum(i.subtotal) ? i.subtotal : 0);
  const subtotal = isNum(order.subtotal) && order.subtotal > 0
    ? order.subtotal
    : items.reduce((sum, i) => sum + lineSubtotal(i), 0);
  const discount = isNum(order.couponDiscount) ? order.couponDiscount : 0;

  const byRate = new Map<number, GstBreakdownRow>();
  for (const item of items) {
    const percentage = item.gstPercentage as number;
    // Same apportionment the server used when it charged the tax (orders/service/computeTotals.ts).
    const share = subtotal > 0 ? lineSubtotal(item) / subtotal : 0;
    const taxable = Math.max(lineSubtotal(item) - discount * share, 0);

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
