import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { Collections } from '../config/collections';
import { getRazorpayInstance, getGeneralConfig, getSecretsDoc } from '../config/razorpay';
import { validateAuth } from '../utils/validateAuth';
import { getRazorpaySecrets, isWalletEnabled } from '../orders/service/configReader';
import { toPaisa } from '../orders/service/computeTotals';

/** Smallest top-up we will open a gateway order for. */
const MIN_TOP_UP = 1;
/** Upper guard rail. Not a business rule — a blast radius limit on a typo. */
const MAX_TOP_UP = 100000;

/**
 * createWalletTopUpOrder — opens a bare Razorpay order so a customer can add money to their own wallet
 * (spec §2.20 "Add money"), and records what that order was FOR.
 *
 * WHY a separate callable and not a branch inside createPaymentOrder: that function is the checkout path
 *   — it requires a cart and an address, prices items, reserves stock and writes an `orders` document.
 *   A top-up has no cart, no address and no stock. Threading a `purpose` flag through it would put an
 *   `if` in front of every one of those steps in the one function where a mistake charges the wrong
 *   amount or oversells stock. This shares the config/secrets helpers and nothing else.
 *
 * WHY it writes a walletTopUps document BEFORE the customer pays: verification has to know how much this
 *   order was opened for. If the amount came back from the client after payment, a modified client could
 *   pay ₹1 and claim ₹10,000 — the signature only proves THAT a payment happened, not its value. The
 *   stored amount is the only figure verifyWalletTopUp will credit.
 *
 * WHY no stock/coupon/wallet logic: money in, nothing else moves. The credit itself happens exclusively
 *   in verifyWalletTopUp, and only against a valid signature.
 *
 * AUTH: validateAuth — the uid comes from the verified token, never the body, so a caller can only ever
 *   open a top-up for themselves.
 *
 * Request:  { amount: number }  — rupees
 * Response: { topUpId, razorpayOrderId, amount, key_id }
 */
export const createWalletTopUpOrder = onCall(async (request) => {
  const uid = validateAuth(request);
  const db = getFirestore();

  const { amount } = (request.data ?? {}) as { amount?: unknown };
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    throw new HttpsError('invalid-argument', 'Enter an amount greater than ₹0.');
  }
  // Round to paise up front: this exact figure is what gets stored, charged and
  // later credited, and all three must agree to the last paisa.
  const rupees = Math.round(value * 100) / 100;
  if (rupees < MIN_TOP_UP) {
    throw new HttpsError('invalid-argument', `The minimum top-up is ₹${MIN_TOP_UP}.`);
  }
  if (rupees > MAX_TOP_UP) {
    throw new HttpsError('invalid-argument', `The maximum top-up is ₹${MAX_TOP_UP.toLocaleString('en-IN')}.`);
  }

  try {
    const [config, secretsDoc] = await Promise.all([getGeneralConfig(), getSecretsDoc()]);

    // Same store-wide switch the wallet UI reads. Checked server-side too: a
    // disabled wallet must not be topped up by a client that ignored the flag.
    if (!isWalletEnabled(config)) {
      throw new HttpsError(
        'failed-precondition',
        'Wallet payments are currently switched off by the store.',
      );
    }

    const secrets = getRazorpaySecrets(config, secretsDoc);
    if (!secrets.keyId || !secrets.keySecret) {
      throw new HttpsError('failed-precondition', 'Payment gateway is not configured.');
    }

    // Mint the id first so it can be the Razorpay receipt — that is the thread
    // that ties a gateway payment back to this record in support/reconciliation.
    const topUpRef = db.collection(Collections.walletTopUps).doc();

    const instance = await getRazorpayInstance();
    const rzpOrder = await instance.orders.create({
      amount: toPaisa(rupees),
      currency: 'INR',
      receipt: topUpRef.id,
      notes: { purpose: 'wallet_topup', userId: uid },
    });
    const razorpayOrderId = String(rzpOrder.id);

    // Written only after Razorpay accepted the order, so a gateway failure
    // leaves no orphan Pending record behind.
    await topUpRef.set({
      id: topUpRef.id,
      userId: uid,
      amount: rupees,
      status: 'Pending',
      razorpayOrderId,
      razorpayPaymentId: '',
      razorpaySignature: '',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      topUpId: topUpRef.id,
      razorpayOrderId,
      amount: rupees,
      key_id: secrets.keyId,
    };
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    logger.error('createWalletTopUpOrder failed', err);
    throw new HttpsError('internal', 'Could not start the top-up. Please try again.');
  }
});
