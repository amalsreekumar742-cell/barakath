import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { createHmac, timingSafeEqual } from 'crypto';
import { Collections } from '../config/collections';
import { getGeneralConfig, getSecretsDoc } from '../config/razorpay';
import { validateAuth } from '../utils/validateAuth';
import { getRazorpaySecrets } from './service/configReader';

/**
 * verifyPayment — the client's handoff after Razorpay checkout succeeds. Verifies the Razorpay signature
 * (HMAC of `order_id|payment_id` with the key secret) and, if valid, marks the order + payment Paid.
 *
 * WHY onCall: called only by our own app right after the Razorpay SDK returns success — the callable
 *   protocol gives a verified caller for free.
 * WHY server-side: the key secret used to sign the HMAC must never reach the client, and a client must
 *   not be able to flip an order to Paid by asserting so — only a valid signature proves the gateway
 *   charged the card.
 * WHY it does NOT restore stock on an invalid signature: this is a best-effort confirmation; the
 *   authoritative failure path is the Razorpay webhook (razorpayWebhook), which restores stock and
 *   reverses coupon/wallet on `payment.failed`. Double-restoring here would corrupt inventory.
 * AUTH: validateAuth (signed-in user); the uid is from the verified token.
 *
 * Request:  { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 * Response: { verified: true, orderId } on success · { verified: false } on a bad/mismatched signature
 */
export const verifyPayment = onCall(async (request) => {
  validateAuth(request);
  const db = getFirestore();

  const data = (request.data ?? {}) as {
    razorpay_order_id?: unknown;
    razorpay_payment_id?: unknown;
    razorpay_signature?: unknown;
  };
  const orderId = data.razorpay_order_id;
  const paymentId = data.razorpay_payment_id;
  const signature = data.razorpay_signature;
  if (
    typeof orderId !== 'string' ||
    typeof paymentId !== 'string' ||
    typeof signature !== 'string' ||
    !orderId ||
    !paymentId ||
    !signature
  ) {
    throw new HttpsError('invalid-argument', 'Missing Razorpay verification fields.');
  }

  try {
    const [config, secretsDoc] = await Promise.all([getGeneralConfig(), getSecretsDoc()]);
    const { keySecret } = getRazorpaySecrets(config, secretsDoc);
    if (!keySecret) throw new HttpsError('failed-precondition', 'Payment gateway is not configured.');

    // Razorpay's client-side signature = HMAC-SHA256(order_id + "|" + payment_id, key_secret).
    const expected = createHmac('sha256', keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    const expectedBuf = Buffer.from(expected, 'utf8');
    const actualBuf = Buffer.from(signature, 'utf8');
    const valid =
      expectedBuf.length === actualBuf.length && timingSafeEqual(expectedBuf, actualBuf);
    if (!valid) return { verified: false };

    // Find the order by its Razorpay order id (bounded to 1).
    const orderQuery = await db
      .collection(Collections.orders)
      .where('razorpayOrderId', '==', orderId)
      .limit(1)
      .get();
    const orderDoc = orderQuery.docs[0];
    if (!orderDoc) throw new HttpsError('not-found', 'Order not found for this payment.');

    // Mark order + its payment doc Paid. Idempotent: writing the same values twice is harmless.
    await db.runTransaction(async (tx) => {
      const payQuery = await tx.get(
        db.collection(Collections.payments).where('orderId', '==', orderDoc.id).limit(1),
      );
      tx.update(orderDoc.ref, {
        paymentStatus: 'Paid',
        razorpayPaymentId: paymentId,
        updatedAt: FieldValue.serverTimestamp(),
      });
      const payDoc = payQuery.docs[0];
      if (payDoc) {
        tx.update(payDoc.ref, {
          status: 'Paid',
          razorpayPaymentId: paymentId,
          razorpaySignature: signature,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    });

    return { verified: true, orderId: orderDoc.id };
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    logger.error('verifyPayment failed', err);
    throw new HttpsError('internal', 'Could not verify the payment.');
  }
});
