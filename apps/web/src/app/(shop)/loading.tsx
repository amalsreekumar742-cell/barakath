import { SkeletonText } from '@/components/Skeleton';
import { ProductGridSkeleton } from '@/components/catalog/ProductGridSkeleton';

/**
 * The home route's initial-load skeleton (Next.js `loading.tsx`, streamed while `page.tsx` awaits its
 * `Promise.all`). Mirrors each section's real shape — hero strip, a 4-up category grid, the static
 * spin banner's footprint, and two product rails — so nothing reflows when the real sections replace
 * it (Loading State Policy: full-screen skeleton matching the real layout on initial load).
 */
export default function HomeLoading() {
  return (
    <main aria-busy="true">
      {/* Hero carousel — same 3:1 aspect the real carousel renders at. */}
      <div className="aspect-[3/1] w-full animate-pulse bg-border" />

      {/* Shop by Category */}
      <section className="mx-auto w-full max-w-7xl px-4 py-10 lg:px-5">
        <SkeletonText width="w-48" className="h-6" />
        <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="aspect-[16/10] animate-pulse rounded-2xl bg-border" />
          ))}
        </div>
      </section>

      {/* Spin & Win static banner */}
      <section className="mx-auto w-full max-w-7xl px-4 py-2 lg:px-5">
        <div className="h-44 w-full animate-pulse rounded-2xl bg-border" />
      </section>

      {/* Flash sale */}
      <section className="mx-auto w-full max-w-7xl px-4 py-10 lg:px-5">
        <SkeletonText width="w-40" className="h-6" />
        <div className="mt-5">
          <ProductGridSkeleton
            count={5}
            className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
          />
        </div>
      </section>

      {/* New arrivals */}
      <section className="mx-auto w-full max-w-7xl px-4 py-10 lg:px-5">
        <SkeletonText width="w-40" className="h-6" />
        <div className="mt-5">
          <ProductGridSkeleton
            count={5}
            className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
          />
        </div>
      </section>
    </main>
  );
}
