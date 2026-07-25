import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { Collections } from '../config/collections';
import { getRazorpayInstance, getGeneralConfig, getSecretsDoc } from '../config/razorpay';
import { validateAuth } from '../utils/validateAuth';
import keywordsBuilder from '../utils/keywordsBuilder';
import {
  getDeliveryTaxConfig,
  getRazorpaySecrets,
  isWalletEnabled,
} from './service/configReader';
import { computeOrderTotals, toPaisa } from './service/computeTotals';
import {
  findCouponByCode,
  countUserCouponUsage,
  computeCouponDiscount,
  writeCouponUsage,
  type CouponDoc,
} from './service/coupon';
import { readProductStock, writeStockDelta, type StockLine } from './service/stock';
import { debitWallet } from './service/wallet';
import type { CartItemInput, ResolvedItem } from './service/types';

/**
 * createPaymentOrder — prices the caller's cart server-side, reserves stock, and (for the Razorpay
 * portion) opens a Razorpay order; a fully-wallet-funded cart skips Razorpay entirely (spec §2.15
 * "walletOnlyOrder" path). Returns the Razorpay order id + public key so the client SDK can open checkout.
 *
 * WHY onCall (not onRequest): the only caller is our own Flutter/Next.js app via the Firebase client SDK;
 *   the callable protocol hands us a verified `req.auth` and serialises HttpsError for the client.
 * WHY server-side at all: money. Prices, discounts, delivery, GST and the payable total are recomputed
 *   from documents the SERVER reads (products/variants, coupon, general/config) — a client-sent amount is
 *   never trusted (skill: never trust the client for money). Stock is reserved in a transaction so
 *   concurrent checkouts can't oversell.
 * AUTH: validateAuth throws `unauthenticated` when there is no signed-in caller; the uid is taken from
 *   the verified token, never from the request body.
 *
 * Request:  { items: [{ productId, variantId, quantity }], addressId, couponCode?, walletAmountToUse? }
 * Response: { orderId, razorpayOrderId (string|null), amount (₹ to collect via Razorpay), key_id }
 */
