import { SearchX } from 'lucide-react';
import type { ProductProps } from '@barakath/shared';
import { ProductGrid } from '@/components/catalog/ProductGrid';
import { SEARCH_RESULTS_GRID_CLASS } from '../constants';

export interface NoResultsSuggestionsProps {
  query: string;
  suggestions: ProductProps[];
}

/**
 * Spec 3.20's no-results state — the ONE place spec 3.25's "empty state is a message and nothing
 * else" rule is explicitly overridden. Everywhere else that bare rule is deliberate (see
 * `EmptyState`'s own doc comment: a competing call-to-action on every empty screen is noise). But
 * `/search` exists entirely to help someone find something, so a dead end here is the worst possible
 * version of this page — pairing the message with real, in-stock alternatives is the point, not scope
 * creep.
 */
export function NoResultsSuggestions({ query, suggestions }: NoResultsSuggestionsProps) {
  return (
    <div>
      <div className="flex min-h-[24vh] flex-col items-center justify-center px-6 text-center">
        <SearchX className="mb-4 size-12 text-faint" aria-hidden />
        <p className="font-display text-base font-extrabold text-foreground">
          No results for &ldquo;{query}&rdquo;
        </p>
        <p className="mt-1.5 max-w-sm text-sm text-muted">
          Check your spelling or try a shorter, more general term.
        </p>
      </div>

      {suggestions.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-4 font-display text-lg font-extrabold text-foreground">You might like</h2>
          <ProductGrid products={suggestions} className={SEARCH_RESULTS_GRID_CLASS} />
        </div>
      )}
    </div>
  );
}
