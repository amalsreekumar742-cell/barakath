import { onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { getStorage } from 'firebase-admin/storage';
import { logger } from 'firebase-functions';
import { recomputeProductRating } from './service/recomputeProductRating';

/**
 * onReviewDelete — when a review is hard-deleted, refresh the product's aggregate rating and purge the
 * review's uploaded photos from Cloud Storage so they don't dangle (spec §1.11, storage §
 * `reviews/{reviewId}/{photoIndex}`).
 *
 * WHY delete photos by prefix (not by URL): the photos live under `reviews/{reviewId}/` (storage map).
 *   Deleting the whole prefix removes every photo in one call and needs no fragile download-URL parsing,
 *   and it also sweeps any orphaned upload the doc's `photos` array never captured.
 * WHY recompute may find no product: onProductDelete cascades review deletes; the product doc may
 *   already be gone. recomputeProductRating swallows that NOT_FOUND, so this trigger stays retry-safe.
 * WHY guard event.data: a delete event can arrive without a snapshot — bail rather than dereference.
 */
export const onReviewDelete = onDocumentDeleted('reviews/{reviewId}', async (event) => {
  const snap = event.data;
  if (!snap) return;

  const review = snap.data();
  if (!review) return;

  const productId = review.productId as string | undefined;
  const photos = (review.photos as string[] | undefined) ?? [];
  const reviewId = event.params.reviewId;

  try {
    if (productId) await recomputeProductRating(productId);

    // Only touch Storage when the review actually had photos — avoids a needless list call otherwise.
    if (photos.length > 0) {
      await getStorage()
        .bucket()
        .deleteFiles({ prefix: `reviews/${reviewId}/` });
    }
  } catch (err) {
    logger.error('onReviewDelete failed', { reviewId, productId, err });
  }
});
