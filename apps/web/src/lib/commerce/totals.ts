import type { GeneralSettingsProps } from '@barakath/shared';
import type { CartItem, AppliedCoupon } from '@/types/cart';

/**
 * THIS IS FOR DISPLAY ONLY. `functions/src/orders/createPaymentOrder.ts` (via
 * `service/computeTotals.ts` and `service/coupon.ts`) recomputes every one of these figures
 * server-side from documents it reads itself, and that server figure is the one actually charged —
 * the client is never trusted for money. This file exists so the bag/checkout screens can render a
 * total instantly instead of waiting on a round trip, and so `checkoutThunks.ts` has something to
 * compare the server's real answer against (the "reconcile" step — WEB_BATCH3_NOTES.md §6/§7).
 *
 * The math below is ported near-verbatim from `functions/src/orders/service/computeTotals.ts` and
 * `service/coupon.ts`'s `computeCouponDiscount`, per WEB_BATCH3_NOTES.md §5, NOT from the spec's tax
 * model: no CGST/SGST split (the server returns one flat `gstAmount`), no tax-inclusive/exclusive
 * branching (`DeliverySettings.pricesIncludeTax` exists on the settings type but is never actually
 * read by order pricing — a real, narrow gap in the backend the notes flag rather than paper over),
 * no `spinRewardDiscount` (a spin win is just a coupon, §3). Diverging from the server's actual
 * behaviour here — even to match the spec more "correctly" — would make every single checkout trip
 * the reconciliation prompt for no real reason.
 */

/** Round to 2 decimals so rupee amounts never carry binary-float dust — mirrors the server's `round2`. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** The one slice of `GeneralSettingsProps` this module reads. Narrowed (rather than requiring the
 *  whole settings doc) so a unit test can pass a two-field object instead of a full mock. */
export type TotalsSettings = Pick<GeneralSettingsProps, 'delivery' | 'payment'>;

export interface ComputeTotalsInput {
  items: CartItem[];
  coupon: AppliedCoupon | null;
  /** The signed-in customer's current wallet balance (₹), or 0 for a guest. */
  walletBalance: number;
  /** cartSlice's `walletApplied` toggle — whether the customer opted to spend wallet on this order. */
  walletApplied: boolean;
  /** Null while `general/config` hasn't loaded yet — delivery/GST/wallet-enabled all read as "off". */
  generalSettings: TotalsSettings | null;
}

/** The exact 7-field shape `createPaymentOrder` returns as `OrderTotals` — see WEB_BATCH3_NOTES.md §5.
 *  No `cgst`/`sgst`, no `taxableValue`, no `spinRewardDiscount`. */
export interface TotalsBreakdown {
  subtotal: number;
  couponDiscount: number;
  deliveryCharge: number;
  gstAmount: number;
  grandTotal: number;
  walletAmountUsed: number;
  razorpayAmount: number;
}

const round2Sum = (items: CartItem[]) => round2(items.reduce((s, i) => s + i.unitPrice * i.quantity, 0));

/**
 * Delivery charge — mirrors `computeDeliveryCharge` exactly: a combo product's own
 * `comboDeliveryCharge` REPLACES the standard fee (never adds to it); with several combo lines the
 * LARGEST charge wins (one shipment); the free-delivery threshold only ever waives the STANDARD fee,
 * never a combo charge.
 */
export function computeDeliveryCharge(
  items: CartItem[],
  subtotal: number,
  delivery: GeneralSettingsProps['delivery'],
): number {
  const comboCharges = items.filter((i) => i.isCombo).map((i) => i.comboDeliveryCharge);
  if (comboCharges.length > 0) return round2(Math.max(...comboCharges));
  if (delivery.freeDeliveryThreshold > 0 && subtotal >= delivery.freeDeliveryThreshold) return 0;
  return round2(delivery.standardDeliveryFee);
}

