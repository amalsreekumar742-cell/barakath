import type { ProductProps } from '@barakath/shared';
import { SectionHeader } from '@/components/catalog/SectionHeader';
import { ProductGrid } from '@/components/catalog/ProductGrid';

/**
 * Related products (spec §3.7) — purely presentational; the page fetches `products` via
 * `getRelatedProducts` (see `data/getRelatedProducts.ts` for the derivation rule — a spec gap) inside
 * its own try/catch so a failure there degrades to "section hidden", not a page-wide error boundary.
 */
export function RelatedProducts({ products }: { products: ProductProps[] }) {
  if (products.length === 0) return null;

  return (
    <section>
      <SectionHeader title="Related products" />
      <ProductGrid products={products} className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4" />
    </section>
  );
}
