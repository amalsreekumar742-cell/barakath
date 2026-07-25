import { SkeletonText } from '@/components/Skeleton';

/**
 * One product card's silhouette while a grid is loading.
 *
 * WHY it mirrors `ProductCard`'s exact shape (square image, name, subtitle, price): a skeleton whose
 * proportions match the real card means the page does not jump when the data arrives. Built from the
 * shared `Skeleton` primitive so there is one pulse style across the app.
 */
export function ProductCardSkeleton() {
  return (
    <div aria-hidden className="rounded-2xl border border-border bg-surface p-3 shadow-sm">
      <div className="aspect-square w-full animate-pulse rounded-lg bg-border" />
      <div className="mt-3 space-y-2">
        <SkeletonText />
        <SkeletonText width="w-2/3" />
        <SkeletonText width="w-1/3" className="mt-1 h-4" />
      </div>
    </div>
  );
}