/**
 * The base amount a coupon's discount applies to — the whole subtotal for `applicationType: 'All'`,
 * or the sum of only the matching lines' subtotals for `Category`/`Product`. Returns `null` when a
 * Category/Product coupon matches nothing in the cart — mirrors the server throwing
 * `failed-precondition` in that case: an ineligible cart gets NO discount preview, not a ₹0 one that
 * looks like a bug.
 */
function couponBase(coupon: AppliedCoupon, items: CartItem[], subtotal: number): number | null {
  if (coupon.applicationType === 'Category') {
    const eligible = items.filter((i) => coupon.applicableCategories.includes(i.categoryId));
    if (eligible.length === 0) return null;
    return round2Sum(eligible);
  }
  if (coupon.applicationType === 'Product') {
    const eligible = items.filter((i) => coupon.applicableProducts.includes(i.productId));
    if (eligible.length === 0) return null;
    return round2Sum(eligible);
  }
  return subtotal;
}

/**
 * Preview a coupon's discount — mirrors `computeCouponDiscount` exactly (no per-item proration beyond
 * the category/product base above): `Percentage` → `base * discountValue / 100`, capped at
 * `maximumDiscount` when it is set (> 0); `Fixed` → `discountValue` flat, capped at `base`. Exported
 * (not just used internally) because `lib/commerce/coupons.ts` needs the identical math to show a
 * discount amount next to each coupon in the "Available for you" / "From your spins" lists.
 */
export function computeCouponDiscountPreview(
  coupon: AppliedCoupon,
  subtotal: number,
  items: CartItem[],
): number {
  const base = couponBase(coupon, items, subtotal);
  if (base === null) return 0;
  let discount =
    coupon.discountType === 'Percentage' ? (base * coupon.discountValue) / 100 : coupon.discountValue;
  if (coupon.discountType === 'Percentage' && coupon.maximumDiscount > 0) {
    discount = Math.min(discount, coupon.maximumDiscount);
  }
  return round2(Math.min(discount, base));
}

/**
 * Assemble the full breakdown. Order of operations, exactly matching `computeOrderTotals` and
 * WEB_BATCH3_NOTES.md §5: subtotal → coupon discount (capped at subtotal) → deliveryCharge →
 * gstAmount off (subtotal − discount) → grandTotal → walletAmountUsed = min(requested, grandTotal) →
 * razorpayAmount = grandTotal − walletAmountUsed. Wallet is clamped to [0, grandTotal] so
 * `razorpayAmount` can never go negative and a full-wallet order lands it exactly at 0 (spec §2.15
 * "Full wallet payment allowed").
 */
export function computeTotals({
  items,
  coupon,
  walletBalance,
  walletApplied,
  generalSettings,
}: ComputeTotalsInput): TotalsBreakdown {
  const subtotal = round2Sum(items);
  const couponDiscount = coupon
    ? round2(Math.min(Math.max(computeCouponDiscountPreview(coupon, subtotal, items), 0), subtotal))
    : 0;

  const deliveryCharge = generalSettings
    ? computeDeliveryCharge(items, subtotal, generalSettings.delivery)
    : 0;
  const gstPercentage = generalSettings?.delivery.gstPercentage ?? 0;
  const gstAmount = round2(((subtotal - couponDiscount) * gstPercentage) / 100);
  const grandTotal = round2(subtotal - couponDiscount + deliveryCharge + gstAmount);

  // Wallet toggle reads general/config.payment.walletPaymentsEnabled (WEB_BATCH3_NOTES.md §5) — not
  // `general.walletPayments`, which does not exist on the shared type. An OFF toggle or a disabled
  // setting both mean "spend nothing", never a negative or clamped-elsewhere amount.
  const walletEnabled = generalSettings?.payment.walletPaymentsEnabled ?? false;
  const requestedWallet = walletApplied && walletEnabled ? Math.max(0, walletBalance) : 0;
  const walletAmountUsed = round2(Math.min(requestedWallet, grandTotal));
  const razorpayAmount = round2(grandTotal - walletAmountUsed);

  return { subtotal, couponDiscount, deliveryCharge, gstAmount, grandTotal, walletAmountUsed, razorpayAmount };
}
