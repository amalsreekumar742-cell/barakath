import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import { db } from '@/lib/firebaseConfig';

/**
 * isCouponCodeTaken — true if another coupon already uses `code` (spec §1.12: coupon code must be unique).
 * WHY a standalone function (not a thunk): it is called both from the form's on-blur feedback and from
 * the create/update thunks, and its result is a plain boolean that never lives in the slice — so it
 * doesn't need the RTK lifecycle. Codes are stored uppercased, so we uppercase before comparing.
 * `excludeId` lets Edit ignore the coupon's own document when checking.
 *
 * WHY a single-field equality query with limit(1): uniqueness only needs to know if ANY other doc has the
 * code — reading one match is enough and needs no composite index (single-field equality is auto-indexed).
 */
export async function isCouponCodeTaken(code: string, excludeId?: string): Promise<boolean> {
  const snap = await getDocs(
    query(
      collection(db, FirestoreCollections.coupons),
      where('code', '==', code.trim().toUpperCase()),
      limit(1),
    ),
  );
  return snap.docs.some((d) => d.id !== excludeId);
}
