import {
  Timestamp,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
  type DocumentData,
  type Query,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { FirestoreCollections, type CouponProps } from '@barakath/shared';
import { db } from '@/lib/firebaseConfig';

/**
 * Coupon Wallet queries (spec §3.15 route, §3.14 embed) — see `CouponWallet.tsx` for why both parallel
 * consumers share this one component. `WEB_BATCH4_NOTES.md` and `packages/shared/src/config/
 * collections.ts`'s own note are both explicit: there is NO `spinRewards` collection. A spin win mints
 * an ordinary `coupons` doc (`functions/src/growth/spinWheel.ts`) with a `SPIN-` code prefix, no
 * separate "status" field, and `createdBy` set to the WINNER's uid — every other status a coupon can
 * be in is derived here from `usedCount` / `validUntil`, not read off a stored field.
 */
export type CouponTab = 'active' | 'used' | 'expired';

/**
 * Build the base (unpaginated — no `limit`/`startAfter`) query for one Coupon Wallet tab.
 * Feed straight into `usePaginatedCollection`, wrapped in `useMemo` by the caller.
 *
 * WHY `createdBy == customerId` is the ownership filter: confirmed against real, already-shipped code
 * — `src/lib/commerce/coupons.ts`'s `getSpinWonCoupons` uses the exact same filter with the comment
 * "createdBy == uid cleanly isolates them, since every admin-authored coupon's createdBy is an admin's
 * uid, never a customer's" (WEB_BATCH3_NOTES.md §3). This wallet is the paginated, tab-split version
 * of that same idea, not a competing mechanism.
 *
 * WHY `usedCount` equality (`== 0` / `== 1`), not a `>=` range: every coupon a customer can own today
 * is spin-minted with `usageLimit: 1, perUserLimit: 1` (`spinWheel.ts`), so `usedCount` is always
 * exactly 0 or 1. An equality filter — unlike a range/inequality — imposes no "the first `orderBy`
 * must match this field" constraint, so each tab is still free to sort by whatever actually matters to
 * it (`createdAt` for Used, `validUntil` for Active/Expired). If a future path ever mints a
 * customer-owned coupon with `usageLimit > 1`, this would need to move to a normalised boolean field.
 *
 * WHY Active vs Expired differ only by the `validUntil` comparison direction: both require
 * `usedCount == 0` (never redeemed) — the only question left is whether `validUntil` is still ahead of
 * "now" or behind it. `now` is captured once per call so a tab's own boundary does not shift while its
 * page is open.
 */
export function couponWalletQuery(customerId: string, tab: CouponTab): Query<DocumentData> {
  const base = collection(db, FirestoreCollections.coupons);
  const now = Timestamp.now();

  switch (tab) {
    case 'used':
      return query(
        base,
        where('createdBy', '==', customerId),
        where('usedCount', '==', 1),
        orderBy('createdAt', 'desc'),
      );
    case 'active':
      return query(
        base,
        where('createdBy', '==', customerId),
        where('usedCount', '==', 0),
        where('validUntil', '>', now),
        orderBy('validUntil', 'asc'),
      );
    case 'expired':
      return query(
        base,
        where('createdBy', '==', customerId),
        where('usedCount', '==', 0),
        where('validUntil', '<=', now),
        orderBy('validUntil', 'desc'),
      );
    default: {
      const exhaustive: never = tab;
      throw new Error(`Unhandled coupon tab: ${exhaustive}`);
    }
  }
}

/** Maps one `coupons` doc to `CouponProps` — a stable, module-scope function so it can be passed
 *  straight into `usePaginatedCollection`'s `mapper` without a fresh reference on every render. */
export function mapCoupon(doc: QueryDocumentSnapshot<DocumentData>): CouponProps {
  return { ...doc.data(), id: doc.id } as CouponProps;
}

/**
 * Best-effort lookup of which order a "Used" coupon was redeemed on, for the Used tab's "used on
 * order #…" line (Batch 4 brief §3).
 *
 * WHY this reads `orders`, not `coupons/{id}/usageHistory`: `firestore.rules` gives that subcollection
 * NO client read rule at all — confirmed in `src/lib/commerce/coupons.ts`'s own header comment
 * ("`coupons/{id}/usageHistory` has no client read rule at all"). `OrderProps.couponCode` is a plain
 * field on a document the customer CAN read (`allow read: if isAdmin() || resource.data.userId ==
 * uid`), so querying orders for the matching code is the only client-reachable path to this info.
 *
 * WHY this is allowed to fail silently: it is a "nice to have" line on an already-used coupon, not
 * load-bearing data — a missing/failed lookup just omits the order reference rather than blocking or
 * erroring the whole card. Bounded to one document (`limit(1)`), never an unbounded scan.
 */
export async function findOrderIdForCoupon(customerId: string, couponCode: string): Promise<string | null> {
  const snap = await getDocs(
    query(
      collection(db, FirestoreCollections.orders),
      where('userId', '==', customerId),
      where('couponCode', '==', couponCode),
      limit(1),
    ),
  );
  return snap.docs[0]?.id ?? null;
}
