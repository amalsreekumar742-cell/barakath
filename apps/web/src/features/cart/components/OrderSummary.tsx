import { formatInr } from '@/components/catalog/PriceBlock';
import { SkeletonText } from '@/components/Skeleton';
import type { TotalsBreakdown } from '@/lib/commerce/totals';

export interface OrderSummaryProps {
  totals: TotalsBreakdown;
  /** True while `general/config` (delivery/GST inputs) hasn't loaded yet — `computeTotals` already
   *  returns a safe (all-zero-delivery/GST) breakdown in that state, but rendering it as if it were
   *  final would show a wrong total for a moment. Skeleton the money rows instead. */
  loading: boolean;
}

/** One "Label ................ ₹value" row. */
function Row({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: 'discount' | 'total';
}) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className={emphasis === 'total' ? 'font-semibold text-foreground' : 'text-muted'}>
        {label}
      </span>
      <span
        className={
          emphasis === 'total'
            ? 'font-display text-lg font-semibold text-gold-strong'
            : emphasis === 'discount'
              ? 'font-medium text-success'
              : 'font-medium text-foreground'
        }
      >
        {value}
      </span>
    </div>
  );
}

/**
 * The bag's order summary (spec 2.11): Subtotal, Coupon discount, Delivery, GST, Total — every figure
 * taken straight from `computeTotals`'s return object, never recomputed here (per the C1 brief: this
 * screen must not be a second place money math can drift from the server's real answer).
 *
 * WHY GST is shown even though spec 2.11's own line list omits it: WEB_BATCH3_NOTES.md §5 is explicit
 * that the server always adds GST on top of every order, so hiding it here would show a "Total" that
 * disagrees with the amount `createPaymentOrder` actually charges — the exact "amount changed"
 * reconciliation prompt this batch is built to avoid. The C1 brief's own field list for this component
 * includes GST for the same reason; trusting it over the older spec line here.
 *
 * WHY no wallet/razorpay lines: those belong to checkout (spec 2.13), not the bag (spec 2.11) — this
 * component only ever reads the pre-wallet `grandTotal` as "Total".
 */
export function OrderSummary({ totals, loading }: OrderSummaryProps) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <p className="font-display text-base font-semibold text-foreground">Order summary</p>

      {loading ? (
        <div className="mt-3 space-y-2.5" aria-busy="true">
          <SkeletonText width="w-full" />
          <SkeletonText width="w-full" />
          <SkeletonText width="w-full" />
          <SkeletonText width="w-2/3" className="h-5" />
        </div>
      ) : (
        <div className="mt-2 divide-y divide-border">
          <Row label="Subtotal" value={formatInr(totals.subtotal)} />
          {totals.couponDiscount > 0 && (
            <Row label="Coupon discount" value={`− ${formatInr(totals.couponDiscount)}`} emphasis="discount" />
          )}
          <Row
            label="Delivery"
            value={totals.deliveryCharge === 0 ? 'Free' : formatInr(totals.deliveryCharge)}
          />
          <Row label="GST" value={formatInr(totals.gstAmount)} />
          <div className="pt-2">
            <Row label="Total" value={formatInr(totals.grandTotal)} emphasis="total" />
          </div>
        </div>
      )}
    </div>
  );
}
