'use client';

import { Info } from 'lucide-react';
import { Button } from '@/components/Button';
import { formatInr } from '@/components/catalog/PriceBlock';
import type { TotalsBreakdown } from '@/lib/commerce/totals';

export interface OrderSummaryBlockProps {
  totals: TotalsBreakdown;
  couponCode: string | null;
  disabled: boolean;
  loading: boolean;
  onPlaceOrder: () => void;
}

/**
 * Order summary + "Place order · ₹X" (spec 2.13/3.8). Line order mirrors `computeTotals`'s own field
 * order exactly (WEB_BATCH3_NOTES.md §5) — subtotal, coupon discount, delivery, GST, grand total, then
 * the wallet/Razorpay split — so a customer can trace the same arithmetic the server will re-run.
 */
export function OrderSummaryBlock({ totals, couponCode, disabled, loading, onPlaceOrder }: OrderSummaryBlockProps) {
  return (
    <div className="rounded-lg border border-border-strong bg-surface p-4">
      <h3 className="mb-3 text-xs font-extrabold uppercase tracking-wide text-muted">Order summary</h3>
      <dl className="space-y-2 text-sm">
        <Row label="Subtotal" value={formatInr(totals.subtotal)} />
        {totals.couponDiscount > 0 && (
          <Row
            label={couponCode ? `Coupon (${couponCode})` : 'Coupon discount'}
            value={`− ${formatInr(totals.couponDiscount)}`}
            valueClassName="text-success"
          />
        )}
        <Row
          label="Delivery"
          value={totals.deliveryCharge === 0 ? 'Free' : formatInr(totals.deliveryCharge)}
          valueClassName={totals.deliveryCharge === 0 ? 'text-success' : undefined}
        />
        <Row label="GST" value={formatInr(totals.gstAmount)} />
        <div className="my-1 border-t border-border" />
        <Row label="Grand total" value={formatInr(totals.grandTotal)} bold />
        {totals.walletAmountUsed > 0 && (
          <Row label="Paid from wallet" value={`− ${formatInr(totals.walletAmountUsed)}`} valueClassName="text-success" />
        )}
        <Row label="To pay via Razorpay" value={formatInr(totals.razorpayAmount)} bold />
      </dl>

      <p className="mt-3 flex items-start gap-1.5 text-xs text-muted">
        <Info size={13} className="mt-0.5 shrink-0" />
        The final amount is confirmed by our server just before payment — if it differs from what is
        shown here, you will be asked to confirm before continuing.
      </p>

      <Button
        variant="primary"
        size="lg"
        fullWidth
        className="mt-4"
        loading={loading}
        disabled={disabled}
        onClick={onPlaceOrder}
      >
        Place order · {formatInr(totals.grandTotal)}
      </Button>
    </div>
  );
}

function Row({
  label,
  value,
  bold = false,
  valueClassName,
}: {
  label: string;
  value: string;
  bold?: boolean;
  valueClassName?: string;
}) {
  return (
    <div className={`flex items-center justify-between ${bold ? 'font-extrabold text-foreground' : 'text-muted'}`}>
      <dt>{label}</dt>
      <dd className={valueClassName ?? (bold ? 'text-foreground' : 'text-foreground')}>{value}</dd>
    </div>
  );
}
