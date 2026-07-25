'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowUpRight, Clock, Layers, LayoutGrid, Loader2, Search, X } from 'lucide-react';
import { Constants } from '@/config/constants';
import type { NavCategory } from '@/lib/data/catalog';
import { useSearchSuggestions } from '../hooks/useSearchSuggestions';

/**
 * The panel that drops below the search input.
 *
 * WHY it owns the suggestion hook rather than receiving results as props: the panel is the only
 * thing that renders suggestions, so keeping the query next to the markup that shows it means the
 * SearchBar stays a thin input + routing shell and this file is the whole "what to show while
 * typing" story.
 *
 * WHY it shows RECENT searches below the threshold and SUGGESTIONS above it: two characters is too
 * little to query usefully (every product would match "a"), so under `SEARCH_MIN_CHARS` the useful
 * thing to offer is what this person searched before — a one-tap repeat — and above it, live hits.
 *
 * WHY every row is a real `<Link>` (not an onClick handler): a suggestion is a navigation, so it
 * must be a crawlable, middle-clickable, keyboard-focusable anchor. The `onNavigate` callback only
 * closes the panel and records the term; the browser does the actual navigating.
 */
export interface SearchDropdownProps {
  /** The current raw input value. */
  term: string;
  /** From the header — used to resolve a sub-category's parent id back to a slug for its link. */
  categories: NavCategory[];
  recent: string[];
  /** Close the panel and record the typed term after any suggestion is chosen. */
  onNavigate: () => void;
  /** Re-run the search for a recent/typed term (fills the box and routes). */
  onPickTerm: (term: string) => void;
  onRemoveRecent: (term: string) => void;
  onClearRecent: () => void;
}

const GROUP_LABEL = 'px-3 pt-3 pb-1 text-[11px] font-extrabold uppercase tracking-wider text-faint';
const ROW =
  'flex items-center gap-3 px-3 py-2 text-sm text-foreground hover:bg-subtle focus-visible:bg-subtle focus-visible:outline-none';

export function SearchDropdown({
  term,
  categories,
  recent,
  onNavigate,
  onPickTerm,
  onRemoveRecent,
  onClearRecent,
}: SearchDropdownProps) {
  const trimmed = term.trim();
  const showSuggestions = trimmed.length >= Constants.SEARCH_MIN_CHARS;

  const { products, categories: catHits, subcategories, loading, empty, error } =
    useSearchSuggestions(term);

  // Map a sub-category's parent id to the category name its listing link needs.
  const categoryNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of categories) m.set(c.id, c.name);
    return m;
  }, [categories]);

  // --- Recent searches (shown while the term is too short to query) ---
  if (!showSuggestions) {
    if (recent.length === 0) {
      return (
        <DropdownShell>
          <p className="px-3 py-6 text-center text-sm text-muted">
            Start typing to search products, categories and more.
          </p>
        </DropdownShell>
      );
    }
    return (
      <DropdownShell>
        <div className="flex items-center justify-between">
          <span className={GROUP_LABEL}>Recent searches</span>
          <button
            type="button"
            onClick={onClearRecent}
            className="px-3 pt-3 pb-1 text-[11px] font-bold text-primary hover:underline"
          >
            Clear all
          </button>
        </div>
        <ul className="pb-1">
          {recent.map((t) => (
            <li key={t} className="flex items-center">
              <button type="button" onClick={() => onPickTerm(t)} className={`${ROW} flex-1 text-left`}>
                <Clock className="size-4 shrink-0 text-faint" aria-hidden />
                <span className="truncate">{t}</span>
              </button>
              <button
                type="button"
                aria-label={`Remove ${t} from recent searches`}
                onClick={() => onRemoveRecent(t)}
                className="mr-2 rounded-md p-1.5 text-faint hover:bg-subtle hover:text-foreground"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </DropdownShell>
    );
  }

  // --- Live suggestions ---
  return (
    <DropdownShell>
      {/* Always-present "search for the full term" action. */}
      <button type="button" onClick={() => onPickTerm(trimmed)} className={`${ROW} w-full text-left`}>
        <Search className="size-4 shrink-0 text-primary" aria-hidden />
        <span className="truncate">
          Search for <span className="font-bold text-foreground">“{trimmed}”</span>
        </span>
        <ArrowUpRight className="ml-auto size-4 shrink-0 text-faint" aria-hidden />
      </button>

      {loading && (
        <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Searching…
        </div>
      )}

      {!loading && error && (
        <p className="px-3 py-4 text-sm text-muted">Could not load suggestions. Press Enter to search.</p>
      )}

      {!loading && empty && (
        <p className="px-3 py-4 text-sm text-muted">
          No matches for “{trimmed}”. Press Enter to search anyway.
        </p>
      )}

      {!loading && products.length > 0 && (
        <div className="border-t border-border">
          <span className={GROUP_LABEL}>Products</span>
          <ul className="pb-1">
            {products.map((p) => (
              <li key={p.id}>
                <Link href={`/product/${p.id}`} onClick={onNavigate} className={ROW}>
                  <span className="relative size-9 shrink-0 overflow-hidden rounded-md bg-subtle">
                    {p.thumbnail ? (
                      <Image
                        src={p.thumbnail}
                        alt=""
                        fill
                        sizes="36px"
                        className="object-cover"
                        unoptimized
                      />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.name}</span>
                    {p.categoryName ? (
                      <span className="block truncate text-xs text-muted">{p.categoryName}</span>
                    ) : null}
                  </span>
                  {p.minPrice > 0 ? (
                    <span className="shrink-0 text-sm font-extrabold text-gold-strong">
                      ₹{p.minPrice.toLocaleString('en-IN')}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!loading && catHits.length > 0 && (
        <div className="border-t border-border">
          <span className={GROUP_LABEL}>Categories</span>
          <ul className="pb-1">
            {catHits.map((c) => (
              <li key={c.id}>
                <Link href={`/category/${encodeURIComponent(c.name)}`} onClick={onNavigate} className={ROW}>
                  <LayoutGrid className="size-4 shrink-0 text-primary" aria-hidden />
                  <span className="truncate">{c.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!loading && subcategories.length > 0 && (
        <div className="border-t border-border">
          <span className={GROUP_LABEL}>Sub-categories</span>
          <ul className="pb-1">
            {subcategories.map((s) => {
              const parentName = categoryNameById.get(s.mainCategoryId);
              const href = parentName
                ? `/category/${encodeURIComponent(parentName)}?subCategory=${encodeURIComponent(s.name)}`
                : `/search?q=${encodeURIComponent(s.name)}`;
              return (
                <li key={s.id}>
                  <Link href={href} onClick={onNavigate} className={ROW}>
                    <Layers className="size-4 shrink-0 text-primary" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{s.name}</span>
                    {parentName ? (
                      <span className="shrink-0 text-xs text-muted">in {parentName}</span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </DropdownShell>
  );
}

/** The floating card the results sit in — one place for the panel's frame and elevation. */
function DropdownShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="listbox"
      aria-label="Search suggestions"
      className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 max-h-[70vh] overflow-y-auto rounded-2xl border border-border bg-surface py-1 shadow-lg"
    >
      {children}
    </div>
  );
}
