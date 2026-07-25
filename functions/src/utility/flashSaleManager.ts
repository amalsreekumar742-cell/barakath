import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { Collections } from '../config/collections';

/** Per-variant price snapshot carried on the flash-sale doc (matches packages/shared FlashSaleProps). */
interface FlashVariantPrice {
  variantId: string;
  flashSalePrice: number;
}
interface FlashProduct {
  productId: string;
  variantPrices: FlashVariantPrice[];
}

/**
 * flashSaleManager — activate flash sales that have entered their window and revert those that have left it.
 *
 * WHY a scheduler (not a client/onCall): the window edges are time-driven, not user-driven — a sale must
 *   flip on/off on its own at startDate/endDate with no one signed in. The Admin SDK writes the product +
 *   variant price changes across many docs.
 * WHY onSchedule every 5 minutes: cheap, and 5-minute granularity is fine for a retail flash sale (the
 *   spec's table says "every minute"; the task specifies every 5 minutes — see the report note).
 *
 * SCHEMA NOTE: the deployed flashSales docs use the packages/shared FlashSaleProps shape that the admin
 *   panel actually writes — { products:[{ productId, variantPrices:[{ variantId, flashSalePrice }] }],
 *   productIds, startDate, endDate, isActive } — NOT the simpler spec-§4.17 shape (saleName,
 *   startDateTime/endDateTime, productIds only). The per-variant flashSalePrice is snapshotted at creation,
 *   so this manager only sets/clears the flags, never recomputes prices.
 *   Neither shape has an "is currently applied?" flag, so this function owns a server-managed boolean
 *   `activated` on the sale doc to make activation idempotent (missing/false = not yet applied).
 *   Product flag written is `isFlashSale` (shared ProductProps + what the admin write sets), not the
 *   spec-§4.7 `isOnFlashSale`.
 */
export const flashSaleManager = onSchedule('every 5 minutes', async () => {
  const db = getFirestore();
  const now = Timestamp.now();
  const nowMs = now.toMillis();

  // Two bounded queries cover every candidate without a composite index:
  //  - active sales that may need turning ON,
  //  - already-applied sales that may need turning OFF (even if the admin toggled isActive off).
  const [activeSnap, appliedSnap] = await Promise.all([
    db.collection(Collections.flashSales).where('isActive', '==', true).limit(200).get(),
    db.collection(Collections.flashSales).where('activated', '==', true).limit(200).get(),
  ]);

  const candidates = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
  for (const d of activeSnap.docs) candidates.set(d.id, d);
  for (const d of appliedSnap.docs) candidates.set(d.id, d);

  let activated = 0;
  let deactivated = 0;

  for (const saleDoc of candidates.values()) {
    const sale = saleDoc.data();
    const isActive = sale.isActive === true;
    const isApplied = sale.activated === true;
    const start = sale.startDate as Timestamp | undefined;
    const end = sale.endDate as Timestamp | undefined;
    const startMs = start?.toMillis() ?? 0;
    const endMs = end?.toMillis() ?? 0;

    // A sale should be live when it is toggled on and now falls inside its window.
    const shouldBeLive = isActive && startMs <= nowMs && endMs > nowMs;
    const products = (sale.products as FlashProduct[] | undefined) ?? [];

    try {
      if (shouldBeLive && !isApplied) {
        // ACTIVATE: flag each product + write each variant's snapshotted flash price.
        const batch = db.batch();
        for (const p of products) {
          batch.update(db.collection(Collections.products).doc(p.productId), { isFlashSale: true });
          for (const v of p.variantPrices ?? []) {
            batch.update(
              db
                .collection(Collections.products)
                .doc(p.productId)
                .collection(Collections.variants)
                .doc(v.variantId),
              { flashSalePrice: v.flashSalePrice },
            );
          }
        }
        batch.update(saleDoc.ref, { activated: true, updatedAt: FieldValue.serverTimestamp() });
        await batch.commit();
        activated += 1;
        logger.info('flashSaleManager: activated sale', { saleId: saleDoc.id, products: products.length });
      } else if (isApplied && !shouldBeLive) {
        // DEACTIVATE: window ended or admin toggled it off — clear product flag + variant price.
        const batch = db.batch();
        for (const p of products) {
          batch.update(db.collection(Collections.products).doc(p.productId), { isFlashSale: false });
          for (const v of p.variantPrices ?? []) {
            batch.update(
              db
                .collection(Collections.products)
                .doc(p.productId)
                .collection(Collections.variants)
                .doc(v.variantId),
              { flashSalePrice: FieldValue.delete() },
            );
          }
        }
        batch.update(saleDoc.ref, { activated: false, updatedAt: FieldValue.serverTimestamp() });
        await batch.commit();
        deactivated += 1;
        logger.info('flashSaleManager: deactivated sale', { saleId: saleDoc.id, products: products.length });
      }
    } catch (err) {
      // One bad sale (e.g. a deleted product) must not stop the rest — log and continue.
      logger.error('flashSaleManager: sale processing failed', { saleId: saleDoc.id, err });
    }
  }

  logger.info('flashSaleManager run complete', { activated, deactivated, scanned: candidates.size });
});
