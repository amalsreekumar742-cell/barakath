import type { ProductProps } from '@barakath/shared';

/**
 * Indian-rupee formatter with lakh/crore digit grouping (12,34,567 — not 1,234,567).
 *
 * WHY a module-level `Intl.NumberFormat` instance: constructing one is comparatively expensive and a
 * catalogue grid formats a price on every card; a single reused formatter keeps that free. `en-IN`
 * gives the Indian grouping the storefront must use, and `maximumFractionDigits: 0` mirrors the
 * Flutter card (`toStringAsFixed(0)`) so the same product reads identically in both clients.
 */
const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/** Format a number as `₹1,23,456` (Indian grouping, no decimals). Exported for reuse across catalog. */
export function formatInr(amount: number): string {
  return `₹${inr.format(Math.round(amount))}`;
}

/**
 * The percent saved of `mrp` against the current (offer) price, rounded, or 0 when there is no
 * genuine discount. Exported so a caller that lays the discount out differently (product detail puts
 * it inline with the price) can reuse the exact same arithmetic instead of re-deriving it.
 *
 * WHY compared against `minPrice`: when a product spans a price range the headline is the "from"
 * price (the lowest variant), so the saving is stated against that anchor — matching how the card
 * reads "from ₹X". For a single price `minPrice === maxPrice`, so this collapses to the Flutter
 * card's `(mrp - offer) / mrp` exactly. Rounded so 27.6% reads "28% off" like the design; a saving
 * that rounds to 0 is dropped rather than shown as "0% off".
 */
export function discountPercent(minPrice: number, mrp?: number): number {
  if (mrp == null || mrp <= 0 || mrp <= minPrice) return 0;
  return Math.round(((mrp - minPrice) / mrp) * 100);
}

export interface PriceBlockProps {
  /** The current (offer) price, or the low end of the variant offer-price range. */
  minPrice: number;
  /** The high end of the range; equal to `minPrice` when the product has one price. */
  maxPrice: number;
  /**
   * The comparison / struck-through price (a variant MRP). Optional because the denormalised
   * `ProductProps` a grid card renders from carries no MRP — only the offer-price range — so a grid
   * card shows the price alone, and only a caller that has the variant (product detail) passes an MRP
   * to get the strikethrough and "% off".
   */
  mrp?: number;
  className?: string;
}

/**
 * The price block shared by the card, listing, product detail and search.
 *
 * Line 1 is the price the customer pays — a `₹min – ₹max` range when the variants differ, otherwise
 * a single figure — in gold, with the MRP struck through beside it when it is genuinely higher.
 * Line 2 is the "NN% off" saving, shown only when there is one to state.
 *
 * WHY the price is never allowed to be the thing that shrinks: in the Flutter app the price, the MRP
 * and the rating once competed for one row and "₹3,240" clipped to "₹21…". Here the MRP is the
 * flexible element (`truncate`), the price is not — so the number the customer actually pays can
 * never be the one that gets cut.
 */
export function PriceBlock({ minPrice, maxPrice, mrp, className = '' }: PriceBlockProps) {
  const hasRange = minPrice !== maxPrice;
  const priceLabel = hasRange
    ? `${formatInr(minPrice)} – ${formatInr(maxPrice)}`
    : formatInr(minPrice);
  const showMrp = mrp != null && mrp > minPrice;
  const off = discountPercent(minPrice, mrp);

  return (
    <div className={className}>
      <div className="flex items-baseline gap-2">
        <span className="font-display text-base font-extrabold text-gold-strong">{priceLabel}</span>
        {showMrp && (
          <span className="min-w-0 truncate text-xs text-faint line-through">{formatInr(mrp!)}</span>
        )}
      </div>
      {off > 0 && (
        <div className="mt-0.5 text-[11px] font-bold text-success">{off}% off</div>
      )}
    </div>
  );
}

/**
 * Convenience helper so a caller holding a whole `ProductProps` (which has no MRP) does not have to
 * remember which fields feed the price block.
 */
export function productPriceBlockProps(product: ProductProps): PriceBlockProps {
  return { minPrice: product.minPrice, maxPrice: product.maxPrice };
}
