import type { ReactNode } from 'react';
import type { ProductProps } from '@barakath/shared';

import { ProductCard } from './ProductCard';

/**
 * The one responsive column set every product grid uses — 2-up on mobile, 3-up on tablet, 4-up on
 * desktop and 5-up on wide screens, matching the design's rails and listing.
 *
 * WHY it is exported: the grid and its skeleton MUST share these exact columns, or the layout
 * reflows the instant real cards replace the skeleton — the one thing a skeleton exists to prevent.
 * `ProductGridSkeleton` imports this so they can never drift.
 */
export const PRODUCT_GRID_CLASS =
  'grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';

export interface ProductGridProps {
  /** When given, each product is mapped to a `ProductCard`. */
  products?: ProductProps[];
  /** Alternatively, pass pre-built children (e.g. a mix of cards and ad tiles). */
  children?: ReactNode;
  /** Override the default column set (e.g. a fixed 5-up home rail). */
  className?: string;
}

/**
 * A responsive product grid. Pass `products` to have it render `ProductCard`s, or `children` to lay
 * out arbitrary tiles in the same grid.
 *
 * WHY a Server Component: it renders `ProductCard` (itself server-renderable), so a catalogue page
 * stays static HTML end to end. Interactivity lives only in the per-card wishlist island.
 */
export function ProductGrid({ products, children, className = PRODUCT_GRID_CLASS }: ProductGridProps) {
  return (
    <div className={className}>
      {products
        ? products.map((product) => <ProductCard key={product.id} product={product} />)
        : children}
    </div>
  );
}
