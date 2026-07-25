import { formatInr } from '@/components/catalog/PriceBlock';
import type { SpinWheelResponse } from '../api/submitSpin';

type CouponDetails = NonNullable<SpinWheelResponse['couponDetails']>;

/**
 * "10% off, up to ₹200" / "₹50 off" — a human amount line for the win card.
 *
 * WHY duplicated (not imported) from `features/coupons/components/CouponCard.tsx`'s near-identical
 * `formatDiscount`: `import/no-restricted-paths` forbids `features/spinner` importing
 * `features/coupons` (no exception is carved out for this pair, unlike `coupons -> account`), and this
 * is a small, self-contained formatter — not worth a shared-module promotion for two call sites.
 * `formatInr` itself IS shared (`src/components/catalog/PriceBlock.tsx`), so only this thin wrapper is
 * duplicated, not the currency formatting itself.
 */
export function formatSpinRewardAmount(details: CouponDetails): string {
  if (details.discountType === 'Percentage') {
    return details.maximumDiscount > 0
      ? `${details.discountValue}% off, up to ${formatInr(details.maximumDiscount)}`
      : `${details.discountValue}% off`;
  }
  return `${formatInr(details.discountValue)} off`;
}

/** "Min order ₹50" — null when the coupon has no minimum, so the caller can omit the line entirely. */
export function spinConditionsLine(details: CouponDetails): string | null {
  return details.minimumOrderAmount > 0 ? `Min order ${formatInr(details.minimumOrderAmount)}` : null;
}
