'use client';

import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Numbered-looking pagination over a cursor-based data source.
 *
 * THE HONEST LIMITATION, stated up front because the UI implies otherwise:
 * Firestore has no offset paging. `startAfter(cursor)` can only step to the page immediately after
 * one you have already fetched. So this control can go Next, can go Prev, and can jump back to any
 * page ALREADY VISITED (its cursor is on the stack) — but it can never jump forward to page 7 from
 * page 1, because the cursor for page 7 does not exist until pages 2–6 have been read.
 *
 * WHY not fake it by fetching-and-discarding: paging to 7 would read 72 documents to show 12, and
 * bill for all 72. On a catalog that is a real cost for a feature almost nobody uses.
 *
 * WHY show numbers at all rather than a plain "View More": spec 3.6 and 3.12 ask for numbered
 * pages, and the numbers are genuinely useful for stepping BACK — which is the direction people
 * actually use them for after opening a product and returning.
 *
 * WHY the cursors are NOT in Redux: a cursor is a Firestore `QueryDocumentSnapshot`, which is not
 * serialisable and would trip the store's serializable check. The owning page holds the stack in a
 * ref; this component is presentational and only reports which page was asked for.
 *
 * TWO MODES, one component:
 *  - Click-driven (client pages): pass `onGoToPage`; each control is a `<button>` that reports the page.
 *  - Link-driven (server-rendered listings): pass `hrefBuilder`; each control renders as a crawlable
 *    `<Link>` to `hrefBuilder(page)`, so a signed-out crawler and a no-JS visitor can still page. Because
 *    a function prop cannot cross the RSC boundary, a Server-Component page supplies `hrefBuilder` from a
 *    thin `'use client'` wrapper (a few lines) that also computes the page from the `?after=`/`?before=`
 *    searchParams — see WEB_BATCH2_NOTES.md. `hrefBuilder` wins over `onGoToPage` when both are given.
 */
export interface PaginationProps {
  /** 1-based. */
  currentPage: number;
  /** The highest page whose cursor is known — i.e. how far the visitor has already paged. */
  furthestPage: number;
  /** False once a short page came back, which is how the end is detected. */
  hasMore: boolean;
  disabled?: boolean;
  /** Click-driven mode: called with a page number always within 1…furthestPage+1. */
  onGoToPage?: (page: number) => void;
  /** Link-driven mode: given a page number, return the href for that page's `<Link>`. */
  hrefBuilder?: (page: number) => string;
}

export function Pagination({
  currentPage,
  furthestPage,
  hasMore,
  disabled = false,
  onGoToPage,
  hrefBuilder,
}: PaginationProps) {
  // Only pages whose cursor we hold can be offered, plus the next one if there is more to fetch.
  const reachable = Array.from({ length: furthestPage }, (_, i) => i + 1);
  if (reachable.length <= 1 && !hasMore) return null;

  const canPrev = currentPage > 1 && !disabled;
  const canNext = (currentPage < furthestPage || hasMore) && !disabled;

  const base =
    'inline-flex h-9 min-w-9 items-center justify-center rounded-md border px-3 text-[13px] font-bold transition disabled:cursor-not-allowed disabled:opacity-40';
  const neutral = `${base} border-border-strong bg-surface text-foreground hover:bg-subtle`;

  /**
   * One pagination control. Renders a crawlable `<Link>` in link-driven mode when the target is enabled,
   * and a `<button>` otherwise — a disabled destination must not be a link (a `<Link>` has no disabled
   * state and would still navigate), so a blocked Prev/Next falls back to a disabled button either way.
   */
  function Control({
    page,
    enabled,
    className,
    ariaLabel,
    ariaCurrent,
    children,
  }: {
    page: number;
    enabled: boolean;
    className: string;
    ariaLabel: string;
    ariaCurrent?: 'page';
    children: React.ReactNode;
  }) {
    if (hrefBuilder && enabled) {
      return (
        <Link
          href={hrefBuilder(page)}
          aria-label={ariaLabel}
          aria-current={ariaCurrent}
          className={className}
        >
          {children}
        </Link>
      );
    }
    return (
      <button
        type="button"
        onClick={() => onGoToPage?.(page)}
        disabled={!enabled}
        aria-label={ariaLabel}
        aria-current={ariaCurrent}
        className={className}
      >
        {children}
      </button>
    );
  }

  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-2 py-6">
      <Control page={currentPage - 1} enabled={canPrev} className={neutral} ariaLabel="Previous page">
        <ChevronLeft className="size-4" aria-hidden />
      </Control>

      {reachable.map((page) => {
        const isCurrent = page === currentPage;
        return (
          <Control
            key={page}
            page={page}
            enabled={!disabled && !isCurrent}
            ariaLabel={`Page ${page}`}
            ariaCurrent={isCurrent ? 'page' : undefined}
            className={
              isCurrent
                ? `${base} border-primary bg-primary text-white`
                : neutral
            }
          >
            {page}
          </Control>
        );
      })}

      {/*
        An ellipsis rather than more numbers when there is further to go: the pages beyond this one
        exist but have no cursor yet, so offering them as buttons would promise a jump we cannot make.
      */}
      {hasMore && currentPage === furthestPage && (
        <span className="px-1 text-sm text-faint" aria-hidden>
          …
        </span>
      )}

      <Control page={currentPage + 1} enabled={canNext} className={neutral} ariaLabel="Next page">
        <ChevronRight className="size-4" aria-hidden />
      </Control>
    </nav>
  );
}
