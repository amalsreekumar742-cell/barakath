import Link from 'next/link';
import Image from 'next/image';
import { ImageOff, Star } from 'lucide-react';
import { StockStatus, type ProductProps } from '@barakath/shared';

import { PriceBlock } from './PriceBlock';
import { WishlistHeart } from './WishlistHeart';

export interface ProductCardProps {
  product: ProductProps;
}

/**
 * The catalogue product tile — shared by home rails, listing, search and wishlist so every surface
 * renders a product identically. Change it here, never by forking a copy into a page.
 *
 * WHY a Server Component with a single client island (the heart): catalogue grids must be
 * server-rendered for SEO, and a product card is otherwise pure presentation. Keeping the only
 * interactive part — the wishlist toggle — in its own `'use client'` child lets the whole grid ship
 * as static HTML while the heart still hydrates.
 *
 * The layout mirrors the Flutter card (`apps/app/.../product_card.dart`) and the design board: a
 * bordered white panel with the image, a department pill and wishlist heart over it, then the name,
 * a subtitle, and TWO lines for the price — the price owns the first, the rating the second — so
 * neither number has to shrink and clip.
 */
export function ProductCard({ product }: ProductCardProps) {
  // Prefer the denormalised thumbnail, fall back to the first gallery image, guard an empty product.
  const image = product.thumbnail || product.images[0] || '';
  // The pill shows the department: sub-category when present, else the category (matches Flutter).
  const pill = product.subCategoryName?.trim() || product.categoryName?.trim() || '';
  // Show the category as a subtitle only when it is not already the pill text, to avoid a duplicate.
  const subtitle =
    product.categoryName && product.categoryName.trim() !== pill ? product.categoryName.trim() : '';
  const outOfStock = product.stockStatus === StockStatus.OUT_OF_STOCK;
  // 0 means "unrated", not "rated zero" — gate the rating off the count, never the average.
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
            sizes="(max-width: 768px) 50vw, (max-width: 1280px) 25vw, 20vw"
            className={`object-cover transition group-hover:scale-[1.03] ${outOfStock ? 'opacity-45' : ''}`}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-faint" aria-hidden>
            <ImageOff size={28} />
          </div>
        )}

        {pill && (
          <span className="absolute left-2 top-2 max-w-[60%] truncate rounded-full bg-surface/90 px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide text-gold-strong backdrop-blur">
            {pill}
          </span>
        )}

        <WishlistHeart productId={product.id} className="absolute right-2 top-2" />

        {outOfStock && (
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md bg-ink/75 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-white">
            Out of stock
          </span>
        )}
      </div>

      <h3 className="mt-2.5 line-clamp-2 text-sm font-bold leading-snug text-foreground">
        {product.name}
      </h3>

      {subtitle && <p className="mt-0.5 truncate text-xs text-muted">{subtitle}</p>}

      <div className="mt-2 flex items-end justify-between gap-2">
        <PriceBlock minPrice={product.minPrice} maxPrice={product.maxPrice} />
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
