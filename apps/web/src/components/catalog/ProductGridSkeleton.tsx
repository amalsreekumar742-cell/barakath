import { PRODUCT_GRID_CLASS } from './ProductGrid';
import { ProductCardSkeleton } from './ProductCardSkeleton';

export interface ProductGridSkeletonProps {
  /** How many card skeletons to render (default 12 — one page, `Constants.PAGE_SIZE`). */
  count?: number;
  /** Override the columns; defaults to the same set `ProductGrid` uses. */
  className?: string;
}

/**
 * A full grid of card skeletons for a catalogue page's initial load.
 *
 * WHY it reuses `PRODUCT_GRID_CLASS`: sharing the exact column set with `ProductGrid` guarantees the
 * skeleton and the real grid have the same number of columns, so nothing reflows on hand-off. Use
 * this for the first fetch; for a "load more" append a few `ProductCardSkeleton`s at the list foot
 * instead of a whole new grid.
 */
export function ProductGridSkeleton({ count = 12, className = PRODUCT_GRID_CLASS }: ProductGridSkeletonProps) {
  return (
    <div className={className} aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
