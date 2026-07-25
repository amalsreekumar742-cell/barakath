'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Clock, SearchX, X } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { useRecentSearches } from '../../hooks/useRecentSearches';

/**
 * The recent-searches surface on `/search` — reuses W1's `useRecentSearches` hook (localStorage,
 * SSR-guarded, capped at `Constants.MAX_RECENT_SEARCHES`) rather than a second implementation.
 *
 * WHY one component with a `variant` prop instead of two: both surfaces render the exact same pills
 * (term + remove button) with a "Clear all" action — the only difference is layout (a full block when
 * there is no query yet, vs a compact row above results) and which the task calls "the MAIN content"
 * vs "shown above results". Splitting them would duplicate the remove/clear wiring for no reason.
 *
 * WHY `recordTerm`: a visitor can land on `/search?q=…` directly (a shared link, a bookmark) without
 * ever going through the header's `onPickTerm`, which is the only place that currently records a
 * search. The results page is the one place that KNOWS the query actually returned something, so it
 * is the right place to add it to history — recording a query that returned zero results would pollute
 * the list with dead ends.
 */
export interface RecentSearchesProps {
  variant: 'main' | 'pills';
  /** Set only when the current query produced ≥1 result — added to history once, on mount. */
  recordTerm?: string;
}

export function RecentSearches({ variant, recordTerm }: RecentSearchesProps) {
  const { recent, add, remove, clear } = useRecentSearches();

  useEffect(() => {
    if (recordTerm) add(recordTerm);
    // `add` comes from `useCallback` with a stable dependency chain in the hook, so including it here
    // does not cause an extra run — this only re-fires when the query itself changes.
  }, [recordTerm, add]);

  if (variant === 'pills') {
    if (recent.length === 0) return null;
    return (
      <div className="mb-4 flex flex-wrap items-center gap-2" aria-label="Recent searches">
        <span className="flex items-center gap-1 text-xs font-bold text-faint">
          <Clock className="size-3.5" aria-hidden /> Recent:
        </span>
        {recent.map((term) => (
          <Pill key={term} term={term} onRemove={() => remove(term)} />
        ))}
        <button
          type="button"
          onClick={clear}
          className="text-xs font-bold text-primary hover:underline"
        >
          Clear all
        </button>
      </div>
    );
  }

  // variant === 'main' — this IS the page body when there is no `?q=` yet.
  if (recent.length === 0) {
    return (
      <EmptyState
        icon={<SearchX className="size-12" aria-hidden />}
        title="Search the store"
        subtitle="Use the search bar above to find perfumes, books, clothing and Islamic essentials."
      />
    );
  }
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-muted">
          Recent searches
        </h2>
        <button
          type="button"
          onClick={clear}
          className="text-xs font-bold text-primary hover:underline"
        >
          Clear all
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {recent.map((term) => (
          <Pill key={term} term={term} onRemove={() => remove(term)} large />
        ))}
      </div>
    </div>
  );
}

/** One removable pill. The term itself is a real `<Link>` (re-runs the search); the `X` only removes
 * it from history — two different actions on one row, so they are two separate hit targets. */
function Pill({ term, onRemove, large }: { term: string; onRemove: () => void; large?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-subtle font-medium text-foreground ${
        large ? 'py-2 pl-4 pr-2 text-sm' : 'py-1 pl-3 pr-1.5 text-xs'
      }`}
    >
      <Link href={`/search?q=${encodeURIComponent(term)}`} className="hover:text-primary">
        {term}
      </Link>
      <button
        type="button"
        aria-label={`Remove ${term} from recent searches`}
        onClick={onRemove}
        className="rounded-full p-1 text-faint hover:bg-border hover:text-foreground"
      >
        <X className="size-3" aria-hidden />
      </button>
    </span>
  );
}
