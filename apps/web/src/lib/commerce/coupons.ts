import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared';
import type { CouponProps } from '@barakath/shared';
import { db } from '@/lib/firebaseConfig';
import { round2, computeCouponDiscountPreview } from './totals';
import type { CartItem, AppliedCoupon } from '@/types/cart';

/**
 * Coupon engine — client-side eligibility classification + manual-code validation, mirroring
 * `functions/src/orders/service/coupon.ts`'s rules per WEB_BATCH3_NOTES.md §4. Everything here is
 * OPTIMISTIC / DISPLAY-ONLY: `createPaymentOrder` re-validates and re-computes the discount
 * server-side from the coupon doc IT reads, and can still reject a coupon this module accepted (most
 * importantly `perUserLimit` — `coupons/{id}/usageHistory` has no client read rule at all, so
 * "have I already used this" cannot be checked here; the notes are explicit that this check is
 * dropped, not approximated). Checkout must always be ready for the server to say no to a coupon this
 * file said yes to.
 *
 * `coupons` is readable by any signed-in customer (`firestore.rules`: `allow read: if isSignedIn() ||
 * isAdmin()` — the service file's own "admin-read-only" comment is stale relative to the deployed
 * rule; the notes say trust the rule).
 */

/** Bounded read, not paginated: the storefront's whole coupon catalogue is small by nature (this is a
 *  "fetch the set to classify it" screen, not a growing list — same exception the skill grants a mega
 *  menu or variant selector). 100 is generous headroom over any real campaign's coupon count. */
const COUPON_READ_CAP = 100;

export interface EligibleCoupon {
  coupon: CouponProps;
  /** Discount preview at the CURRENT cart subtotal, via the same math `computeTotals` uses. */
  discount: number;
  isSpinWon: boolean;
}

export interface LockedCoupon {
  coupon: CouponProps;
  /** User-facing reason this coupon can't be applied yet — never a generic "invalid coupon". */
  reason: string;
  isSpinWon: boolean;
}

export interface EligibleCouponsResult {
  available: EligibleCoupon[];
  locked: LockedCoupon[];
}

export type ValidateCodeResult =
  | { ok: true; coupon: CouponProps; discount: number }
  | { ok: false; reason: string };

/** A coupon that should not be shown at all — expired, deactivated, or globally exhausted. Distinct
 *  from LOCKED (shown greyed with an unlock hint) per spec §2.12. */
function isHidden(coupon: CouponProps, nowMillis: number): boolean {
  if (!coupon.isActive) return true;
  if (coupon.validUntil && coupon.validUntil.toMillis() < nowMillis) return true;
  if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) return true;
  return false;
}

/** Whether at least one cart line matches a Category/Product-scoped coupon; `All` always matches. */
function appliesToCart(coupon: CouponProps, items: CartItem[]): boolean {
  if (coupon.applicationType === 'Category') {
    return items.some((i) => coupon.applicableCategories.includes(i.categoryId));
  }
  if (coupon.applicationType === 'Product') {
    return items.some((i) => coupon.applicableProducts.includes(i.productId));
  }
  return true;
}

/** Project a full `CouponProps` down to the slim, localStorage-safe shape `cartSlice` persists.
 *  `isSpinWon` is stamped in here rather than left for the caller to recompute later, since the uid
 *  that determined it may not be in scope by the time the cart is read back from storage. */
export function toAppliedCoupon(coupon: CouponProps, uid: string): AppliedCoupon {
  return {
    code: coupon.code,
    description: coupon.description,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    maximumDiscount: coupon.maximumDiscount,
    applicationType: coupon.applicationType,
    applicableCategories: coupon.applicableCategories,
    applicableProducts: coupon.applicableProducts,
    isSpinWon: coupon.createdBy === uid,
  };
}

const cartSubtotal = (items: CartItem[]) => round2(items.reduce((s, i) => s + i.unitPrice * i.quantity, 0));

/**
 * Classify every non-hidden coupon against the current cart: `available` (can be applied now) or
 * `locked` (shown greyed with why not — spec §2.12's "Locked coupons... with unlock hint"). Mirrors
 * `computeCouponDiscount`'s ordering (minimum order amount, then category/product applicability) but
 * DROPS the two checks WEB_BATCH3_NOTES.md §4 says cannot be done client-side: `targetUsers`-based
 * targeting (the field doesn't exist on the document at all) and "already used by this user" (the
 * subcollection is unreadable). Both remain enforced server-side where they're actually checkable.
 */
