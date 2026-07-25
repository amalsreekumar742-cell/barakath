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
import type { NotificationProps } from '@barakath/shared';
import { Constants } from '@/config/constants';
import { broadcastNotificationsQuery, mapNotification, personalNotificationsQuery } from '../api/notifications';

/** Per-source pagination state: its own cursor, whether it might have more, and a buffer of
 *  already-fetched-but-not-yet-emitted docs (kept in the source's own createdAt-desc order). */
interface SourceState {
  cursor: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
  buffer: NotificationProps[];
}

function freshSource(): SourceState {
  return { cursor: null, hasMore: true, buffer: [] };
}

export interface UseNotificationsFeedResult {
  items: NotificationProps[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  loadMore: () => void;
  error: string | null;
}

/**
 * Merges the two independent notification queries (broadcast + personal — see `api/notifications.ts`)
 * into one `createdAt`-desc feed, `Constants.PAGE_SIZE` per page, with two independent cursors as the
 * Batch 4 brief specifies.
 *
 * HOW the merge stays correct while each source paginates independently (a bounded k-way merge): each
 * source keeps a buffer of its own fetched-but-not-yet-emitted docs, still in that source's own
 * createdAt-desc order. Before slicing a page, EACH buffer is topped up (via `startAfter` its own
 * cursor) until it holds at least `PAGE_SIZE` docs or its source is exhausted. Because each source is
 * independently sorted desc by `createdAt`, once a buffer holds `>= PAGE_SIZE` items (or all remaining
 * items), any doc from that source NOT yet fetched is guaranteed older than that buffer's own last
 * item — so merging the two topped-up buffers and taking the newest `PAGE_SIZE` is provably correct,
 * and the unconsumed remainder is kept for the next page instead of being re-fetched.
 *
 * WHY not `usePaginatedCollection`: that hook owns exactly one Firestore `Query` and one cursor: it
 * has no way to interleave two independently-ordered sources into a single merged page. This hook
 * reuses the same mechanics (limit/startAfter, request-id guarding against a superseded/unmounted
 * fetch, dedup on append) but over two sources at once.
 */
export function useNotificationsFeed(uid: string | null): UseNotificationsFeedResult {
  const [items, setItems] = useState<NotificationProps[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const broadcastRef = useRef<SourceState>(freshSource());
  const personalRef = useRef<SourceState>(freshSource());
  // Bumped on every fetch start or uid change; a stale in-flight response checks its own token before
  // touching state, guarding against both a superseded fetch and a fetch resolving after unmount.
  const requestIdRef = useRef(0);

  const pageSize = Constants.PAGE_SIZE;

  /** Top up one source's buffer to at least `pageSize` docs (or until its own source is exhausted). */
  const topUp = useCallback(
    async (source: SourceState, baseQuery: Query<DocumentData>) => {
      if (source.buffer.length >= pageSize || !source.hasMore) return;
      const need = pageSize - source.buffer.length;
      const q = source.cursor
        ? query(baseQuery, startAfter(source.cursor), limit(need))
        : query(baseQuery, limit(need));
      const snap = await getDocs(q);
      const docs = snap.docs;
      source.buffer.push(...docs.map(mapNotification));
      source.cursor = docs[docs.length - 1] ?? source.cursor;
      source.hasMore = docs.length === need;
    },
    [pageSize],
  );

  /** Top up both sources, merge-sort their buffers, take the newest `pageSize`, and split the
   *  remainder back into each source's own buffer (a prefix of each, per the correctness note above). */
  const pullPage = useCallback(
    async (customerId: string) => {
      await Promise.all([
        topUp(broadcastRef.current, broadcastNotificationsQuery()),
        topUp(personalRef.current, personalNotificationsQuery(customerId)),
      ]);

      const merged = [...broadcastRef.current.buffer, ...personalRef.current.buffer].sort(
        (a, b) => b.createdAt.toMillis() - a.createdAt.toMillis(),
      );
      const page = merged.slice(0, pageSize);

      // `targetType == 'All'` docs are always written with `targetUserIds: []` (see
      // `createNotification.ts`), so the two sources shouldn't overlap — filtered defensively anyway
      // rather than trusting that invariant to never change.
      const pageIds = new Set(page.map((n) => n.id));
      broadcastRef.current.buffer = broadcastRef.current.buffer.filter((n) => !pageIds.has(n.id));
      personalRef.current.buffer = personalRef.current.buffer.filter((n) => !pageIds.has(n.id));

      const more =
        broadcastRef.current.buffer.length > 0 ||
        personalRef.current.buffer.length > 0 ||
        broadcastRef.current.hasMore ||
        personalRef.current.hasMore;

      return { page, more };
    },
    [pageSize, topUp],
  );

  const runFirstPage = useCallback(
    async (customerId: string) => {
      const requestId = ++requestIdRef.current;
      broadcastRef.current = freshSource();
      personalRef.current = freshSource();
      setIsLoading(true);
      setError(null);
      try {
        const { page, more } = await pullPage(customerId);
        if (requestIdRef.current !== requestId) return; // superseded — uid changed or unmounted
        setItems(page);
        setHasMore(more);
      } catch (e) {
        if (requestIdRef.current !== requestId) return;
        setItems([]);
        setHasMore(false);
        setError(readableMessage(e));
      } finally {
        if (requestIdRef.current === requestId) setIsLoading(false);
      }
    },
    [pullPage],
  );

  // Fetch page 1 whenever `uid` resolves or changes. `null` means "not ready yet" (auth still
  // resolving) — stay idle and keep reporting `isLoading: true` so the skeleton doesn't flash empty.
  useEffect(() => {
    if (!uid) {
      requestIdRef.current += 1;
      broadcastRef.current = freshSource();
      personalRef.current = freshSource();
      setItems([]);
      setHasMore(false);
      setIsLoading(true);
      setError(null);
      return;
    }
    void runFirstPage(uid);
  }, [uid, runFirstPage]);

  const loadMore = useCallback(() => {
    if (!uid || isLoadingMore || isLoading || !hasMore) return;
    const requestId = ++requestIdRef.current;
    setIsLoadingMore(true);
    setError(null);
    void (async () => {
      try {
        const { page, more } = await pullPage(uid);
        if (requestIdRef.current !== requestId) return;
        setItems((prev) => {
          // Dedup by id: StrictMode's double-invoke, or a double-click on "View more" before the
          // button's own disabled state lands, must not append the same page twice.
          const seen = new Set(prev.map((n) => n.id));
          return [...prev, ...page.filter((n) => !seen.has(n.id))];
        });
        setHasMore(more);
      } catch (e) {
        if (requestIdRef.current !== requestId) return;
        setError(readableMessage(e));
      } finally {
        if (requestIdRef.current === requestId) setIsLoadingMore(false);
      }
    })();
  }, [uid, hasMore, isLoading, isLoadingMore, pullPage]);

  return { items, isLoading, isLoadingMore, hasMore, loadMore, error };
}

/** Pull a customer-safe message out of a caught error, suppressing a raw Firebase console link (e.g.
 *  a missing-index error) — same rationale as `usePaginatedCollection`'s identical helper. */
function readableMessage(error: unknown): string {
  const raw = typeof error === 'string' ? error : error instanceof Error ? error.message : '';
  const trimmed = raw.trim();
  if (!trimmed || /https?:\/\//i.test(trimmed)) return 'Could not load your notifications. Please try again.';
  return trimmed;
}
