import { onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { createHmac, timingSafeEqual } from 'crypto';
import { Collections } from '../config/collections';
import { getGeneralConfig, getSecretsDoc } from '../config/razorpay';
import { getRazorpaySecrets } from '../orders/service/configReader';
import { readProductStock, writeStockDelta, type StockLine } from '../orders/service/stock';
import { promoteDraftToOrder } from '../orders/service/promoteDraft';
import { findCouponByCode, decrementCouponUsage } from '../orders/service/coupon';
import { creditWallet } from '../orders/service/wallet';

/**
 * razorpayWebhook — Razorpay's server pushes payment lifecycle events here (spec §5.3 #13).
 *
 * WHY onRequest (not onCall): the caller is Razorpay's backend speaking plain HTTP with its own body
 *   shape and `X-Razorpay-Signature` HMAC — it knows nothing of the Firebase callable protocol and there
 *   is no Firebase user to authenticate.
 * SECURITY: the URL is public, so the endpoint authenticates the CALLER by verifying the HMAC of the RAW
 *   body against the webhook secret (timing-safe compare). Non-POST → 405; bad signature → 400.
 * WHY server-side: it is the authoritative settlement path — it flips payments to Paid, and on failure
 *   RESTORES stock and reverses coupon/wallet, all with Admin-SDK privileges the client cannot have.
 * Idempotency: handlers no-op when the order is already in the target state, so Razorpay retries are safe.
 *
 * Request:  POST (raw JSON) · Header: X-Razorpay-Signature
 * Response: 200 { received: true } · 400 { error } · 405 { error }
 */
export const razorpayWebhook = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const [config, secretsDoc] = await Promise.all([getGeneralConfig(), getSecretsDoc()]);
    const { webhookSecret } = getRazorpaySecrets(config, secretsDoc);
    if (!webhookSecret) {
      logger.error('razorpayWebhook: webhook secret not configured');
      res.status(400).json({ error: 'Webhook not configured' });
      return;
    }

    // Verify the signature against the RAW body (parsing first would change the bytes).
    const rawBody: Buffer =
      req.rawBody ?? Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
    const signature = String(req.get('x-razorpay-signature') ?? '');
    const expected = createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
    const expectedBuf = Buffer.from(expected, 'utf8');
    const actualBuf = Buffer.from(signature, 'utf8');
    const valid =
      signature.length > 0 &&
      expectedBuf.length === actualBuf.length &&
      timingSafeEqual(expectedBuf, actualBuf);
    if (!valid) {
      res.status(400).json({ error: 'Invalid signature' });
      return;
    }

    const body = JSON.parse(rawBody.toString('utf8')) as {
      event?: string;
      payload?: { payment?: { entity?: { order_id?: string; id?: string } } };
    };
    const event = body.event ?? '';
    const entity = body.payload?.payment?.entity ?? {};
    const razorpayOrderId = String(entity.order_id ?? '');
    const razorpayPaymentId = String(entity.id ?? '');

    if (event !== 'payment.captured' && event !== 'payment.failed') {
      // Not an event we act on — acknowledge so Razorpay stops retrying.
      res.status(200).json({ received: true, ignored: event });
      return;
    }
    if (!razorpayOrderId) {
      res.status(200).json({ received: true, note: 'no order_id' });
      return;
    }

    const db = getFirestore();

    // A Razorpay leg lives in `orderDrafts` until it is paid — nothing unpaid is ever an order — so
    // look there first. `orders` is still checked as a fallback: the draft is deleted the moment it
    // is promoted, so a duplicate/retried webhook for an already-settled payment finds it there.
    const draftQuery = await db
      .collection(Collections.orderDrafts)
      .where('razorpayOrderId', '==', razorpayOrderId)
      .limit(1)
      .get();
    let docRef = draftQuery.docs[0]?.ref;
    let docData = draftQuery.docs[0]?.data();
    if (!docRef) {
      const orderQuery = await db
        .collection(Collections.orders)
        .where('razorpayOrderId', '==', razorpayOrderId)
        .limit(1)
        .get();
      docRef = orderQuery.docs[0]?.ref;
      docData = orderQuery.docs[0]?.data();
    }
    if (!docRef || !docData) {
      // Unknown checkout — acknowledge (nothing to do); avoids endless retries.
      res.status(200).json({ received: true, note: 'order not found' });
      return;
    }
    const orderRef = docRef;

    if (event === 'payment.captured') {
      // Promotion is the whole settlement: it creates the real order + payment documents, is
      // idempotent against a duplicate webhook or a verifyPayment that already ran, and handles the
      // case where the checkout was released before the money landed (the order is then created
      // already Cancelled, with the refund owed spelled out in its timeline).
      const outcome = await promoteDraftToOrder(orderRef.id, razorpayPaymentId);
      res.status(200).json({ received: true, outcome });
      return;
    }

    // event === 'payment.failed' → reverse everything the checkout reserved.
    const order = docData;
    const userId = String(order.userId ?? '');
    const couponCode = String(order.couponCode ?? '');
    const walletAmountUsed = Number(order.walletAmountUsed) || 0;
    const items = Array.isArray(order.items) ? order.items : [];
    const stockLines: StockLine[] = items.map((raw: unknown) => {
      const it = (raw ?? {}) as { productId?: unknown; variantId?: unknown; quantity?: unknown };
      return {
        productId: String(it.productId ?? ''),
        variantId: String(it.variantId ?? ''),
        quantity: Number(it.quantity) || 0,
      };
    });
    const productIds = Array.from(new Set(stockLines.map((l) => l.productId).filter(Boolean)));
    const coupon = couponCode ? await findCouponByCode(couponCode) : null;

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(orderRef);
      const o = snap.data() ?? {};
      // Only reverse once: skip if already Failed, or if it somehow got Paid.
      if (o.paymentStatus === 'Failed' || o.paymentStatus === 'Paid') return;

      const stockMap = await readProductStock(tx, productIds);
      const userRef = userId ? db.collection(Collections.users).doc(userId) : null;
      let currentBalance = 0;
      if (userRef && walletAmountUsed > 0) {
        const userSnap = await tx.get(userRef);
        currentBalance = Number(userSnap.data()?.walletBalance) || 0;
      }
      const payQuery = await tx.get(
        db.collection(Collections.payments).where('orderId', '==', orderRef.id).limit(1),
      );

      writeStockDelta(tx, stockMap, stockLines, 'restore');
      if (coupon) decrementCouponUsage(tx, coupon.ref);
      if (userRef && walletAmountUsed > 0) {
        creditWallet(
          tx,
          userRef,
          userId,
          currentBalance,
          walletAmountUsed,
          orderRef.id,
          `Refund for failed payment on order ${orderRef.id}`,
        );
      }

      // status goes Cancelled too, not just paymentStatus: everything this checkout reserved has
      // just been handed back, so the document must not look like something that can still be paid.
      // It also makes a late `payment.captured` land in promoteDraftToOrder's released branch, which
      // creates a Cancelled order flagged for refund rather than an order with no stock behind it.
      tx.update(orderRef, {
        paymentStatus: 'Failed',
        status: 'Cancelled',
        cancelReason: 'Payment failed',
        razorpayPaymentId,
        updatedAt: FieldValue.serverTimestamp(),
      });
      // Only ever present on the fallback path (an already-promoted order); a draft has no payment
      // document, since the payments ledger records money that actually moved.
      const payDoc = payQuery.docs[0];
      if (payDoc) {
        tx.update(payDoc.ref, {
          status: 'Failed',
          razorpayPaymentId,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    });

    res.status(200).json({ received: true });
  } catch (err) {
    logger.error('razorpayWebhook failed', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});
