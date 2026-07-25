'use client';

import { useState } from 'react';
import type { ReviewProps } from '@barakath/shared';
import { Button } from '@/components/Button';
import { useMoreReviews } from '../hooks/useMoreReviews';
import { ReviewCard } from './ReviewCard';

export interface ViewMoreReviewsProps {
  productId: string;
  /** `createdAt.toMillis()` of the LAST review in the server-rendered first page — the paging cursor. */
  initialCursorMillis: number;
  initialHasMore: boolean;
}

/**
 * The client half of the reviews list: everything AFTER the server-rendered first page. Appends pages
 * of 12 (the same `Constants.PAGE_SIZE` the server page used) on each "View More" click.
 *
 * WHY it renders nothing when there is no second page: `ReviewsSection` only mounts this when
 * `initialHasMore` is true, but the guard is repeated here so the component is safe to use standalone.
 */
export function ViewMoreReviews({
  productId,
  initialCursorMillis,
  initialHasMore,
}: ViewMoreReviewsProps) {
  const { loadMore, loading, error } = useMoreReviews(productId);
  const [items, setItems] = useState<ReviewProps[]>([]);
  const [cursorMillis, setCursorMillis] = useState(initialCursorMillis);
  const [hasMore, setHasMore] = useState(initialHasMore);

  async function onViewMore() {
    const page = await loadMore(cursorMillis);
    if (page.items.length === 0) {
      setHasMore(false);
      return;
    }
    setItems((prev) => [...prev, ...page.items]);
    // `page.items.length === 0` returned above, so the last element always exists here.
    const last = page.items[page.items.length - 1]!;
    setCursorMillis(last.createdAt.toMillis());
    setHasMore(page.hasMore);
  }

  return (
    <>
      {items.length > 0 && (
        <ul className="mt-0">
          {items.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </ul>
      )}

      {error && <p className="mt-3 text-sm text-error">{error}</p>}

      {hasMore && (
        <div className="mt-5 flex justify-center">
          <Button variant="secondary" size="sm" loading={loading} onClick={onViewMore}>
            View more reviews
          </Button>
        </div>
      )}
    </>
  );
}
