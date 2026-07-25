'use client';

import { useCallback, useState } from 'react';
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  Timestamp,
  where,
} from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared';
import type { ReviewProps } from '@barakath/shared';
import { db } from '@/lib/firebaseConfig';
import { Constants } from '@/config/constants';

/**
 * useMoreReviews — client-side "View More" pagination for a product's PUBLISHED reviews.
 *
 * WHY this can't just call `getProductReviews` from `@/lib/data/catalog`: that function is
 * `server-only` (fails the build if a `"use client"` file imports it, by design — see
 * WEB_BATCH2_NOTES.md §A), AND its cursor is a Firestore `QueryDocumentSnapshot`, which is not
 * serialisable and cannot cross the Server→Client Component boundary as a prop. The first page is
 * genuinely server-rendered (for SEO, via `getProductReviews` in `ReviewsSection`); this hook is its
 * client-side twin, re-running the identical filter/sort/limit against the CLIENT `db` so "View More"
 * can keep paging without a page reload.
 *
 * WHY the cursor is a plain millis number, not a snapshot: `startAfter` also accepts the actual field
 * VALUE(s) for the query's `orderBy` clauses (not only a snapshot) — so passing
 * `Timestamp.fromMillis(afterMillis)` pages correctly without ever needing a non-serialisable cursor
 * object. The server page hands this hook the LAST review's `createdAt.toMillis()` from its own first
 * page, which is a plain number and crosses the RSC boundary cleanly (same pattern `FlashCountdown`
 * documents for `endDate`).
 */
export function useMoreReviews(productId: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMore = useCallback(
    async (afterMillis: number): Promise<{ items: ReviewProps[]; hasMore: boolean }> => {
      setLoading(true);
      setError(null);
      try {
        const snap = await getDocs(
          query(
            collection(db, FirestoreCollections.reviews),
            where('productId', '==', productId),
            where('isPublished', '==', true),
            orderBy('createdAt', 'desc'),
            startAfter(Timestamp.fromMillis(afterMillis)),
            limit(Constants.PAGE_SIZE),
          ),
        );
        const items = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as ReviewProps);
        return { items, hasMore: items.length === Constants.PAGE_SIZE };
      } catch {
        setError('Could not load more reviews. Please try again.');
        return { items: [], hasMore: false };
      } finally {
        setLoading(false);
      }
    },
    [productId],
  );

  return { loadMore, loading, error };
}
