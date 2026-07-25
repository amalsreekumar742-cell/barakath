import Link from 'next/link';
import Image from 'next/image';
import { Layers } from 'lucide-react';
import type { CategoryProps } from '@barakath/shared';

export interface CategoryCardProps {
  category: CategoryProps;
  /**
   * Home's "Shop by category" strip (spec 3.4) draws image + name ONLY — no subtitle line, unlike the
   * `/categories` directory page which lists sub-categories to help someone choose. Defaults to
   * showing the subtitle so the categories page needs no change; the home page passes `true`.
   */
  hideSubtitle?: boolean;
}

/**
 * The category tile for the home "Shop by category" strip and the categories page (design: a rounded
 * card, image on top, name in 800, and — except on the home strip, see `hideSubtitle` — a muted line
 * of its sub-categories).
 *
 * WHY the subtitle is the sub-category names and not the product count: the design shows
 * "Attar · Oud · EDP" — it tells the customer what is inside, which the count does not. It falls back
 * to the product count only when a category has no sub-categories to list.
 *
 * WHY it links by `category.name`: the catalogue route is `/category/[categoryName]`, so categories
 * are addressed by name across the site (same as `CategoryPill` and the search dropdown).
 */
export function CategoryCard({ category, hideSubtitle = false }: CategoryCardProps) {
  const subtitle =
    category.subCategoryNames.length > 0
      ? category.subCategoryNames.slice(0, 3).join(' · ')
      : `${category.productCount} ${category.productCount === 1 ? 'product' : 'products'}`;

  return (
    <Link
      href={`/category/${encodeURIComponent(category.name)}`}
      className="group block overflow-hidden rounded-2xl border border-border bg-surface transition hover:border-border-strong hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-subtle">
        {category.image ? (
          <Image
            src={category.image}
            alt={category.name}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-cover transition group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-faint" aria-hidden>
            <Layers size={28} />
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="truncate font-display text-base font-semibold text-foreground">
          {category.name}
        </div>
        {!hideSubtitle && <div className="mt-1 truncate text-xs text-muted">{subtitle}</div>}
      </div>
    </Link>
  );
}
