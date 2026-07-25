import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { Collections } from '../config/collections';
import { recomputeProductRating } from './service/recomputeProductRating';

/**
 * onReviewCreate — when a customer posts a review, refresh the product's aggregate rating and stamp the
 * review as a verified purchase if the reviewer really bought and received that product (spec §1.11).
 *
 * WHY a trigger (not client): the product's `averageRating`/`totalReviews` are derived across ALL
 *   published reviews — a single client can't safely recompute a cross-document aggregate, and the
 *   `isVerifiedPurchase` flag depends on reading the reviewer's orders, which the client must not be
 *   trusted to assert about itself.
 * WHY setting isVerifiedPurchase here won't loop: it updates the review doc, which fires onReviewUpdate,
 *   but that function only recomputes when isPublished or rating changed — neither does here.
 * WHY guard event.data: a create event can arrive without a snapshot — bail rather than dereference.
 */
export const onReviewCreate = onDocumentCreated('reviews/{reviewId}', async (event) => {
  const snap = event.data;
  if (!snap) return;

  const review = snap.data();
  if (!review) return;

  const productId = review.productId as string | undefined;
  const userId = review.userId as string | undefined;
  if (!productId) return;

  try {
    // Published-only aggregate recompute (shared helper — same math as update/delete).
    await recomputeProductRating(productId);

    if (!userId) return;

    // Verified purchase = this user has a DELIVERED order that contains this product. `items` is an
    // array of objects, so array-contains can't match it — fetch the user's delivered orders (bounded)
    // and scan their line items in memory.
    const db = getFirestore();
    const ordersSnap = await db
      .collection(Collections.orders)
      .where('userId', '==', userId)
      .where('status', '==', 'Delivered')
      .limit(50)
      .get();

    let verified = false;
    for (const orderDoc of ordersSnap.docs) {
      const items = (orderDoc.data().items as Array<{ productId?: string }> | undefined) ?? [];
      if (items.some((it) => it.productId === productId)) {
        verified = true;
        break;
      }
    }

    if (verified) {
      await snap.ref.update({ isVerifiedPurchase: true });
    }
  } catch (err) {
    logger.error('onReviewCreate failed', { reviewId: event.params.reviewId, productId, err });
  }
});
