'use client';

import { useEffect, useState } from 'react';
import { OrderStatus, type OrderProps } from '@barakath/shared';
import { hasExistingReview } from '../api/reviews';

export interface ItemReviewState {
  loading: boolean;
  /** Whether this product already has a published review on this order (spec §2.24: one per product
   *  per order). Deduped per productId, same as `useItemReplacementState` — a combo order can repeat a
   *  product across lines, and the duplicate-guard is keyed by product, not by line/variant. */
  reviewedFor: (productId: string) => boolean;
}

/**
 * Per-line "already reviewed this product on this order" state for a DELIVERED order — the write-review
 * trigger's counterpart to `useItemReplacementState`. Only runs for Delivered orders, same reasoning:
 * "Write review" is a post-delivery action, so these reads are pure waste on an in-flight order.
 */
export function useItemReviewState(order: OrderProps | null, uid: string | null): ItemReviewState {
  const [loading, setLoading] = useState(false);
  const [reviewed, setReviewed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!order || !uid || order.status !== OrderStatus.DELIVERED) {
      setReviewed({});
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      const map: Record<string, boolean> = {};
      const seenProducts = new Set<string>();

      for (const item of order.items) {
        if (seenProducts.has(item.productId)) continue;
        seenProducts.add(item.productId);
        try {
          map[item.productId] = await hasExistingReview(uid, item.productId, order.id);
        } catch {
          // A failed lookup must not block rendering — worst case the customer sees the "Write review"
          // link when one already exists, discovers it on the review page's own re-check, and goes back.
          map[item.productId] = false;
        }
      }

      if (!cancelled) {
        setReviewed(map);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [order, uid]);

  return {
    loading,
    reviewedFor: (productId) => reviewed[productId] ?? false,
  };
}