export const createPaymentOrder = onCall(async (request) => {
  const uid = validateAuth(request);
  const db = getFirestore();

  // ---- 1. Validate input shape (before any read) --------------------------------------------------
  const data = (request.data ?? {}) as {
    items?: unknown;
    addressId?: unknown;
    couponCode?: unknown;
    walletAmountToUse?: unknown;
  };
  if (!Array.isArray(data.items) || data.items.length === 0) {
    throw new HttpsError('invalid-argument', 'Your cart is empty.');
  }
  const items: CartItemInput[] = data.items.map((raw, idx) => {
    const it = (raw ?? {}) as { productId?: unknown; variantId?: unknown; quantity?: unknown };
    const quantity = Number(it.quantity);
    if (typeof it.productId !== 'string' || !it.productId) {
      throw new HttpsError('invalid-argument', `items[${idx}].productId is required`);
    }
    if (typeof it.variantId !== 'string' || !it.variantId) {
      throw new HttpsError('invalid-argument', `items[${idx}].variantId is required`);
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new HttpsError('invalid-argument', `items[${idx}].quantity must be a positive integer`);
    }
    return { productId: it.productId, variantId: it.variantId, quantity };
  });
  if (typeof data.addressId !== 'string' || !data.addressId) {
    throw new HttpsError('invalid-argument', 'A delivery address is required.');
  }
  const addressId = data.addressId;
  const couponCode = typeof data.couponCode === 'string' ? data.couponCode.trim() : '';
  const walletRequested =
    data.walletAmountToUse === undefined ? 0 : Number(data.walletAmountToUse);
  if (!Number.isFinite(walletRequested) || walletRequested < 0) {
    throw new HttpsError('invalid-argument', 'walletAmountToUse must be a non-negative number.');
  }

  try {
    // ---- 2. Config ------------------------------------------------------------------------------
    const [config, secretsDoc] = await Promise.all([getGeneralConfig(), getSecretsDoc()]);
    const deliveryTax = getDeliveryTaxConfig(config);
    const secrets = getRazorpaySecrets(config, secretsDoc);

    // ---- 3. Resolve items against the catalogue (NEVER trust client prices) ----------------------
    const resolved: ResolvedItem[] = [];
    for (const item of items) {
      const productSnap = await db.collection(Collections.products).doc(item.productId).get();
      if (!productSnap.exists) {
        throw new HttpsError('not-found', `A product in your cart is no longer available.`);
      }
      const p = productSnap.data() ?? {};
      const variantSnap = await productSnap.ref
        .collection(Collections.variants)
        .doc(item.variantId)
        .get();
      if (!variantSnap.exists) {
        throw new HttpsError('not-found', `A selected variant is no longer available.`);
      }
      const v = variantSnap.data() ?? {};
      const stock = Number((v as { stock?: unknown }).stock) || 0;
      if (stock < item.quantity) {
        throw new HttpsError(
          'failed-precondition',
          `Only ${stock} left of ${String((p as { name?: unknown }).name ?? 'an item')}.`,
        );
      }
      const offerPrice = Number((v as { offerPrice?: unknown }).offerPrice) || 0;
      const images = Array.isArray((p as { images?: unknown }).images)
        ? ((p as { images: unknown[] }).images as unknown[])
        : [];
      resolved.push({
        productId: item.productId,
        productName: String((p as { name?: unknown }).name ?? ''),
        productImage:
          (typeof images[0] === 'string' ? (images[0] as string) : undefined) ??
          String((p as { thumbnail?: unknown }).thumbnail ?? ''),
        categoryId: String((p as { categoryId?: unknown }).categoryId ?? ''),
        isCombo: Boolean((p as { isCombo?: unknown }).isCombo),
        comboDeliveryCharge: Number((p as { comboDeliveryCharge?: unknown }).comboDeliveryCharge) || 0,
        variantId: item.variantId,
        variantName: String((v as { name?: unknown }).name ?? ''),
        variantColor: String((v as { color?: unknown }).color ?? ''),
        mrp: Number((v as { mrp?: unknown }).mrp) || 0,
        offerPrice,
        quantity: item.quantity,
        subtotal: offerPrice * item.quantity,
      });
    }
    const subtotal = resolved.reduce((s, i) => s + i.subtotal, 0);

    // ---- 4. Coupon (optional) -------------------------------------------------------------------
    let couponDiscount = 0;
    let couponRefId: string | null = null;
    let coupon: CouponDoc | null = null;
    if (couponCode) {
      const found = await findCouponByCode(couponCode);
      if (!found) throw new HttpsError('not-found', 'That coupon code is invalid.');
      const usageCount = await countUserCouponUsage(found.ref, uid);
      couponDiscount = computeCouponDiscount(found.data, subtotal, resolved, usageCount);
      couponRefId = found.ref.id;
      coupon = found.data;
    }

    // ---- 5. User + address ----------------------------------------------------------------------
    const userRef = db.collection(Collections.users).doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) throw new HttpsError('not-found', 'Your account was not found.');
    const user = userSnap.data() ?? {};
    const walletBalance = Number((user as { walletBalance?: unknown }).walletBalance) || 0;

    if (walletRequested > 0) {
      if (!isWalletEnabled(config)) {
        throw new HttpsError('failed-precondition', 'Wallet payments are currently disabled.');
      }
      if (walletRequested > walletBalance) {
        throw new HttpsError('failed-precondition', 'Wallet balance is insufficient.');
      }
    }

    const addrSnap = await userRef.collection(Collections.addresses).doc(addressId).get();
    if (!addrSnap.exists) throw new HttpsError('not-found', 'The selected address was not found.');
    const a = addrSnap.data() ?? {};
    const shippingAddress = {
      // Home / Office / Other — carried onto the order so admin and the invoice
      // can show which of the customer's places this went to.
      label: String((a as { label?: unknown }).label ?? 'Home'),
      fullName: String((a as { fullName?: unknown }).fullName ?? ''),
      phone: String((a as { phone?: unknown }).phone ?? ''),
      addressLine1: String((a as { addressLine1?: unknown }).addressLine1 ?? ''),
      addressLine2: String((a as { addressLine2?: unknown }).addressLine2 ?? ''),
      city: String((a as { city?: unknown }).city ?? ''),
      state: String((a as { state?: unknown }).state ?? ''),
      pincode: String((a as { pincode?: unknown }).pincode ?? ''),
      landmark: String((a as { landmark?: unknown }).landmark ?? ''),
    };

    // ---- 6. Totals ------------------------------------------------------------------------------
    const totals = computeOrderTotals(resolved, couponDiscount, walletRequested, deliveryTax);
    const isRazorpay = totals.razorpayAmount > 0;
    const paymentMethod: 'Razorpay' | 'Wallet' | 'Both' = isRazorpay
      ? totals.walletAmountUsed > 0
        ? 'Both'
        : 'Razorpay'
      : 'Wallet';
    const paymentStatus: 'Pending' | 'Paid' = isRazorpay ? 'Pending' : 'Paid';

    // Mint ids up front so the Razorpay receipt + payment doc can reference the order id.
    const orderRef = db.collection(Collections.orders).doc();
    const paymentRef = db.collection(Collections.payments).doc();
    const orderId = orderRef.id;

    // ---- 7. Razorpay order (only when there is an amount to collect) -----------------------------
    let razorpayOrderId: string | null = null;
    if (isRazorpay) {
      const instance = await getRazorpayInstance();
      const rzpOrder = await instance.orders.create({
        amount: toPaisa(totals.razorpayAmount),
        currency: 'INR',
        receipt: orderId,
      });
      razorpayOrderId = String(rzpOrder.id);
    }

    // ---- 8. Atomic commit: reserve stock, spend coupon/wallet, write order + payment -------------
    const userName = String((user as { fullName?: unknown }).fullName ?? '');
    const userPhone = String((user as { phone?: unknown }).phone ?? '');
    const userEmail = String((user as { email?: unknown }).email ?? '');
    const stockLines: StockLine[] = resolved.map((i) => ({
      productId: i.productId,
      variantId: i.variantId,
      quantity: i.quantity,
    }));
    const productIds = Array.from(new Set(resolved.map((i) => i.productId)));

    await db.runTransaction(async (tx) => {
      // --- reads first ---
      const stockMap = await readProductStock(tx, productIds);
      let couponUsedCount = 0;
      if (couponRefId && coupon) {
        const couponSnap = await tx.get(db.collection(Collections.coupons).doc(couponRefId));
        couponUsedCount = Number(couponSnap.data()?.usedCount) || 0;
        if (coupon.usageLimit > 0 && couponUsedCount >= coupon.usageLimit) {
          throw new HttpsError('failed-precondition', 'This coupon has reached its usage limit.');
        }
      }
      let freshBalance = walletBalance;
      if (totals.walletAmountUsed > 0) {
        const freshUser = await tx.get(userRef);
        freshBalance = Number(freshUser.data()?.walletBalance) || 0;
        if (freshBalance < totals.walletAmountUsed) {
          throw new HttpsError('failed-precondition', 'Wallet balance is insufficient.');
        }
      }

      // --- writes ---
      writeStockDelta(tx, stockMap, stockLines, 'reserve');
      if (couponRefId) {
        writeCouponUsage(tx, db.collection(Collections.coupons).doc(couponRefId), orderId, uid);
      }
      if (totals.walletAmountUsed > 0) {
        debitWallet(tx, userRef, uid, freshBalance, totals.walletAmountUsed, orderId);
      }

      const now = Timestamp.now();
      tx.set(orderRef, {
        id: orderId,
        userId: uid,
        userName,
        userPhone,
        userEmail,
        items: resolved.map((i) => ({
          productId: i.productId,
          productName: i.productName,
          productImage: i.productImage,
          variantId: i.variantId,
          variantName: i.variantName,
          variantColor: i.variantColor,
          mrp: i.mrp,
          offerPrice: i.offerPrice,
          quantity: i.quantity,
          subtotal: i.subtotal,
        })),
        subtotal: totals.subtotal,
        couponDiscount: totals.couponDiscount,
        couponCode: couponCode || '',
        walletAmountUsed: totals.walletAmountUsed,
        deliveryCharge: totals.deliveryCharge,
        gstAmount: totals.gstAmount,
        grandTotal: totals.grandTotal,
        paymentMethod,
        paymentStatus,
        razorpayOrderId: razorpayOrderId ?? '',
        razorpayPaymentId: '',
        status: 'Pending',
        shippingAddress,
        trackingId: '',
        courierName: '',
        statusTimeline: [{ status: 'Pending', timestamp: now, note: 'Order placed' }],
        cancelReason: '',
        isComboOrder: resolved.some((i) => i.isCombo),
        keywords: keywordsBuilder(`${userName} ${orderId} ${userPhone}`),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      tx.set(paymentRef, {
        id: paymentRef.id,
        orderId,
        userId: uid,
        userName,
        userPhone,
        amount: totals.grandTotal,
        method: paymentMethod,
        razorpayOrderId: razorpayOrderId ?? '',
        razorpayPaymentId: '',
        razorpaySignature: '',
        walletAmountUsed: totals.walletAmountUsed,
        razorpayAmountPaid: totals.razorpayAmount,
        status: paymentStatus,
        refundId: '',
        refundAmount: 0,
        refundedAt: null,
        gstAmount: totals.gstAmount,
        metadata: {},
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    return {
      orderId,
      razorpayOrderId,
      amount: totals.razorpayAmount,
      key_id: secrets.keyId,
    };
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    logger.error('createPaymentOrder failed', err);
    throw new HttpsError('internal', 'Could not place your order. Please try again.');
  }
});
