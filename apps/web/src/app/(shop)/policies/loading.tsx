import { SkeletonText } from '@/components/Skeleton';

/**
 * Initial-load skeleton for /policies — breadcrumb, title, then the grouped list card.
 *
 * WHY this file exists: without it the nearest boundary is `(shop)/loading.tsx`, which is the HOME
 * skeleton (hero strip, category grid, product rails) — flashing that before a short list of links
 * reads as a page that is about to turn into something else.
 */
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-[820px] px-5 pb-16" aria-busy="true">
      <div className="py-3">
        <SkeletonText width="w-32" className="h-4" />
      </div>
      <SkeletonText width="w-40" className="h-8" />
      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-surface" aria-hidden>
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 px-4 py-[15px] ${i > 0 ? 'border-t border-border' : ''}`}
          >
            <SkeletonText width="w-5" className="h-5" />
            <div className="flex-1 space-y-1.5">
              <SkeletonText width="w-1/3" className="h-4" />
              <SkeletonText width="w-1/4" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
