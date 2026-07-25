import Link from 'next/link';
import Image from 'next/image';
import { ImageOff, Star } from 'lucide-react';
import { StockStatus, type ProductProps, type VariantProps } from '@barakath/shared';
import { PriceBlock } from '@/components/catalog/PriceBlock';
import { WishlistHeart } from '@/components/catalog/WishlistHeart';
import { resolvePrice } from '@/lib/pricing';

export interface FlashProductCardProps {
  product: ProductProps;
  variant: VariantProps;
}

/**
 * A card for a product on an ACTIVE flash sale — deliberately not `ProductCard`.
 *
 * WHY: `ProductCard` renders `PriceBlock` from `product.minPrice`/`maxPrice`, which are the
 * denormalised variant OFFER-price range (`packages/shared/src/types/product.ts`) — never the flash
 * price. During a live flash sale the offer price must be HIDDEN and the flash price shown instead,
 * with the MRP struck through and the discount recomputed against it (spec §1.16). `ProductCard` has
 * no variant/price-override prop — a product doc alone doesn't carry the flash price, only a specific
 * VARIANT does (`flashSaleManager` writes `flashSalePrice` per variant, never onto the product). This
 * card reuses `ProductCard`'s exact markup and shared atoms (`PriceBlock`, `WishlistHeart`) so the two
 * are visually identical — it only swaps which numbers feed `PriceBlock`, via
 * `resolvePrice(product, variant)` (the single pricing truth, `@/lib/pricing`).
 *
 * WHY it needs the CALLER to supply `variant`: rendering this card correctly requires one variant read
 * per product (`getFirstVariantByProduct`), which is why it is used selectively — the home flash rail
 * (a bounded 8 items) and the listing page's "On Sale" quick filter (every card on that view is
 * guaranteed `isFlashSale`, so the mismatch would otherwise be on 100% of the grid) — rather than
 * unconditionally on every product grid in the app.
 */
export function FlashProductCard({ product, variant }: FlashProductCardProps) {
  const { displayPrice, mrp, discountPercent } = resolvePrice(product, variant);
  const image = product.thumbnail || product.images[0] || '';
  const outOfStock = product.stockStatus === StockStatus.OUT_OF_STOCK;
  const showRating = product.totalReviews > 0;

  return (
    <Link
      href={`/product/${product.id}`}
      className="group block rounded-2xl border border-border bg-surface p-3 shadow-sm transition hover:border-border-strong hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-subtle">
        {image ? (
          <Image
            src={image}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 40vw, (max-width: 1280px) 25vw, 20vw"
            className={`object-cover transition group-hover:scale-[1.03] ${outOfStock ? 'opacity-45' : ''}`}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-faint" aria-hidden>
            <ImageOff size={28} />
          </div>
        )}

        {/* The design's flash card leads with the discount, not the category, in this corner —
            deliberately different from the regular ProductCard's category pill in the same spot. */}
        {discountPercent > 0 && (
          <span className="absolute left-2 top-2 rounded-full bg-error px-2 py-1 text-[10px] font-semibold text-white">
            -{discountPercent}%
          </span>
        )}

        <WishlistHeart productId={product.id} className="absolute right-2 top-2" />

        {outOfStock && (
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md bg-ink/75 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
            Out of stock
          </span>
        )}
      </div>

      <h3 className="mt-2.5 line-clamp-2 text-sm font-bold leading-snug text-foreground">
        {product.name}
      </h3>

      <div className="mt-2 flex items-end justify-between gap-2">
        <PriceBlock minPrice={displayPrice} maxPrice={displayPrice} mrp={mrp} />
        {showRating && (
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-muted">
            <Star size={13} strokeWidth={2} className="text-gold" aria-hidden />
            {product.averageRating.toFixed(1)}
          </span>
        )}
      </div>
    </Link>
  );
}
