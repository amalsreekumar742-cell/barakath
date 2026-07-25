import 'server-only';

import { collection, getDocs, limit, query, where, type Timestamp } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared';
import type { FlashSaleProps } from '@barakath/shared';
import { serverDb } from './serverFirestore';
import { getFlashSaleProducts } from './catalog';

/**
 * Server-side flash-sale reads. Like `lib/data/catalog.ts` this is `server-only`, reads the PUBLIC
 * `flashSales` collection with the Web SDK `serverDb`, and never computes a sale window — the
 * `flashSaleManager` scheduler (every 5 minutes) owns activation and only sets flags; the site READS.
 *
 * WHY flash PRODUCTS are not re-queried here: `catalog.ts` already has `getFlashSaleProducts`, which
 * filters `status == Active && isFlashSale == true`. Re-implementing that query would be a second place
 * the flash-product rule could drift, so it is re-exported below. A consumer pairs each returned product
 * with its first variant (`getFirstVariantByProduct`) and calls `resolvePrice` to get the flash price —
 * the product flag alone does not carry a price.
 */

/** The minimal shape a countdown/banner needs: which sale, its name, and when it ends. */
export interface ActiveFlashSale {
  id: string;
  name: string;
  /** Passed to `<FlashCountdown/>`; a Server Component should hand it on as `endDate.toMillis()`. */
  endDate: Timestamp;
}

/**
 * The one flash sale that is LIVE right now, or null.
 *
 * A sale is live only when `isActive == true` (admin enabled) AND `activated == true` (the scheduler
 * has applied the price changes) AND `startDate <= now < endDate`. All three are required: `isActive`
 * can be on before the window opens, and `activated` is what proves the product/variant flags have
 * actually been written, so gating on it keeps the countdown in lock-step with the discounted prices.
 *
 * WHY the query filters only `isActive` and the rest is checked in memory: `isActive` is a single
 * equality (auto-indexed, no composite index needed), and live sales are few — the `activated` equality
 * plus the two-sided date window (`startDate <= now` and `endDate > now` are ranges on DIFFERENT fields,
 * which Firestore cannot combine in one query) are cheap to evaluate over the small capped result. This
 * mirrors how `catalog.ts getBanners` narrows its date window in code.
 *
 * WHY `limit(20)` rather than 1: normally at most one sale is live, but filtering `activated` + window
 * happens after the read, so a small cap guarantees the live one is in the page even if a just-disabled
 * or not-yet-activated sale sorts ahead of it. The first match wins.
 */
export async function getActiveFlashSale(): Promise<ActiveFlashSale | null> {
  const snap = await getDocs(
    query(
      collection(serverDb, FirestoreCollections.flashSales),
      where('isActive', '==', true),
      limit(20),
    ),
  );

  const now = Date.now();
  const live = snap.docs
    .map((d) => ({ ...d.data(), id: d.id }) as FlashSaleProps)
    .find(
      (sale) =>
        sale.activated === true &&
        sale.startDate.toMillis() <= now &&
        sale.endDate.toMillis() > now,
    );

  if (!live) return null;
  return { id: live.id, name: live.name, endDate: live.endDate };
}

/**
 * The products flagged into the running flash sale — a thin re-export of the canonical catalog query so
 * a flash-sale surface imports it from here without duplicating the `isFlashSale == true` filter.
 * Consumers pair each product with `getFirstVariantByProduct` + `resolvePrice` to show the flash price.
 */
export { getFlashSaleProducts };
