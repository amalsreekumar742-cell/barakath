'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getDocs,
  limit,
  query,
  startAfter,
  type DocumentData,
  type Query,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { Constants } from '@/config/constants';

/**
 * usePaginatedCollection — the one cursor-pagination implementation every account-area list (orders,
 * wallet transactions, commission transactions, withdrawal requests, spin-won coupons, notifications)
 * is meant to build on (Batch 4 brief §2). Client-side, one-shot `getDocs` reads (never `onSnapshot` —
 * none of these lists need to be live per the web skill's real-time-listener guidance), "View More"
 * cursor pagination, 12/page default.
 *
 * WHY a plain hook and not a `createAsyncThunk` + slice: every list this batch touches is scoped to
 * ONE signed-in customer's own query and is read by exactly one screen at a time — there is no
 * cross-component state to share. NOTE for whoever wires orders/wallet/affiliate/notifications: those
 * features already carry scaffolded RTK slices (`ordersSlice`, `walletSlice`, `affiliateSlice`,
 * `notificationsSlice`) with pagination-shaped reducers (`setXPage`, `setXLoading`, `hasMore`, …) from
 * an earlier pass. This hook does NOT dispatch into them — using both means either (a) call this hook
 * locally in the page/component and leave those slice actions unused, or (b) call this hook and adapt
 * its result into the slice with a thin `useEffect` that dispatches `setXPage`. Left as an open seam
 * for whichever session builds each screen; flagged in the Batch 4 close-out doc rather than decided
 * here, since this session owns only the shared hook, not those features.
 *
 * WHY the caller passes a `Query | null` rather than filter params: the query (collection + `where` +
 * `orderBy`, WITHOUT `limit`/`startAfter`) is feature-specific — this hook only owns the pagination
 * mechanics (limit, startAfter, cursor tracking, dedup, cancellation, superseded-request guarding).
 * `null` means "not ready yet" (e.g. uid still resolving) — the hook stays idle and reports
 * `isLoading: true` so a caller's skeleton keeps showing instead of flashing an empty state.
 *
 * WHY the caller must memoize `query` (`useMemo`): a Firestore `Query` is a new object every time it
 * is constructed, and this hook treats a CHANGED reference as "start over from page 1" (new filters, a
 * different customer, a tab switch). An inline, unmemoized query would refetch on every render.
 */
export interface UsePaginatedCollectionParams<T> {
  /** The base query (filters + orderBy already applied, no `limit`/`startAfter`). Memoize this. */
  query: Query<DocumentData> | null;
  pageSize?: number;
  /** Maps one Firestore doc to the caller's domain type. Must be referentially stable (module-scope
   *  or wrapped in `useCallback`) — it participates in this hook's effect dependencies. */
  mapper: (doc: QueryDocumentSnapshot<DocumentData>) => T;
}

export interface UsePaginatedCollectionResult<T> {
  items: T[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
  error: string | null;
}

export function usePaginatedCollection<T extends { id: string }>({
  query: baseQuery,
  pageSize = Constants.PAGE_SIZE,
  mapper,
}: UsePaginatedCollectionParams<T>): UsePaginatedCollectionResult<T> {
  const [items, setItems] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The last doc of the current page, fed to `startAfter` for the next one. A ref (not state): it
  // must be read synchronously inside `loadMore` without waiting on a re-render.
  const cursorRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  // A monotonically increasing token: bumped whenever a fetch starts (first page or load-more) or the
  // base query changes. A slow in-flight read checks its own token before touching state, so a fast
  // tab switch (new query while the old page is still in flight) or an unmount cannot let a stale
  // response clobber newer state or set state on a dead component — one guard covers both.
  const requestIdRef = useRef(0);

  const runFirstPage = useCallback(
    async (q: Query<DocumentData>) => {
      const requestId = ++requestIdRef.current;
      setIsLoading(true);
      setError(null);
      try {
        const snap = await getDocs(query(q, limit(pageSize)));
        if (requestIdRef.current !== requestId) return; // superseded — query changed or unmounted
        const docs = snap.docs;
        setItems(docs.map(mapper));
        cursorRef.current = docs[docs.length - 1] ?? null;
        setHasMore(docs.length === pageSize);
      } catch (e) {
        if (requestIdRef.current !== requestId) return;
        setItems([]);
        cursorRef.current = null;
        setHasMore(false);
        setError(readableMessage(e));
      } finally {
        if (requestIdRef.current === requestId) setIsLoading(false);
      }
    },
    [mapper, pageSize],
  );

  // Fetch page 1 whenever the (memoized) base query changes — including the very first time it goes
  // from null to a real query once its dependencies (e.g. uid) resolve.
  useEffect(() => {
    if (!baseQuery) {
      requestIdRef.current += 1; // invalidate any fetch in flight from a previous, now-stale query
      setItems([]);
      cursorRef.current = null;
      setHasMore(false);
      setIsLoading(true);
      setError(null);
      return;
    }
    void runFirstPage(baseQuery);
  }, [baseQuery, runFirstPage]);

  const loadMore = useCallback(() => {
    if (!baseQuery || isLoadingMore || isLoading || !hasMore || !cursorRef.current) return;
    const requestId = ++requestIdRef.current;
    setIsLoadingMore(true);
    setError(null);
    void (async () => {
      try {
        const snap = await getDocs(query(baseQuery, startAfter(cursorRef.current), limit(pageSize)));
        if (requestIdRef.current !== requestId) return;
        const docs = snap.docs;
        const mapped = docs.map(mapper);
        setItems((prev) => {
          // Dedup by id: StrictMode's double-invoke, or a double-click on "View More" before the
          // button's own disabled state lands, must not append the same page twice.
          const seen = new Set(prev.map((it) => it.id));
          return [...prev, ...mapped.filter((it) => !seen.has(it.id))];
        });
        cursorRef.current = docs[docs.length - 1] ?? cursorRef.current;
        setHasMore(docs.length === pageSize);
      } catch (e) {
        if (requestIdRef.current !== requestId) return;
        setError(readableMessage(e));
      } finally {
        if (requestIdRef.current === requestId) setIsLoadingMore(false);
      }
    })();
  }, [baseQuery, hasMore, isLoading, isLoadingMore, mapper, pageSize]);

  // Re-run page 1 on demand (e.g. after a mutation elsewhere invalidates the list) without waiting for
  // the query reference to change. Replaces `items` wholesale, which is itself the dedup: a full
  // replace can never carry a stale duplicate forward the way an append could.
  const refresh = useCallback(() => {
    if (!baseQuery) return;
    void runFirstPage(baseQuery);
  }, [baseQuery, runFirstPage]);

  return { items, isLoading, isLoadingMore, hasMore, loadMore, refresh, error };
}

/** Pull a customer-safe message out of a caught error, suppressing anything that looks like a raw
 *  Firebase console link (e.g. a missing-index error) — see `@/lib/toast`'s identical rationale. */
function readableMessage(error: unknown): string {
  const raw = typeof error === 'string' ? error : error instanceof Error ? error.message : '';
  const trimmed = raw.trim();
  if (!trimmed || /https?:\/\//i.test(trimmed)) return 'Could not load this list. Please try again.';
  return trimmed;
}
