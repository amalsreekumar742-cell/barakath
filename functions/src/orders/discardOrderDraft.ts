import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { Collections } from '../config/collections';
import { validateAuth } from '../utils/validateAuth';
import { readProductStock, writeStockDelta, type StockLine } from './service/stock';
import { findCouponByCode, decrementCouponUsage } from './service/coupon';
import { creditWallet } from './service/wallet';

/**
 * discardOrderDraft — the customer closed the payment sheet without paying. Release the checkout at
 * once: restore stock, hand back the coupon slot, credit any wallet amount, and mark the draft
 * Cancelled.
 *
 * WHY a separate callable from `cancelOrder`: `cancelOrder` operates on real `orders` documents, and
 *   an unpaid checkout is not one — it is an `orderDrafts` document that has never been an order.
 *   Keeping them apart means cancelOrder's gateway-refund path can never fire for something that was
 *   never charged.
 * WHY at all, given expireUnpaidOrders exists: the sweep is the backstop, but it can leave a
 *   deliberately-abandoned checkout holding stock for up to ~15 minutes. When the customer tells us
 *   they are done, honour it immediately so the items are buyable again.
 * WHY it refuses a paid draft: Razorpay can capture a beat before the sheet closes. Releasing the
 *   reservation for something that was actually paid would strand the promotion with no stock behind
 *   it — so anything not still Pending is left for the webhook to settle.
 * WHY the draft is marked Cancelled and not deleted: a late `payment.captured` must still be able to
 *   find what the customer was buying, so promoteDraftToOrder can raise a Cancelled order flagged for
 *   refund rather than losing their money.
 *
 * AUTH: the caller must own the draft; the uid comes from the verified token.
 *
 * Request:  { orderId }   Response: { released: boolean }
 */
export const discardOrderDraft = onCall(async (request): Promise<{ released: boolean }> => {
  const uid = validateAuth(request);
  const db = getFirestore();

  const data = (request.data ?? {}) as { orderId?: unknown };
  if (typeof data.orderId !== 'string' || !data.orderId) {
    throw new HttpsError('invalid-argument', 'orderId is required.');
  }
  const draftRef = db.collection(Collections.orderDrafts).doc(data.orderId);

  try {
    const snap = await draftRef.get();
    if (!snap.exists) return { released: false }; // already promoted, swept, or never existed
    const draft = snap.data() ?? {};

    // Ownership. Same silent shape as a missing draft so this cannot be used to probe ids.
    if (String(draft.userId ?? '') !== uid) return { released: false };
    if (draft.status !== 'Pending' || draft.paymentStatus !== 'Pending') {
      return { released: false };
    }

    const items = Array.isArray(draft.items) ? draft.items : [];
    const stockLines: StockLine[] = items
      .map((raw: unknown) => {
        const it = (raw ?? {}) as { productId?: unknown; variantId?: unknown; quantity?: unknown };
        return {
          productId: String(it.productId ?? ''),
          variantId: String(it.variantId ?? ''),
          quantity: Number(it.quantity) || 0,
        };
      })
      .filter((l: StockLine) => l.productId && l.variantId);
    const productIds = Array.from(new Set(stockLines.map((l) => l.productId)));
    const couponCode = String(draft.couponCode ?? '');
    const walletUsed = Number(draft.walletAmountUsed) || 0;

    // A query cannot run inside a transaction — resolve the coupon ref first.
    const coupon = couponCode ? await findCouponByCode(couponCode) : null;

    await db.runTransaction(async (tx) => {
      // READS FIRST.
      const fresh = await tx.get(draftRef);
      // Re-read inside the transaction: the pre-check above is a snapshot and the payment may have
      // landed in the seconds since. Releasing a paid checkout would be the worst outcome here.
      if (fresh.get('status') !== 'Pending' || fresh.get('paymentStatus') !== 'Pending') return;

      const stockMap = stockLines.length ? await readProductStock(tx, productIds) : null;
      const userRef = db.collection(Collections.users).doc(uid);
      let currentBalance = 0;
      if (walletUsed > 0) {
        const userSnap = await tx.get(userRef);
        currentBalance = Number(userSnap.data()?.walletBalance) || 0;
      }

      // WRITES.
      if (stockMap) writeStockDelta(tx, stockMap, stockLines, 'restore');
      if (coupon) decrementCouponUsage(tx, coupon.ref);
      if (walletUsed > 0) {
        creditWallet(
          tx,
          userRef,
          uid,
          currentBalance,
          walletUsed,
          draftRef.id,
          `Refund for abandoned checkout ${draftRef.id}`,
        );
      }

      tx.update(draftRef, {
        status: 'Cancelled',
        cancelReason: 'Payment not completed',
        updatedAt: FieldValue.serverTimestamp(),
        statusTimeline: FieldValue.arrayUnion({
          status: 'Cancelled',
          // A Timestamp, not serverTimestamp — FieldValue sentinels are illegal inside an array.
          timestamp: Timestamp.now(),
          note: 'Checkout abandoned — items released.',
        }),
      });
    });

    return { released: true };
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    logger.error('discardOrderDraft failed', { orderId: data.orderId, err });
    throw new HttpsError('internal', 'Could not release the checkout.');
  }
});
