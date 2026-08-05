import { CircleBackButton } from '@/components/CircleBackButton';
import { SearchBar } from '@/components/layout/header/SearchBar';
import type { NavCategory } from '@/lib/data/catalog';

/**
 * The search screen's own top bar on mobile — a back button beside a real, focusable search field.
 * Mirrors `apps/app/lib/features/search/presentation/pages/search_page.dart`.
 *
 * WHY this exists: the site header (which owns the only `<input>`) is desktop-only, and the shell's
 * `MobileSearchPill` is a LINK to this page — so on a phone /search had nothing to type into at all,
 * while its own empty state told the visitor to "use the search bar above". The app solves it the
 * same way: the pill is a button everywhere else, and the search screen itself owns the real field.
 *
 * WHY `autoFocus` only when there is no query yet: arriving with nothing to look at, the keyboard
 * should already be up — that is the whole point of the screen. Arriving at RESULTS, popping the
 * keyboard would cover the products the visitor came to see.
 *
 * WHY a Server Component: it only positions two client islands and passes serialisable props.
 */
export interface MobileSearchHeaderProps {
  categories: NavCategory[];
  /** The active query, so the field shows it and can be edited rather than retyped. */
  query: string;
}

export function MobileSearchHeader({ categories, query }: MobileSearchHeaderProps) {
  return (
    <div className="flex items-center gap-3 pb-1 pt-2 lg:hidden">
      <CircleBackButton href="/" label="Back" />
      <SearchBar
        categories={categories}
        className="min-w-0 flex-1"
        placeholder="Search perfumes, books, clothing…"
        autoFocus={!query}
        defaultValue={query}
      />
    </div>
  );
}
