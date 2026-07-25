import { SkeletonText } from '@/components/Skeleton';

/**
 * Initial-load skeleton for /categories — mirrors `CategoryDirectoryCard`'s exact shape (16:10 image,
 * name line, a short row of pill-shaped bars) so nothing reflows when the real grid replaces it.
 */
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-16 lg:px-5" aria-busy="true">
      <div className="py-3">
        <SkeletonText width="w-40" className="h-4" />
      </div>

      <div className="mb-6 space-y-2">
        <SkeletonText width="w-56" className="h-7" />
        <SkeletonText width="w-72" className="h-4" />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-5" aria-hidden>
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-border bg-surface">
            <div className="aspect-[16/10] w-full animate-pulse bg-border" />
            <div className="space-y-3 p-4">
              <SkeletonText width="w-2/3" className="h-4" />
              <div className="flex gap-1.5">
                <SkeletonText width="w-12" className="h-5 rounded-full" />
                <SkeletonText width="w-14" className="h-5 rounded-full" />
                <SkeletonText width="w-10" className="h-5 rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
