'use client';

import { Pagination } from '@/components/Pagination';

/**
 * SearchPagination — numbered pages for `/search`, backed by a `trail=` URL param carrying the chain
 * of forward Firestore cursors already used to reach this point: `trail[i]` is the `after` cursor that
 * reaches page `i + 2`.
 *
 * WHY a URL param and not client-side memory (localStorage/sessionStorage/a ref): Firestore has no
 * offset pagination, so a numbered "page 5" link only means something if the cursor chain to reach it
 * is known. Client-held state (a ref, sessionStorage) only survives navigations made from THIS page in
 * THIS tab — a shared link, a bookmarked page, or a fresh tab arrives with none of it, so a numbered
 * link either mislabels the current page or silently can't jump anywhere past page 1. Putting the
 * chain in the URL itself makes every visited page stateless and exactly reproducible: paste the URL
 * anywhere and it renders the identical page, because the query has everything it needs. Mirrors the
 * identical `trail=` pattern `src/features/listing/components/CategoryPagination.tsx` uses for
 * `/category/[categoryName]` — kept as a separate, self-contained implementation here rather than a
 * shared import, since features may not import each other's internals and the two pages carry
 * different filter params around the cursor.
 *
 * WHY this never needs `before=`: with the trail present, stepping back to page N is just
 * `after=trail[N-2]` (or the bare `q=` URL for N=1) — an ordinary forward query. `searchProducts`'s
 * `before` mode stays unused by this control.
 */
export interface SearchPaginationProps {
  q: string;
  /** The current page's 1-based label, as carried in `?page=`. */
  page: number;
  /** Decoded `?trail=` — `trail[i]` is the `after` cursor that reaches page `i + 2`. */
  trail: string[];
  /** `lastDocId` of the CURRENT page's fetch — the cursor to extend the trail past the known frontier. */
  lastDocId: string | null;
  hasNext: boolean;
}

function hrefFor(q: string, after: string | null, page: number | null, trail: string[]): string {
  const params = new URLSearchParams({ q });
  if (after) params.set('after', after);
  if (page && page > 1) params.set('page', String(page));
  if (trail.length) params.set('trail', trail.join(','));
  return `/search?${params.toString()}`;
}

export function SearchPagination({ q, page, trail, lastDocId, hasNext }: SearchPaginationProps) {
  const furthestPage = Math.max(page, trail.length + 1);

  function hrefBuilder(targetPage: number): string {
    if (targetPage <= 1) return hrefFor(q, null, null, []);
    if (targetPage <= furthestPage) {
      const cursor = trail[targetPage - 2] ?? null;
      return hrefFor(q, cursor, targetPage, trail);
    }
    // Extending exactly one page past the known frontier (the dedicated Next control only).
    const nextTrail = [...trail, lastDocId ?? ''];
    return hrefFor(q, lastDocId, targetPage, nextTrail);
  }

  return (
    <Pagination currentPage={page} furthestPage={furthestPage} hasMore={hasNext} hrefBuilder={hrefBuilder} />
  );
}
