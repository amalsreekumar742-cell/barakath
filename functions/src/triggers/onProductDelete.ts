import { onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { logger } from 'firebase-functions';
import { Collections } from '../config/collections';

/**
 * onProductDelete — when a product is deleted, clean up everything that pointed at it so no dangling
 * reference survives (spec §5.4 #17, §1.5/§1.16): its `variants` sub-collection, its Storage images, its
 * membership in any flash sale, its presence in other products' "frequently bought together", and its
 * reviews.
 *
 * WHY a trigger (not client): these are cross-collection, admin-privileged deletes that must happen
 *   atomically-enough and reliably whoever removed the product; a client delete could never reach the
 *   sub-collection, Storage, or other tenants' docs, and Security Rules would (rightly) deny most of it.
 * WHY per-concern try/catch: one failing cleanup (e.g. Storage) must not abort the others — each is
 *   independently retry-safe and idempotent (a re-run just finds nothing left to remove).
 * WHY guard event.data: a delete event can arrive without a snapshot — bail rather than dereference.
 */
export const onProductDelete = onDocumentDeleted('products/{productId}', async (event) => {
  const snap = event.data;
  if (!snap) return;
  const productId = event.params.productId;
  const db = getFirestore();

  // 1) Delete the variants sub-collection (products/{id}/variants). Chunk at Firestore's 500-op batch
  //    cap; loop until the sub-collection is drained.
  try {
    const variantsRef = db
      .collection(Collections.products)
      .doc(productId)
      .collection(Collections.variants);
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const batchSnap = await variantsRef.limit(400).get();
      if (batchSnap.empty) break;
      const batch = db.batch();
      for (const doc of batchSnap.docs) batch.delete(doc.ref);
      await batch.commit();
      if (batchSnap.size < 400) break;
    }
  } catch (err) {
    logger.error('onProductDelete: variants cleanup failed', { productId, err });
  }

  // 2) Delete Storage images under products/{id}/ in one prefix sweep.
  try {
    await getStorage()
      .bucket()
      .deleteFiles({ prefix: `products/${productId}/` });
  } catch (err) {
    logger.error('onProductDelete: storage cleanup failed', { productId, err });
  }

  // 3) Remove the product from any flash sale it belongs to. The schema stores BOTH a denormalised
  //    `productIds` string array (array-contains lookup) and a `products` array of objects — remove from
  //    each. We do NOT delete the sale doc: it may still hold other products.
  try {
    const salesSnap = await db
      .collection(Collections.flashSales)
      .where('productIds', 'array-contains', productId)
      .limit(100)
      .get();
    for (const saleDoc of salesSnap.docs) {
      const products = (saleDoc.data().products as Array<{ productId?: string }> | undefined) ?? [];
      const filtered = products.filter((p) => p.productId !== productId);
      await saleDoc.ref.update({
        productIds: FieldValue.arrayRemove(productId),
        products: filtered,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  } catch (err) {
    logger.error('onProductDelete: flash sale cleanup failed', { productId, err });
  }

  // 4) Remove the product from other products' frequentlyBoughtTogether arrays (array of ids → arrayRemove).
  try {
    const fbtSnap = await db
      .collection(Collections.products)
      .where('frequentlyBoughtTogether', 'array-contains', productId)
      .limit(200)
      .get();
    // Chunk updates at the 500-op batch cap.
    for (let i = 0; i < fbtSnap.docs.length; i += 400) {
      const batch = db.batch();
      for (const doc of fbtSnap.docs.slice(i, i + 400)) {
        batch.update(doc.ref, {
          frequentlyBoughtTogether: FieldValue.arrayRemove(productId),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
    }
  } catch (err) {
    logger.error('onProductDelete: frequentlyBoughtTogether cleanup failed', { productId, err });
  }

  // 5) Delete the product's reviews. Chunk at the 500-op batch cap; loop until drained. (Each delete
  //    fires onReviewDelete, whose product recompute safely no-ops on the now-gone product.)
  try {
    const reviewsRef = db.collection(Collections.reviews).where('productId', '==', productId);
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const batchSnap = await reviewsRef.limit(400).get();
      if (batchSnap.empty) break;
      const batch = db.batch();
      for (const doc of batchSnap.docs) batch.delete(doc.ref);
      await batch.commit();
      if (batchSnap.size < 400) break;
    }
  } catch (err) {
    logger.error('onProductDelete: reviews cleanup failed', { productId, err });
  }
});
