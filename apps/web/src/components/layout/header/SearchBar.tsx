'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import type { NavCategory } from '@/lib/data/catalog';
// WHY the two scoped suppressions below: `import/no-restricted-paths` stops a shared module
// (`src/components`) from importing a feature — the rule that keeps shared code reusable. This file
// is the HEADER'S mount of the search feature, a composition-root concern, not a reusable primitive:
// it wires the feature's `useRecentSearches` hook and `SearchDropdown` into the site chrome and does
// nothing else. It is the same bridging role for which the root store (`src/stores`) is itself
// exempted, and it mirrors the documented exception W2 uses in `src/hooks/useLogout.ts`. The
// alternative — threading the whole search UI down as a slot from the (shop) layout — would change
// the Header contract this task fixes and move `SearchBar` out of its specified path. Scoped to two
// lines and explained, not a blanket disable.
// eslint-disable-next-line import/no-restricted-paths
import { useRecentSearches } from '@/features/search/hooks/useRecentSearches';
// eslint-disable-next-line import/no-restricted-paths
import { SearchDropdown } from '@/features/search/components/SearchDropdown';

/**
 * The header's live search box.
 *
 * WHY it is a small client island rather than part of the server-rendered header: the header shell
 * stays a Server Component for SEO, and only the interactive pieces — this box, the account menu,
 * the cart badge — opt into the client. Typing, focus, the dropdown and routing all need the
 * browser; nothing else in the header does.
 *
 * WHY submit routes to `/search?q=` rather than filtering in place: the results page is a real,
 * shareable, indexable URL (a Server Component that reads `?q=`), so pressing Enter must produce that
 * URL, not a client-only view a visitor could not link to.
 *
 * WHY the panel closes on outside-click / Escape / route change: an open dropdown that outlives the
 * interaction covers the page. A `mousedown` listener (not `click`) closes it before a click on a
 * link behind it lands, and clearing on submit means navigating always dismisses it.
 */
export interface SearchBarProps {
  categories: NavCategory[];
  /** Placeholder mirrors the design's "Search perfumes, books, abayas…". */
  placeholder?: string;
  className?: string;
  /** Autofocus on mount — the mobile drawer opens straight into the box. */
  autoFocus?: boolean;
}

export function SearchBar({
  categories,
  placeholder = 'Search perfumes, books, abayas…',
  className = '',
  autoFocus = false,
}: SearchBarProps) {
  const router = useRouter();
  const { recent, add, remove, clear } = useRecentSearches();
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  /** Run a full-text search for `term`: record it, navigate, and dismiss the panel. */
  function runSearch(term: string) {
    const q = term.trim();
    if (!q) return;
    add(q);
    setValue(q);
    setOpen(false);
    inputRef.current?.blur();
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          runSearch(value);
        }}
        className="flex items-center gap-2.5 rounded-full border border-border bg-app px-4 py-2.5 focus-within:border-primary"
      >
        <Search className="size-[18px] shrink-0 text-faint" aria-hidden />
        <input
          ref={inputRef}
          type="search"
          value={value}
          autoFocus={autoFocus}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          aria-label="Search the store"
          // Hide the browser's native clear affordance; we render our own to keep both platforms alike.
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-faint focus:outline-none [&::-webkit-search-cancel-button]:appearance-none"
        />
        {value && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setValue('');
              setOpen(true);
              inputRef.current?.focus();
            }}
            className="shrink-0 rounded-full p-0.5 text-faint hover:text-foreground"
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
      </form>

      {open && (
        <SearchDropdown
          term={value}
          categories={categories}
          recent={recent}
          onNavigate={() => {
            if (value.trim()) add(value);
            setOpen(false);
          }}
          onPickTerm={runSearch}
          onRemoveRecent={remove}
          onClearRecent={clear}
        />
      )}
    </div>
  );
}
