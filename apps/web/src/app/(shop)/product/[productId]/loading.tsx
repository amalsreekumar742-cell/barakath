import { SkeletonText } from '@/components/Skeleton';

/**
 * Full-screen skeleton for the product detail page, matching the real two-column layout (gallery left,
 * info right) so nothing reflows when the real content streams in (Loading State Policy).
 */
export default function Loading() {
  return (
    <main aria-busy className="mx-auto w-full max-w-[1280px] px-5 pb-16">
      <div className="animate-pulse py-3">
        <SkeletonText width="w-64" />
      </div>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        {/* Gallery skeleton */}
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="order-2 flex gap-2 lg:order-1 lg:w-20 lg:flex-col">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="size-16 shrink-0 animate-pulse rounded-lg bg-border lg:size-20" />
            ))}
          </div>
          <div className="order-1 aspect-square w-full flex-1 animate-pulse rounded-xl bg-border lg:order-2" />
        </div>

        {/* Info column skeleton */}
        <div>
          <SkeletonText width="w-3/4" className="h-7" />
          <SkeletonText width="w-40" className="mt-3" />
          <SkeletonText width="w-48" className="mt-5 h-8" />
          <div className="mt-6 flex gap-2.5">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="size-9 animate-pulse rounded-full bg-border" />
            ))}
          </div>
          <SkeletonText width="w-32" className="mt-6" />
          <div className="mt-6 h-12 animate-pulse rounded-md bg-border" />
        </div>
      </div>

      <div className="mt-14 flex flex-col gap-8">
        <SkeletonText width="w-40" className="h-6" />
        <SkeletonText />
        <SkeletonText width="w-5/6" />
        <SkeletonText width="w-2/3" />
      </div>
    </main>
  );
}
