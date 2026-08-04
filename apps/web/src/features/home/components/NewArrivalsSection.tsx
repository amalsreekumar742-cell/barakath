import type { ProductProps } from '@barakath/shared';
import { SectionHeader } from '@/components/catalog/SectionHeader';
import { ProductCard } from '@/components/catalog/ProductCard';
import { ProductRail } from './ProductRail';

export interface NewArrivalsSectionProps {
  products: ProductProps[];
}

/**
 * The home "New Arrivals" rail (spec §3.4) — same horizontal-scroll-on-mobile / 4-up-grid-on-desktop
 * treatment as the flash-sale rail (`ProductRail`), but with the plain shared `ProductCard`: new
 * arrivals carry no flash pricing, so the denormalised `product.minPrice`/`maxPrice` range `ProductCard`
 * already renders is the correct price — no per-variant resolution needed here.
 */
export function NewArrivalsSection({ products }: NewArrivalsSectionProps) {
  if (products.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-10 lg:px-5">
      <SectionHeader title="New Arrivals" actionHref="/category/all?new=true" actionLabel="See all" />
      <div className="mt-5">
        {/* Card width is released at `md:` — the same breakpoint ProductRail switches from
            snap-carousel to grid at — and never at `sm:`, per the cascade note in globals.css. */}
        <ProductRail>
          {products.map((product) => (
            <div key={product.id} className="w-40 shrink-0 snap-start md:w-auto">
              <ProductCard product={product} />
            </div>
          ))}
        </ProductRail>
      </div>
    </section>
  );
}
