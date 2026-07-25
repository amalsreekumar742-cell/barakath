import type { CategoryProps } from '@barakath/shared';
import { SectionHeader } from '@/components/catalog/SectionHeader';
import { CategoryCard } from '@/components/catalog/CategoryCard';

export interface CategorySectionProps {
  categories: CategoryProps[];
}

/**
 * "Shop by Category" (spec §3.4) — 4/3/2 columns desktop/tablet/mobile, per the responsive rules in
 * spec §3.24 (`lg` 1024 = desktop, `md` 768 = tablet). Spec §3.4 wants image + name ONLY here (no
 * subtitle) — `CategoryCard` now takes `hideSubtitle` for exactly this, so the home strip and the
 * `/categories` directory page (which DOES want the sub-category line) share one component.
 */
export function CategorySection({ categories }: CategorySectionProps) {
  if (categories.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-10 lg:px-5">
      <SectionHeader title="Shop by Category" actionHref="/categories" actionLabel="See all" />
      <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {categories.map((category) => (
          <CategoryCard key={category.id} category={category} hideSubtitle />
        ))}
      </div>
    </section>
  );
}
