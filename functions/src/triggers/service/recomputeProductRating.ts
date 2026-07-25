import { getFirestore, AggregateField, FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { Collections } from '../../config/collections';

/**
 * recomputeProductRating — recompute a product's `averageRating` + `totalReviews` from its PUBLISHED
 * reviews and write them back onto the product doc.
 *
 * WHY a shared helper (in triggers/service/): three separate review triggers (onReviewCreate,
 *   onReviewUpdate, onReviewDelete) must derive these two product fields identically. One function
 *   guarantees they can never drift — a create that counts differently from a delete would leave the
 *   rating permanently wrong.
 * WHY a server-side aggregation (AggregateField.count/average) instead of fetch-all-and-count: the
 *   review set for a popular product is unbounded; streaming every doc to average it in memory is a
 *   memory + bill hazard. The Admin SDK's `.aggregate({...}).get()` computes count + average on the
 *   server and returns a single row. This is the ONE aggregation approach used across functions 8/9/10.
 * WHY it tolerates a missing product: onProductDelete cascades review deletes, which fire
 *   onReviewDelete, which lands here after the product doc is already gone — a NOT_FOUND on the update
 *   is expected there and must be swallowed, not thrown (a throw would retry the trigger forever).
 */
export async function recomputeProductRating(productId: string): Promise<void> {
  if (!productId) return;
  const db = getFirestore();

  // Published-only: hidden reviews must not influence the public rating (spec §1.11 / §product schema).
  const snap = await db
    .collection(Collections.reviews)
    .where('productId', '==', productId)
    .where('isPublished', '==', true)
    .aggregate({
      count: AggregateField.count(),
      avgRating: AggregateField.average('rating'),
    })
    .get();

  const totalReviews = snap.data().count;
  // average() returns null when the matched set is empty — normalise that to 0 for a clean UI default.
  const rawAvg = snap.data().avgRating;
  const averageRating = rawAvg === null ? 0 : Math.round(rawAvg * 10) / 10;

  try {
    await db.collection(Collections.products).doc(productId).update({
      averageRating,
      totalReviews,
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    // NOT_FOUND (code 5) is expected when the product was deleted first — ignore; log anything else.
    const code = (err as { code?: number | string }).code;
    if (code === 5 || code === 'not-found') return;
    logger.error('recomputeProductRating failed to update product', { productId, err });
  }
}
