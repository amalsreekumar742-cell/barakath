import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { getFirestore } from 'firebase-admin/firestore';
import { createHmac, timingSafeEqual } from 'crypto';
import { Collections } from '../config/collections';
import { getGeneralConfig, getSecretsDoc } from '../config/razorpay';
import { validateAuth } from '../utils/validateAuth';
import { getRazorpaySecrets } from '../orders/service/configReader';
import { settleWalletTopUp } from './service/settleTopUp';

/**
 * verifyWalletTopUp — the customer's handoff after the Razorpay sheet reports success for a wallet
 * top-up. Verifies the signature and, only then, credits the wallet and appends the ledger entry.
 *
 * WHY server-side: two separate reasons, and both matter.
 *   1. The key secret that signs the HMAC must never reach the app.
 *   2. `walletBalance` is money. The client asserting "I paid" is not proof; a valid signature over
 *      `order_id|payment_id` is the only thing that shows the gateway actually charged the card.
 *
 * WHY the amount is NOT taken from the request: it is read from the walletTopUps document that
 *   createWalletTopUpOrder wrote before payment. The signature proves a payment occurred against a given
 *   Razorpay order — it says nothing about its value — so trusting a client-sent amount would let a
 *   modified app pay ₹1 and credit itself ₹10,000.
 *
 * WHY the credit goes through settleWalletTopUp: this endpoint is retried in practice (a flaky network
 *   after the Razorpay sheet closes is normal), and razorpayWebhook settles the same top-up when the app
 *   never gets this far. That helper credits inside one transaction keyed on the top-up's status, so
 *   whichever path runs second is a no-op that returns the same balance.
 *
 * AUTH: validateAuth, plus an explicit owner check — a signature is not a claim of ownership, so a
 *   caller must not be able to settle someone else's top-up into their own balance.
 *
 * Request:  { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 * Response: { verified: true, amount, newBalance } · { verified: false } on a bad signature
 *
 * `amount` is echoed back because the client cannot be relied on to still know it: Razorpay opens its
 * own Android Activity, and the host app can be destroyed behind it. The page that started the top-up
 * may be a brand-new State by the time this returns, holding nothing about the payment.
 */
export const verifyWalletTopUp = onCall(async (request) => {
  const uid = validateAuth(request);
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
    const expected = createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest('hex');
    const expectedBuf = Buffer.from(expected, 'utf8');
    const actualBuf = Buffer.from(signature, 'utf8');
    const valid =
      expectedBuf.length === actualBuf.length && timingSafeEqual(expectedBuf, actualBuf);
    if (!valid) {
      logger.warn('verifyWalletTopUp: signature mismatch', { uid, orderId });
      return { verified: false };
    }

    const topUpQuery = await db
      .collection(Collections.walletTopUps)
      .where('razorpayOrderId', '==', orderId)
      .limit(1)
      .get();
    const topUpDoc = topUpQuery.docs[0];
    if (!topUpDoc) throw new HttpsError('not-found', 'No top-up found for this payment.');

    // A valid signature says the gateway charged SOMEONE. It does not say who,
    // so ownership is checked separately against the verified token.
    if (topUpDoc.get('userId') !== uid) {
      logger.error('verifyWalletTopUp: caller does not own this top-up', {
        uid,
        topUpId: topUpDoc.id,
      });
      throw new HttpsError('permission-denied', 'This top-up belongs to another account.');
    }

    // Idempotent against a retry of this call AND against razorpayWebhook having settled it first.
    const settled = await settleWalletTopUp(topUpDoc.ref, {
      razorpayPaymentId: paymentId,
      razorpaySignature: signature,
      settledVia: 'client',
    });

    return { verified: true, amount: settled.amount, newBalance: settled.newBalance };
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    logger.error('verifyWalletTopUp failed', err);
    throw new HttpsError('internal', 'Could not confirm the top-up.');
  }
});
