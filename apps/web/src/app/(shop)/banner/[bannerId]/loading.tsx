import { SkeletonText } from '@/components/Skeleton';
import { PRODUCT_GRID_CLASS } from '@/components/catalog/ProductGrid';
import { ProductCardSkeleton } from '@/components/catalog/ProductCardSkeleton';

/**
 * Initial-load skeleton for /banner/[bannerId] — the 3:1 hero image, title, then a product-grid
 * skeleton (the most common branch, Category-link) so the page doesn't jump when real content lands.
 * The External/None/gone-target branches render far less, so this stays an honest over-approximation
 * rather than trying to predict which branch a given banner will resolve to before the doc is read.
 */
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-16 lg:px-5" aria-busy="true">
      <div className="py-3">
        <SkeletonText width="w-40" className="h-4" />
      </div>

      <div className="mb-6 aspect-[3/1] w-full animate-pulse rounded-2xl bg-border" />

      <div className="mb-6">
        <SkeletonText width="w-64" className="h-7" />
      </div>

      <div className={PRODUCT_GRID_CLASS} aria-hidden>
        {Array.from({ length: 8 }, (_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    </main>
  );
}
