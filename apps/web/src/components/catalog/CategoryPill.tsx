import Link from 'next/link';
import type { CategoryProps } from '@barakath/shared';

export interface CategoryPillProps {
  category: CategoryProps;
  /** Renders the selected/active styling (e.g. the current category on a listing page). */
  active?: boolean;
  className?: string;
}

/**
 * A category chip for the home strip and listing filter rail.
 *
 * WHY it links by `category.name`, not id: the catalogue route is `/category/[categoryName]` (see the
 * search dropdown and the `(shop)/category` route), so the whole site addresses a category by its
 * name. Encoding it keeps names with spaces or `&` valid in the URL.
 */
export function CategoryPill({ category, active = false, className = '' }: CategoryPillProps) {
  return (
    <Link
      href={`/category/${encodeURIComponent(category.name)}`}
      aria-current={active ? 'page' : undefined}
      className={[
        'inline-flex shrink-0 items-center rounded-full border px-4 py-2 text-sm font-semibold transition',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        active
          ? 'border-primary bg-primary text-white'
          : 'border-border-strong bg-surface text-foreground hover:border-primary hover:text-primary',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {category.name}
    </Link>
  );
}
