import { ProductGridSkeleton } from '@/components/catalog/ProductGridSkeleton';

/**
 * Route-level loading skeleton (mandatory per the skill's Loading State Policy) — shown while the
 * Server Component above awaits `getFilterFacets`/`buildProductQuery`/`getListingCount` on first
 * navigation into a category. A silhouette of the real layout (sidebar rail + grid) rather than a
 * bare spinner, so nothing jumps when the real content swaps in.
 */
export default function CategoryLoading() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-16 lg:px-5" aria-busy="true">
      <div className="mb-5 h-6 w-56 animate-pulse rounded bg-border" />
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="hidden w-[250px] shrink-0 flex-col gap-6 lg:flex">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl border border-border bg-surface" />
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-5 h-9 w-full max-w-sm animate-pulse rounded-full bg-border" />
          <ProductGridSkeleton />
        </div>
      </div>
    </main>
  );
}