export async function getEligibleCoupons(uid: string, items: CartItem[]): Promise<EligibleCouponsResult> {
  const snap = await getDocs(query(collection(db, FirestoreCollections.coupons), limit(COUPON_READ_CAP)));
  const now = Date.now();
  const subtotal = cartSubtotal(items);

  const available: EligibleCoupon[] = [];
  const locked: LockedCoupon[] = [];

  for (const d of snap.docs) {
    const coupon = { ...d.data(), id: d.id } as CouponProps;
    if (isHidden(coupon, now)) continue;
    const isSpinWon = coupon.createdBy === uid;

    if (subtotal < coupon.minimumOrderAmount) {
      locked.push({
        coupon,
        reason: `Add ₹${round2(coupon.minimumOrderAmount - subtotal)} more to unlock`,
        isSpinWon,
      });
      continue;
    }
    if (!appliesToCart(coupon, items)) {
      locked.push({ coupon, reason: 'Not applicable to the items in your bag', isSpinWon });
      continue;
    }

    const discount = computeCouponDiscountPreview(toAppliedCoupon(coupon, uid), subtotal, items);
    available.push({ coupon, discount, isSpinWon });
  }

  return { available, locked };
}

/**
 * Validate a manually-typed code against the current cart, returning the SPECIFIC reason on failure
 * (mirrors `computeCouponDiscount`'s HttpsError messages where practical) — never a generic "invalid
 * coupon". `perUserLimit` is intentionally NOT checked here (see module header); the checkout thunk
 * must still be ready for `createPaymentOrder` to reject this coupon for that reason alone.
 */
export async function validateCode(
  code: string,
  uid: string,
  items: CartItem[],
): Promise<ValidateCodeResult> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return { ok: false, reason: 'Enter a coupon code.' };

  const snap = await getDocs(
    query(collection(db, FirestoreCollections.coupons), where('code', '==', normalized), limit(1)),
  );
  const docSnap = snap.docs[0];
  if (!docSnap) return { ok: false, reason: 'That coupon code is invalid.' };

  const coupon = { ...docSnap.data(), id: docSnap.id } as CouponProps;
  const now = Date.now();

  if (!coupon.isActive) return { ok: false, reason: 'This coupon is not active.' };
  if (coupon.validFrom && coupon.validFrom.toMillis() > now) {
    return { ok: false, reason: 'This coupon is not valid yet.' };
  }
  if (coupon.validUntil && coupon.validUntil.toMillis() < now) {
    return { ok: false, reason: 'This coupon has expired.' };
  }
  if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
    return { ok: false, reason: 'This coupon has reached its usage limit.' };
  }

  const subtotal = cartSubtotal(items);
  if (subtotal < coupon.minimumOrderAmount) {
    return { ok: false, reason: `Add ₹${round2(coupon.minimumOrderAmount - subtotal)} more to use this coupon.` };
  }
  if (!appliesToCart(coupon, items)) {
    return { ok: false, reason: 'This coupon does not apply to your items.' };
  }

  const discount = computeCouponDiscountPreview(toAppliedCoupon(coupon, uid), subtotal, items);
  return { ok: true, coupon, discount };
}

/**
 * Coupons this user won by spinning — `createdBy == uid` cleanly isolates them, since every
 * admin-authored coupon's `createdBy` is an admin's uid, never a customer's (WEB_BATCH3_NOTES.md §3).
 * These are otherwise ordinary coupons: same `applyCoupon`/`validateCode` path, this is purely for the
 * "From your spins" grouping in C1's coupon list.
 */
export async function getSpinWonCoupons(uid: string): Promise<CouponProps[]> {
  const snap = await getDocs(
    query(collection(db, FirestoreCollections.coupons), where('createdBy', '==', uid), limit(50)),
  );
  return snap.docs.map((d) => ({ ...d.data(), id: d.id }) as CouponProps);
}

/** Re-fetch one coupon by its document id — used to re-validate a persisted `AppliedCoupon` (which
 *  carries no id) once the customer re-opens the cart, before trusting it for a fresh totals preview. */
export async function getCouponById(couponId: string): Promise<CouponProps | null> {
  const snap = await getDoc(doc(db, FirestoreCollections.coupons, couponId));
  if (!snap.exists()) return null;
  return { ...snap.data(), id: snap.id } as CouponProps;
}
