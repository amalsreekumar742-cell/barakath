import Link from 'next/link';
import { Layers, LayoutGrid } from 'lucide-react';
import type { CategoryProps, SubCategoryProps } from '@barakath/shared';

export interface TaxonomyChipsProps {
  categories: CategoryProps[];
  subcategories: SubCategoryProps[];
  /** Sub-category `mainCategoryId` -> parent category name, for `/category/[name]?subCategory=`. */
  categoryNameById: Map<string, string>;
}

/**
 * The compact category/sub-category match row spec 3.20 asks for ABOVE the product grid.
 *
 * WHY a separate row and not mixed into the grid: a category chip and a `ProductCard` answer
 * different questions ("browse this whole section" vs "buy this exact item") and render at a
 * completely different visual weight — interleaving them into one grid would either shrink the chips
 * to card-size (losing their purpose as a shortcut) or break the grid's uniform card sizing.
 *
 * WHY a sub-category without a resolvable parent still gets a link (to `/search?q=`) rather than
 * being dropped: `categoryNameById` is only populated from a bounded `getCategories()` read, so a
 * category beyond that cap (or a data inconsistency) should degrade to "search this term" instead of
 * silently disappearing.
 */
export function TaxonomyChips({ categories, subcategories, categoryNameById }: TaxonomyChipsProps) {
  if (categories.length === 0 && subcategories.length === 0) return null;

  return (
    <div className="mb-5 flex flex-wrap gap-2">
      {categories.map((category) => (
        <Link
          key={category.id}
          href={`/category/${encodeURIComponent(category.name)}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary-subtle px-3 py-1.5 text-xs font-bold text-primary transition hover:bg-primary hover:text-white"
        >
          <LayoutGrid className="size-3.5" aria-hidden />
          {category.name}
        </Link>
      ))}
      {subcategories.map((subcategory) => {
        const parentName = categoryNameById.get(subcategory.mainCategoryId);
        const href = parentName
          ? `/category/${encodeURIComponent(parentName)}?subCategory=${encodeURIComponent(subcategory.name)}`
          : `/search?q=${encodeURIComponent(subcategory.name)}`;
        return (
          <Link
            key={subcategory.id}
            href={href}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-subtle px-3 py-1.5 text-xs font-bold text-foreground transition hover:border-primary hover:text-primary"
          >
            <Layers className="size-3.5" aria-hidden />
            {subcategory.name}
          </Link>
        );
      })}
    </div>
  );
}
