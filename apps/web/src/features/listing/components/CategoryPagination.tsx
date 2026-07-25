'use client';

import { Pagination } from '@/components/Pagination';
import { buildHref } from '../utils/urlParams';

/**
 * CategoryPagination — the thin `'use client'` wrapper `Pagination` needs to supply `hrefBuilder`
 * (WEB_BATCH2_NOTES.md "Pagination approach"): a function prop cannot cross the Server → Client
 * boundary, so this file, not the page, owns the tiny bit of href-building logic.
 *
 * WHY a `trail` URL param instead of `before`/`firstDocId`: `buildProductQuery`'s `before` mode
 * (`endBefore`+`limitToLast`) reproduces a page by walking BACKWARD from a cursor, which is correct but
 * means "page 3" is reached differently depending on whether you arrived via Next×2 or Prev from page 5
 * — two different Firestore query shapes for the same page. Recording the chain of forward `after`
 * cursors already used (`trail=<lastDocId of page1>,<lastDocId of page2>,…`) in the URL means ANY
 * already-visited page — reached via Prev, via a numbered link, or a fresh paste of the URL — is always
 * the exact same forward query, `after=trail[targetPage-2]`. This is also what makes the whole thing
 * work with NO client-side state: the "cursor stack" `Pagination`'s own doc comment says a click-driven
 * page would keep in a ref lives in the URL instead, so it survives a full page reload / shared link.
 *
 * WHY this never uses `before=`: with the trail present, stepping backward to page N is just
 * `after=trail[N-2]` (or the bare URL for N=1) — an ordinary forward query, so `before` mode is simply
 * unused by this control (the page's parsing still accepts it for API completeness / a future caller).
 */
export interface CategoryPaginationProps {
  pathname: string;
  /** Every filter/sort param, WITHOUT `after`/`before`/`page`/`trail`. */
  filterParams: Record<string, string>;
  /** The current page's 1-based label, as carried in `?page=`. */
  page: number;
  /** Decoded `?trail=` — `trail[i]` is the `after` cursor that reaches page `i + 2`. */
  trail: string[];
  /** `lastDocId` of the CURRENT page's fetch — the cursor to extend the trail when going past it. */
  lastDocId: string | null;
  hasNext: boolean;
}

export function CategoryPagination({
  pathname,
  filterParams,
  page,
  trail,
  lastDocId,
  hasNext,
}: CategoryPaginationProps) {
  const furthestPage = Math.max(page, trail.length + 1);

  function hrefBuilder(targetPage: number): string {
    if (targetPage <= 1) {
      return buildHref(pathname, filterParams, { after: null, before: null, page: null, trail: null });
    }
    if (targetPage <= furthestPage) {
      const cursor = trail[targetPage - 2] ?? null;
      return buildHref(pathname, filterParams, {
        after: cursor,
        before: null,
        page: String(targetPage),
        trail: trail.length ? trail.join(',') : null,
      });
    }
    // Extending exactly one page past the known frontier (the dedicated Next control only).
    const nextTrail = [...trail, lastDocId ?? ''];
    return buildHref(pathname, filterParams, {
      after: lastDocId,
      before: null,
      page: String(targetPage),
      trail: nextTrail.join(','),
    });
  }

  return (
    <Pagination currentPage={page} furthestPage={furthestPage} hasMore={hasNext} hrefBuilder={hrefBuilder} />
  );
}
