import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { Collections } from '../config/collections';

/**
 * onProductCategoryCount — keeps `categories/{categoryId}.productCount` truthful.
 *
 * WHY this exists: `createCategory` seeds the field at 0 and NOTHING ever moved it, so every category
 * read "0 products" forever — on the app's Categories grid, on its category landing page, and in the
 * admin's categories table. A count nobody maintains is worse than no count at all.
 *
 * WHY a trigger (not a client write): the customer app may not write category docs, and the admin can
 * create a product without ever loading the category doc. Only the server sees every mutation.
 *
 * WHY only Active products count: `status` is Active/Archived (spec §4.7) and the catalogue only ever
 * shows Active ones — counting archived stock would promise the shopper products they cannot open.
 *
 * WHY FieldValue.increment: concurrent product writes must not clobber each other, and increment is the
 * only atomic option. It is NOT idempotent on retry, so the handler swallows its own errors: a retried
 * event would double-count, which is worse than a count that is briefly one short.
 */

/** The category a product should be counted under, or null when it must not be counted at all. */
function countedCategoryOf(data: FirebaseFirestore.DocumentData | undefined): string | null {
  if (!data) return null;
  if (String(data.status ?? '') !== 'Active') return null;
  const categoryId = String(data.categoryId ?? '').trim();
  return categoryId === '' ? null : categoryId;
}

export const onProductCategoryCount = onDocumentWritten(
  'products/{productId}',
  async (event) => {
    const before = countedCategoryOf(event.data?.before?.data());
    const after = countedCategoryOf(event.data?.after?.data());

    // Nothing that affects the count changed — the overwhelmingly common case (price, stock, rating).
    if (before === after) return;

    const db = getFirestore();
    const productId = event.params.productId;

    // Two independent updates, not a batch: if the old category was deleted, its failure must not stop
    // the new one from being credited.
    const adjust = async (categoryId: string, delta: number) => {
      try {
        await db
          .collection(Collections.categories)
          .doc(categoryId)
          .update({
            productCount: FieldValue.increment(delta),
            updatedAt: FieldValue.serverTimestamp(),
          });
      } catch (err) {
        // update() rejects when the category doc is gone. That is expected during a category delete,
        // so log rather than throw — throwing would schedule a retry that double-counts the other side.
        logger.warn('onProductCategoryCount: could not adjust category', {
          productId,
          categoryId,
          delta,
          err,
        });
      }
    };

    if (before !== null) await adjust(before, -1);
    if (after !== null) await adjust(after, 1);
  },
);
