import {
  getFirestore,
  FieldValue,
  Timestamp,
  type Transaction,
  type DocumentReference,
} from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { Collections } from '../../config/collections';
import { round2 } from './computeTotals';
import type { ResolvedItem } from './types';

/**
 * Coupon validation + redemption bookkeeping (spec §1.12, §2.13). The coupon doc is admin-read-only in
 * Security Rules, so the client can neither read the discount nor the redemption ledger — this is why the
 * math lives here. `computeCouponDiscount` is pure (throws HttpsError on any failed rule); the write
 * helpers move the `usedCount` counter and append/rewind `usageHistory` inside a transaction.
 */

/** Minimal coupon shape read from Firestore — mirrors the shared CouponProps fields we depend on. */
export interface CouponDoc {
  code: string;
  discountType: 'Percentage' | 'Fixed';
  discountValue: number;
  minimumOrderAmount: number;
  maximumDiscount: number;
  usageLimit: number;
  usedCount: number;
  perUserLimit: number;
  validFrom: Timestamp | null;
  validUntil: Timestamp | null;
  isActive: boolean;
  applicableCategories: string[];
  applicableProducts: string[];
  applicationType: 'All' | 'Category' | 'Product';
}

/** Locate a coupon by its (case-insensitive) code. Returns the ref + typed data, or null if none. */
export async function findCouponByCode(
  code: string,
): Promise<{ ref: DocumentReference; data: CouponDoc } | null> {
  const db = getFirestore();
  const normalized = code.trim().toUpperCase();
  const snap = await db
    .collection(Collections.coupons)
    .where('code', '==', normalized)
    .limit(1)
    .get();
  const doc = snap.docs[0];
  if (!doc) return null;
  const d = doc.data();
  return {
    ref: doc.ref,
    data: {
      code: String(d.code ?? ''),
      discountType: d.discountType === 'Fixed' ? 'Fixed' : 'Percentage',
      discountValue: Number(d.discountValue) || 0,
      minimumOrderAmount: Number(d.minimumOrderAmount) || 0,
      maximumDiscount: Number(d.maximumDiscount) || 0,
      usageLimit: Number(d.usageLimit) || 0,
      usedCount: Number(d.usedCount) || 0,
      perUserLimit: Number(d.perUserLimit) || 0,
      validFrom: (d.validFrom as Timestamp) ?? null,
      validUntil: (d.validUntil as Timestamp) ?? null,
      isActive: Boolean(d.isActive),
      applicableCategories: Array.isArray(d.applicableCategories) ? d.applicableCategories : [],
      applicableProducts: Array.isArray(d.applicableProducts) ? d.applicableProducts : [],
      applicationType:
        d.applicationType === 'Category' || d.applicationType === 'Product'
          ? d.applicationType
          : 'All',
    },
  };
}

/** Count how many times this user has already redeemed the coupon (per-user-limit enforcement). */
export async function countUserCouponUsage(
  couponRef: DocumentReference,
  userId: string,
): Promise<number> {
  const agg = await couponRef
    .collection('usageHistory')
    .where('customerId', '==', userId)
    .count()
    .get();
  return agg.data().count;
}

/**
 * Validate the coupon against the cart and return the discount in rupees. Throws HttpsError with a
 * user-actionable message on the first failed rule. For Category/Product coupons the discount is computed
 * only on the eligible portion of the cart (an "All" coupon applies to the whole subtotal).
 */
export function computeCouponDiscount(
  coupon: CouponDoc,
  subtotal: number,
  items: ResolvedItem[],
  userUsageCount: number,
): number {
  if (!coupon.isActive) throw new HttpsError('failed-precondition', 'This coupon is not active.');

  const now = Timestamp.now();
  if (coupon.validFrom && now.toMillis() < coupon.validFrom.toMillis()) {
    throw new HttpsError('failed-precondition', 'This coupon is not valid yet.');
  }
  if (coupon.validUntil && now.toMillis() > coupon.validUntil.toMillis()) {
    throw new HttpsError('failed-precondition', 'This coupon has expired.');
  }
  if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
    throw new HttpsError('failed-precondition', 'This coupon has reached its usage limit.');
  }
  if (coupon.perUserLimit > 0 && userUsageCount >= coupon.perUserLimit) {
    throw new HttpsError('failed-precondition', 'You have already used this coupon.');
  }
  if (subtotal < coupon.minimumOrderAmount) {
    throw new HttpsError(
      'failed-precondition',
      `Add ₹${round2(coupon.minimumOrderAmount - subtotal)} more to use this coupon.`,
    );
  }

  // Determine the base the discount applies to.
  let base = subtotal;
  if (coupon.applicationType === 'Category') {
    const eligible = items.filter((i) => coupon.applicableCategories.includes(i.categoryId));
    if (eligible.length === 0) {
      throw new HttpsError('failed-precondition', 'This coupon does not apply to your items.');
    }
    base = eligible.reduce((s, i) => s + i.subtotal, 0);
  } else if (coupon.applicationType === 'Product') {
    const eligible = items.filter((i) => coupon.applicableProducts.includes(i.productId));
    if (eligible.length === 0) {
      throw new HttpsError('failed-precondition', 'This coupon does not apply to your items.');
    }
    base = eligible.reduce((s, i) => s + i.subtotal, 0);
  }

  let discount: number;
  if (coupon.discountType === 'Percentage') {
    discount = (base * coupon.discountValue) / 100;
    if (coupon.maximumDiscount > 0) discount = Math.min(discount, coupon.maximumDiscount);
  } else {
    discount = coupon.discountValue;
  }
  return round2(Math.min(discount, base));
}

/** WRITE: spend one redemption — bump usedCount + append a usageHistory entry (spec §4.13 sub-collection). */
export function writeCouponUsage(
  tx: Transaction,
  couponRef: DocumentReference,
  orderId: string,
  userId: string,
): void {
  tx.update(couponRef, { usedCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
  tx.set(couponRef.collection('usageHistory').doc(), {
    customerId: userId,
    orderId,
    usedAt: FieldValue.serverTimestamp(),
  });
}

/** WRITE: give back one redemption when an order fails / is cancelled (decrement usedCount). */
export function decrementCouponUsage(tx: Transaction, couponRef: DocumentReference): void {
  tx.update(couponRef, {
    usedCount: FieldValue.increment(-1),
    updatedAt: FieldValue.serverTimestamp(),
  });
}
