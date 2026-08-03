'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { Check, Copy } from 'lucide-react';
import type { CouponProps } from '@barakath/shared';
import { formatTimeRemaining } from '@barakath/shared/utils/spinValidity';
import { formatInr } from '@/components/catalog/PriceBlock';
import { toastSuccess } from '@/lib/toast';
import { findOrderIdForCoupon, type CouponTab } from '../api/coupons';

/** "10% off, up to ₹200" / "₹50 off" — a human reward line; `coupon.description` alone (e.g. "Spin
 *  reward from Diwali Wheel") never states the actual amount. */
function formatDiscount(coupon: CouponProps): string {
  if (coupon.discountType === 'Percentage') {
    return coupon.maximumDiscount > 0
      ? `${coupon.discountValue}% off, up to ${formatInr(coupon.maximumDiscount)}`
      : `${coupon.discountValue}% off`;
  }
  return `${formatInr(coupon.discountValue)} off`;
}

/**
 * The expiry line for an ACTIVE coupon: a countdown inside the last 24 hours, an explicit date beyond
 * that. See the call site for why sub-day precision matters here.
 */
function expiresLabel(validUntilMs: number): string {
  const msLeft = validUntilMs - Date.now();
  if (msLeft <= 0) return 'Expired';
  if (msLeft < 24 * 3_600_000) return formatTimeRemaining(validUntilMs, Date.now());
  return `Expires ${format(new Date(validUntilMs), 'd MMM yyyy')}`;
}

/**
 * One coupon in the wallet (spec §3.15): code + Copy, reward description, conditions, expiry. Used and
 * Expired cards are muted with Copy disabled (Batch 4 brief §3); a Used card additionally resolves and
 * links to the order it was redeemed on (see `findOrderIdForCoupon` for why that's a best-effort
 * `orders` lookup rather than the unreadable `usageHistory` subcollection).
 */
export function CouponCard({
  coupon,
  tab,
  customerId,
}: {
  coupon: CouponProps;
  tab: CouponTab;
  customerId: string;
}) {
  const [copied, setCopied] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const muted = tab !== 'active';

  useEffect(() => {
    if (tab !== 'used') return;
    let cancelled = false;
    findOrderIdForCoupon(customerId, coupon.code)
      .then((id) => {
        if (!cancelled) setOrderId(id);
      })
      .catch(() => {
        // Non-fatal — see findOrderIdForCoupon's header. The card just omits the order reference.
      });
    return () => {
      cancelled = true;
    };
  }, [tab, customerId, coupon.code]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(coupon.code);
      setCopied(true);
      toastSuccess('Coupon code copied');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard permission denied/unavailable — the code is already visible on screen to copy by hand.
    }
  }

  return (
    <div
      className={`rounded-xl border p-4 ${
        muted ? 'border-border bg-subtle' : 'border-gold-border bg-gold-subtle'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span
            className={`font-display text-base font-semibold tracking-wide ${
              muted ? 'text-muted' : 'text-gold-strong'
            }`}
          >
            {coupon.code}
          </span>
          <p className="mt-1 text-sm font-medium text-foreground">{formatDiscount(coupon)}</p>
          {coupon.description && <p className="mt-0.5 text-xs text-muted">{coupon.description}</p>}
          {coupon.minimumOrderAmount > 0 && (
            <p className="mt-1 text-[11px] text-faint">Min order {formatInr(coupon.minimumOrderAmount)}</p>
          )}
          <p className="mt-1 text-[11px] text-faint">
            {tab === 'used' ? (
              orderId ? (
                <>
                  Used on{' '}
                  <Link href={`/account/orders/${orderId}`} className="font-medium text-primary hover:underline">
                    order #{orderId.slice(-6).toUpperCase()}
                  </Link>
                </>
              ) : (
                'Used'
              )
            ) : tab === 'expired' ? (
              `Expired ${format(coupon.validUntil.toDate(), 'd MMM yyyy')}`
            ) : (
              /* Spin rewards can be valid for as little as an hour, and this wallet is where the
                 customer comes to find them — a date-only "Expires 3 Aug 2026" would read as "any
                 time today" on a coupon with 40 minutes left. Inside 24h we state the countdown; a
                 longer window keeps the date, which is the more useful form to note down. */
              expiresLabel(coupon.validUntil.toMillis())
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          disabled={muted}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border-strong px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-40"
        >
          {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
