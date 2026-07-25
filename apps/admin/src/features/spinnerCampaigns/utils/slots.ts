import type { SlotInput } from '../types';

/**
 * probabilitySum — total of every slot's probability, rounded to 2 decimals to absorb float noise.
 * WHY rounded: the admin can enter fractional probabilities (e.g. 12.5); summing raw floats can yield
 * 99.99999998, so we round before the ===100 comparison the form + thunks use to accept a campaign.
 */
export function probabilitySum(slots: { probability: number }[]): number {
  const total = slots.reduce((s, x) => s + (Number.isFinite(x.probability) ? x.probability : 0), 0);
  return Math.round(total * 100) / 100;
}

/** True when the slot probabilities sum to exactly 100 — the campaign's wheel-integrity invariant. */
export function probabilitiesValid(slots: { probability: number }[]): boolean {
  return probabilitySum(slots) === 100;
}

/**
 * sliceAngles — cumulative start/sweep angles (degrees) for each slot, proportional to its probability.
 * WHY compute from probability (not equal wedges): the wheel must VISUALLY represent the odds, so a 50%
 * slot occupies half the wheel. Used by the SVG wheel to draw each conic wedge. Starts at -90° so the
 * first wedge begins at the top (12 o'clock), the natural reading start for a spinner.
 */
export function sliceAngles(
  slots: { probability: number }[],
): { start: number; end: number; mid: number }[] {
  const total = probabilitySum(slots) || 1; // guard divide-by-zero on an empty/all-zero draft
  let cursor = -90;
  return slots.map((s) => {
    const sweep = (s.probability / total) * 360;
    const start = cursor;
    const end = cursor + sweep;
    cursor = end;
    return { start, end, mid: (start + end) / 2 };
  });
}

/**
 * Convert a form SlotInput into the persisted SpinnerSlotProps field shape. A `Better luck` slot carries
 * no discount, so its coupon/discount fields are zeroed — the customer app should never read a discount
 * off a losing wedge.
 */
export function slotInputToDoc(s: SlotInput) {
  const isCoupon = s.type === 'Coupon';
  return {
    id: s.id,
    label: s.label.trim(),
    type: s.type,
    couponCode: isCoupon ? s.couponCode.trim().toUpperCase() : '',
    couponId: isCoupon ? s.couponId : '',
    discountType: s.discountType,
    discountValue: isCoupon ? s.discountValue : 0,
    minimumOrderAmount: isCoupon ? s.minimumOrderAmount : 0,
    // Max discount only meaningful for a percentage coupon; zero it otherwise.
    maximumDiscount: isCoupon && s.discountType === 'Percentage' ? s.maximumDiscount : 0,
    probability: s.probability,
    color: s.color,
  };
}
