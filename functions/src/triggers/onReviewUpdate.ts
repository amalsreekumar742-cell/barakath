import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import { recomputeProductRating } from './service/recomputeProductRating';

/**
 * onReviewUpdate — when a review's publish state or star rating changes, refresh the product's
 * aggregate rating (spec §1.11: admin publishes/hides or the value changes).
 *
 * WHY only on isPublished/rating change: those are the only two inputs to the aggregate. Recomputing on
 *   every unrelated edit (e.g. an admin response) would be wasted work and, worse, could feed back into
 *   loops when other triggers also write the review doc.
 * WHY a trigger: same reason as create — the aggregate spans all published reviews and must be derived
 *   server-side, not asserted by a client.
 * WHY guard event.data: an update event can arrive without before/after snapshots — bail rather than
 *   dereference undefined.
 */
export const onReviewUpdate = onDocumentUpdated('reviews/{reviewId}', async (event) => {
  const change = event.data;
  if (!change) return;

  const before = change.before.data();
  const after = change.after.data();
  if (!before || !after) return;

  const publishChanged = before.isPublished !== after.isPublished;
  const ratingChanged = before.rating !== after.rating;
  if (!publishChanged && !ratingChanged) return;

  const productId = after.productId as string | undefined;
  if (!productId) return;

  try {
    await recomputeProductRating(productId);
  } catch (err) {
    logger.error('onReviewUpdate failed', { reviewId: event.params.reviewId, productId, err });
  }
});
